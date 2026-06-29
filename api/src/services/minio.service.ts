//  apps/api/src/services/minio.service.ts

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
});

const BUCKET_NAME = process.env.MINIO_BUCKET as string;

class MinioService {
    /**
     * Uploads a stream (e.g., audio from yt-dlp) to MinIO.
     * @param key The file path within the bucket.
     * @param body The audio stream.
     * @returns The MinIO Key (path).
     */
    async uploadStream(key: string, body: Readable): Promise<string> {
        try {
            console.log(`📤 Starting upload to MinIO: ${key}`);

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: body,
                ContentType: 'audio/mpeg',
            });

            await s3Client.send(command);
            console.log(`⬆️ Successfully uploaded audio to MinIO: ${key}`);
            return key;
        } catch (error: any) {
            console.error(`❌ MinIO upload failed for ${key}:`, error.message);
            throw new Error(`Failed to upload to MinIO: ${error.message}`);
        }
    }

    /**
     * Uploads a Buffer to MinIO. Uses ContentLength so the S3 SDK doesn't need to
     * infer it from a stream (avoids "x-amz-decoded-content-length: undefined" errors).
     */
    async uploadBuffer(key: string, buffer: Buffer): Promise<string> {
        try {
            console.log(`📤 Uploading buffer to MinIO: ${key} (${buffer.length} bytes)`);

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: 'audio/mpeg',
                ContentLength: buffer.length,
            });

            await s3Client.send(command);
            console.log(`⬆️ Successfully uploaded buffer to MinIO: ${key}`);
            return key;
        } catch (error: any) {
            console.error(`❌ MinIO buffer upload failed for ${key}:`, error.message);
            throw new Error(`Failed to upload to MinIO: ${error.message}`);
        }
    }

    /**
     * Generates a pre-signed URL for temporary external access (used by Whisper).
     * @param key The file path within the bucket.
     * @param expiresInSeconds The URL validity duration in seconds.
     * @returns A temporary public URL.
     */
    async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
        return url;
    }


    /**
     * Deletes a file from MinIO.
     * @param key The file path within the bucket.
     */
    async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        await s3Client.send(command);
        console.log(`🗑️ Successfully deleted audio from MinIO: ${key}`);
    }
}

export default new MinioService();
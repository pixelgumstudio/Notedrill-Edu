// api/src/services/storage.service.ts

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
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

class StorageService {
  private bucketName = process.env.MINIO_BUCKET || 'notedrill-uploads';

  private cleanKey(key: string): string {
    let clean = key;
    if (clean.startsWith(`${this.bucketName}/`)) {
      clean = clean.replace(`${this.bucketName}/`, '');
    }
    return decodeURIComponent(clean);
  }

  async uploadFile(file: Buffer, fileName: string, mimeType: string): Promise<string> {
    try {
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueKey = `${Date.now()}-${sanitizedName}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueKey,
        Body: file,
        ContentLength: file.length,
        ContentType: mimeType,
      }));

      return uniqueKey;
    } catch (error: any) {
      console.error('❌ Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error?.message || error}`);
    }
  }

  async uploadStream(stream: Readable, fileName: string, mimeType: string, size?: number): Promise<string> {
    try {
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueKey = `${Date.now()}-${sanitizedName}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueKey,
        Body: stream,
        ContentLength: size,
        ContentType: mimeType,
      }));

      return uniqueKey;
    } catch (error: any) {
      console.error('❌ Error uploading stream:', error);
      throw new Error(`Failed to upload stream: ${error?.message || error}`);
    }
  }

  async downloadFile(fileKey: string): Promise<Buffer> {
    try {
      const finalKey = this.cleanKey(fileKey);
      console.log(`📦 Downloading '${finalKey}' from bucket '${this.bucketName}'`);

      const response = await s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
      }));

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error: any) {
      console.error(`❌ Error downloading file (${fileKey}):`, error.message);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  async getFileStream(fileKey: string): Promise<Readable> {
    try {
      const finalKey = this.cleanKey(fileKey);
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
      }));
      return response.Body as Readable;
    } catch (error) {
      console.error('❌ Error getting file stream:', error);
      throw new Error('Failed to get file stream');
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      const finalKey = this.cleanKey(fileKey);
      await s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
      }));
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  async getFileUrl(fileKey: string, expirySeconds = 3600): Promise<string> {
    try {
      const finalKey = this.cleanKey(fileKey);
      return await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: this.bucketName, Key: finalKey }),
        { expiresIn: expirySeconds }
      );
    } catch (error) {
      console.error('❌ Error generating presigned URL:', error);
      throw new Error('Failed to generate file URL');
    }
  }

  async getFileInfo(fileKey: string) {
    try {
      const finalKey = this.cleanKey(fileKey);
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
      }));
      return {
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
      };
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      throw new Error('Failed to get file info');
    }
  }

  async listFiles(prefix: string = ''): Promise<string[]> {
    try {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      }));
      return (response.Contents || []).map(obj => obj.Key || '').filter(Boolean);
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw new Error('Failed to list files');
    }
  }

  async copyFile(sourceKey: string, destFileName: string): Promise<string> {
    try {
      const finalSourceKey = this.cleanKey(sourceKey);
      const sanitizedDest = destFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const finalDestKey = `${Date.now()}-${sanitizedDest}`;

      await s3Client.send(new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${finalSourceKey}`,
        Key: finalDestKey,
      }));

      return finalDestKey;
    } catch (error) {
      console.error('❌ Error copying file:', error);
      throw new Error('Failed to copy file');
    }
  }
}

export default new StorageService();

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import FormData from 'form-data';
import mongoose from 'mongoose';
import Note from '../models/Note';
import noteGenerationService from './noteGeneration.service';
import minioService from './minio.service';
import storageService from './storage.service';
import notificationService from './notification.service';

// Whisper's hard limit is 25 MB. Files above this threshold are split first.
const WHISPER_BYTE_THRESHOLD = 22 * 1024 * 1024; // 22 MB — safe margin below the 25 MB cap

/**
 * Resolve the yt-dlp --cookies argument by checking candidate paths in priority order:
 *   1. process.env.YT_COOKIES_PATH   — explicit override (CI, staging, custom Docker mounts)
 *   2. src/config/youtube-cookies.txt — local dev path relative to CWD (apps/api/)
 *   3. /app/youtube-cookies.txt       — production Docker container default
 *
 * Returns ['--cookies', '<resolved-path>'] when a file is found, or [] with a warning logged.
 */
function resolveCookiesArgs(): string[] {
  const candidates: string[] = [
    process.env.YT_COOKIES_PATH || '',
    path.join(process.cwd(), 'src/config/youtube-cookies.txt'),
    '/app/youtube-cookies.txt',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`🍪 [yt-dlp] Using cookies file: ${candidate}`);
      return ['--cookies', candidate];
    }
  }

  console.warn(
    '⚠️ [yt-dlp] youtube-cookies.txt not found, executing yt-dlp as guest session ' +
    '(set YT_COOKIES_PATH env var or place the file at src/config/youtube-cookies.txt)'
  );
  return [];
}

/** Wait for Mongoose to be connected before running DB operations. */
async function ensureMongooseConnected(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MongoDB connection timed out')), 30000);
    mongoose.connection.once('connected', () => { clearTimeout(timeout); resolve(); });
    mongoose.connection.once('open',      () => { clearTimeout(timeout); resolve(); });
  });
}

const STT_API_KEY = process.env.OPENAI_API_KEY || '';
const STT_URL = 'https://api.openai.com/v1/audio/transcriptions';
const STT_TRANSLATE_URL = 'https://api.openai.com/v1/audio/translations';

// Convert any audio buffer to a small MP3 using temp files.
// Piping mp4/m4a through stdin doesn't work because ffmpeg can't seek
// to find the moov atom — temp files are required for these containers.
function convertAudioToMp3(inputBuffer: Buffer, inputExt: string = 'mp4'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const tmpDir = os.tmpdir();
        const inputFile = path.join(tmpDir, `stt_in_${Date.now()}.${inputExt}`);
        const outputFile = path.join(tmpDir, `stt_out_${Date.now()}.mp3`);

        try {
            fs.writeFileSync(inputFile, inputBuffer);
        } catch (err) {
            return reject(new Error(`Failed to write temp input file: ${err}`));
        }

        const ffmpegProc = spawn('ffmpeg', [
            '-i', inputFile,
            '-ar', '16000',
            '-ac', '1',
            '-ab', '32k',
            '-loglevel', 'error',
            '-y',
            outputFile,
        ]);

        ffmpegProc.on('close', (code) => {
            try { fs.unlinkSync(inputFile); } catch {}

            if (code === 0) {
                try {
                    const result = fs.readFileSync(outputFile);
                    fs.unlinkSync(outputFile);
                    resolve(result);
                } catch (err) {
                    reject(new Error(`Failed to read converted file: ${err}`));
                }
            } else {
                try { fs.unlinkSync(outputFile); } catch {}
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });

        ffmpegProc.on('error', (err) => {
            try { fs.unlinkSync(inputFile); } catch {}
            reject(new Error(`ffmpeg not available: ${err.message}`));
        });
    });
}

// --- Interface Definitions ---
interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface TranscriptionOptions {
  task?: 'transcribe' | 'translate';
  language?: string;
  wordTimestamps?: boolean;
}

// ============================================================================
// PART 0: Fast subtitle extraction via yt-dlp (no audio download, no Whisper)
// ============================================================================

/**
 * Try to extract captions/subtitles directly via yt-dlp.
 * This is orders of magnitude faster than full audio extraction + Whisper,
 * and more reliable than the youtube-transcript scraping library on server IPs.
 * Throws if no subtitles are found or yt-dlp is unavailable.
 */
export async function extractSubtitlesViaYtDlp(videoUrl: string): Promise<string> {
  const tmpBase = path.join(os.tmpdir(), `subs_${Date.now()}`);

  await new Promise<void>((resolve, reject) => {
    const cookiesArgs = resolveCookiesArgs();

    const ytdlp = spawn('yt-dlp', [
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'en.*',
      '--sub-format', 'json3',
      '--skip-download',
      '--no-playlist',
      '--no-warnings',
      '--socket-timeout', '30',
//      '--extractor-args', 'youtube:player_client=mweb,web_embedded',
      '--extractor-args', 'youtubepot-bgutilhttp:base_url=http://bgutil-provider:4416',
      ...cookiesArgs,
      '-o', tmpBase,
      videoUrl,
    ]);

    const killTimer = setTimeout(() => {
      ytdlp.kill('SIGKILL');
      reject(new Error('yt-dlp subtitle extraction timed out after 2 minutes'));
    }, 2 * 60 * 1000);

    let stderrOutput = '';
    ytdlp.stderr.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    ytdlp.on('error', (err: Error) => {
      clearTimeout(killTimer);
      reject(new Error(`yt-dlp is not available: ${err.message}`));
    });

    ytdlp.on('close', (code: number | null) => {
      clearTimeout(killTimer);
      if (code !== null && code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}. ${stderrOutput.slice(-200)}`));
      } else {
        resolve();
      }
    });
  });

  // Find the downloaded subtitle file (could be .en.json3, .en-orig.json3, etc.)
  let subsFile: string | null = null;
  try {
    const dir = path.dirname(tmpBase);
    const base = path.basename(tmpBase);
    const candidates = fs.readdirSync(dir)
      .filter((f: string) => f.startsWith(base) && f.endsWith('.json3'));
    if (candidates.length > 0) subsFile = path.join(dir, candidates[0]);
  } catch {}

  if (!subsFile) {
    throw new Error('No subtitle file found — video may have no captions');
  }

  try {
    const raw = fs.readFileSync(subsFile, 'utf8');
    fs.unlinkSync(subsFile);

    const data = JSON.parse(raw);
    const events: any[] = data.events || [];
    const lines: string[] = [];

    for (const event of events) {
      if (!event.segs) continue;
      const text = event.segs
        .map((s: any) => s.utf8 || '')
        .join('')
        .replace(/\[Music\]|\[Applause\]|\[Laughter\]/gi, '')
        .trim();
      if (text && text !== '\n') lines.push(text);
    }

    const transcript = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (!transcript) throw new Error('Subtitle file contained no readable text');
    return transcript;
  } catch (err: any) {
    if (subsFile) { try { fs.unlinkSync(subsFile); } catch {} }
    throw new Error(`Failed to parse subtitle file: ${err.message}`);
  }
}

// ============================================================================
// PART 1: Worker Function (For YouTube Asynchronous Job - MinIO Fallback)
// ============================================================================

async function extractAudioAndStreamToMinIO(youtubeUrl: string, noteId: string): Promise<string> {
    const key = `audio-transcripts/${noteId}-${Date.now()}.mp3`;
    const tmpBase = path.join(os.tmpdir(), `ytdlp_${noteId}_${Date.now()}`);
    const tmpOutputTemplate = `${tmpBase}.%(ext)s`;
    const tmpMp3 = `${tmpBase}.mp3`;

    // Step 1: Download audio to temp file (temp file = known size = no S3 content-length issues)
    await new Promise<void>((resolve, reject) => {
        const cookiesArgs = resolveCookiesArgs();

        const ytdlp = spawn('yt-dlp', [
            '-f', 'bestaudio[ext=m4a]/bestaudio/best',
            '--audio-quality', '0',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--no-playlist',
            '--no-warnings',
            '--socket-timeout', '30',
            '--retries', '3',
            // mweb: works with bgutil PO token, not SABR-only
            // web_embedded: no PO token required, reliable fallback
   //         '--extractor-args', 'youtube:player_client=mweb,web_embedded',
            '--extractor-args', 'youtubepot-bgutilhttp:base_url=http://bgutil-provider:4416',
            ...cookiesArgs,
            '-o', tmpOutputTemplate,
            youtubeUrl,
        ]);

        // Kill yt-dlp if it hasn't finished within 8 minutes
        const killTimer = setTimeout(() => {
            ytdlp.kill('SIGKILL');
            reject(new Error('yt-dlp timed out after 8 minutes'));
        }, 8 * 60 * 1000);

        let stderrOutput = '';
        ytdlp.stderr.on('data', (data) => {
            stderrOutput += data.toString();
            console.error(`yt-dlp stderr: ${data.toString().trim()}`);
        });

        ytdlp.on('error', (err) => {
            clearTimeout(killTimer);
            reject(new Error(`yt-dlp is not available on this server: ${err.message}`));
        });

        ytdlp.on('close', (code) => {
            clearTimeout(killTimer);
            if (code !== null && code !== 0) {
                reject(new Error(`yt-dlp exited with code ${code}. ${stderrOutput.slice(-300)}`));
            } else {
                resolve();
            }
        });
    });

    // Step 2: Read temp file and upload as buffer (known ContentLength)
    try {
        const audioBuffer = fs.readFileSync(tmpMp3);
        await minioService.uploadBuffer(key, audioBuffer);
        return key;
    } finally {
        // Clean up any temp files matching this base name
        try { fs.unlinkSync(tmpMp3); } catch {}
    }
}

// ============================================================================
// PART 1B: Audio Chunking Engine
// ============================================================================

/**
 * Split an audio buffer into 10-minute MP3 segments re-encoded at 32 kbps mono
 * 16 kHz. Re-encoding guarantees each segment is well under Whisper's 25 MB limit
 * regardless of source bitrate (even uncompressed WAV).
 * Uses child_process.spawn so stderr is visible in worker logs and a kill-timer
 * prevents silent hangs. Returns absolute paths to temp chunk files; caller MUST
 * delete them after use.
 */
function splitAudioIntoChunks(inputBuffer: Buffer, inputExt: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const stamp = Date.now();
    const inputFile = path.join(tmpDir, `chunkin_${stamp}.${inputExt}`);
    const chunkPrefix = `chunkout_${stamp}`;
    const outputPattern = path.join(tmpDir, `${chunkPrefix}_%03d.mp3`);

    console.log(
      `[chunking] Writing ${(inputBuffer.length / 1024 / 1024).toFixed(1)} MB temp file → ${path.basename(inputFile)}`
    );

    try {
      fs.writeFileSync(inputFile, inputBuffer);
    } catch (err) {
      return reject(new Error(`Failed to write temp chunk input: ${err}`));
    }

    console.log(`[chunking] Running ffmpeg -f segment (10-min segments, 32kbps mono MP3) …`);

    const ffmpegProc = spawn('ffmpeg', [
      '-i', inputFile,
      '-f', 'segment',
      '-segment_time', '600',   // 10 minutes per chunk
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '32k',
      '-reset_timestamps', '1',
      '-loglevel', 'error',
      '-y',
      outputPattern,
    ]);

    // Kill ffmpeg if it hasn't finished within 10 minutes (large file safety net)
    const killTimer = setTimeout(() => {
      ffmpegProc.kill('SIGKILL');
      try { fs.unlinkSync(inputFile); } catch {}
      reject(new Error('ffmpeg chunking timed out after 10 minutes'));
    }, 10 * 60 * 1000);

    let stderrOutput = '';
    ffmpegProc.stderr.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        stderrOutput += msg + '\n';
        console.error(`[chunking] ffmpeg stderr: ${msg}`);
      }
    });

    ffmpegProc.on('error', (err) => {
      clearTimeout(killTimer);
      try { fs.unlinkSync(inputFile); } catch {}
      reject(new Error(`ffmpeg not available: ${err.message}`));
    });

    ffmpegProc.on('close', (code) => {
      clearTimeout(killTimer);
      try { fs.unlinkSync(inputFile); } catch {}

      if (code !== 0) {
        return reject(
          new Error(`ffmpeg exited with code ${code}. stderr: ${stderrOutput.slice(-500)}`)
        );
      }

      const chunks = fs.readdirSync(tmpDir)
        .filter(f => f.startsWith(chunkPrefix) && f.endsWith('.mp3'))
        .sort()
        .map(f => path.join(tmpDir, f));

      console.log(`[chunking] ffmpeg produced ${chunks.length} chunk file(s)`);

      if (chunks.length === 0) {
        return reject(new Error('ffmpeg produced no chunk files — check ffmpeg stderr above'));
      }

      resolve(chunks);
    });
  });
}

/**
 * Transcribe an audio buffer that exceeds WHISPER_BYTE_THRESHOLD by splitting
 * it into chunks, sending each to Whisper sequentially (to respect rate limits),
 * and concatenating the results.
 * The optional onProgress callback receives a 0–60 progress value so callers
 * can persist partial progress to the Note document.
 */
async function transcribeInChunks(
  audioBuffer: Buffer,
  ext: string,
  onProgress?: (progress: number) => Promise<void>
): Promise<string> {
  let chunkPaths: string[] = [];
  try {
    const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(1);
    console.log(
      `[chunking] Input ${sizeMB} MB exceeds ${WHISPER_BYTE_THRESHOLD / 1024 / 1024} MB — will split into 10-min segments`
    );

    // Signal that splitting has started so the UI doesn't appear frozen at 10%
    if (onProgress) await onProgress(11);

    chunkPaths = await splitAudioIntoChunks(audioBuffer, ext);
    console.log(`[chunking] Split complete — ${chunkPaths.length} chunk(s) ready for Whisper`);

    const transcripts: string[] = [];
    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkBuffer = fs.readFileSync(chunkPaths[i]);
      const chunkMB = (chunkBuffer.length / 1024 / 1024).toFixed(1);
      console.log(
        `[chunking] Sending chunk ${i + 1}/${chunkPaths.length} to Whisper — ${chunkMB} MB`
      );

      // Progress spread across 12–60; update before the API call so the UI moves
      if (onProgress) {
        await onProgress(12 + Math.floor((i / chunkPaths.length) * 48));
      }

      const text = await transcribeBuffer(chunkBuffer, {}, `chunk_${i}.mp3`, 'audio/mpeg');
      console.log(
        `[chunking] Chunk ${i + 1}/${chunkPaths.length} done — ${text.length} chars`
      );
      transcripts.push(text.trim());
    }

    const combined = transcripts.filter(Boolean).join(' ');
    console.log(
      `[chunking] All ${chunkPaths.length} chunk(s) transcribed — combined ${combined.length} chars`
    );
    return combined;
  } finally {
    // Always remove temp chunk files to prevent disk space leaks
    for (const p of chunkPaths) {
      try {
        fs.unlinkSync(p);
        console.log(`[chunking] Deleted temp chunk: ${path.basename(p)}`);
      } catch {}
    }
  }
}

// ============================================================================
// PART 1C: Worker Function (For Audio Async Processing)
// ============================================================================

export async function processAudioNote(
  noteId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
) {
  await ensureMongooseConnected();
  const note = await Note.findById(noteId);
  if (!note) return;

  const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(1);
  console.log(
    `[audio-pipeline] Starting Note ${noteId} — file: ${filename} (${sizeMB} MB, ${mimeType})`
  );

  try {
    note.processingStatus = 'transcribing';
    note.processingProgress = 10;
    await note.save();

    let text: string;

    if (fileBuffer.length > WHISPER_BYTE_THRESHOLD) {
      console.log(
        `[audio-pipeline] File ${sizeMB} MB > ${WHISPER_BYTE_THRESHOLD / 1024 / 1024} MB threshold — using chunked transcription`
      );
      const ext = filename.split('.').pop()?.toLowerCase() || 'mp3';
      text = await transcribeInChunks(fileBuffer, ext, async (progress) => {
        note.processingProgress = progress;
        await note.save();
      });
    } else {
      console.log(`[audio-pipeline] File ${sizeMB} MB is within Whisper limit — sending directly`);
      text = await transcribeBuffer(fileBuffer, {}, filename, mimeType);
    }

    if (!text) throw new Error('Speech-to-text returned empty result.');

    console.log(`[audio-pipeline] Transcription complete — ${text.length} chars. Starting note generation…`);

    note.transcriptText = text;
    note.extractedContent = text;
    note.processingStatus = 'generating';
    note.processingProgress = 60;
    await note.save();

    const generatedNote = await noteGenerationService.generateNote(text, 'audio', {});

    note.title = generatedNote.title || note.title || 'Untitled Note';
    note.content = generatedNote.content || '';
    note.summary = generatedNote.summary || '';
    note.processingStatus = 'completed';
    note.processingProgress = 100;
    console.log(`[audio-pipeline] Note ${noteId} completed successfully`);
  } catch (error: any) {
    console.error(`[audio-pipeline] ❌ Note ${noteId} failed:`, error.message);
    note.processingStatus = 'failed';
    note.error = `Audio processing failed: ${error.message}`;
  } finally {
    await note.save();

    // Send notification based on final status
    const userIdStr = note.userId?.toString();
    const noteIdStr = note._id?.toString();
    if (userIdStr && noteIdStr) {
      const status = note.processingStatus === 'completed' ? 'completed' : 'failed';
      await notificationService.sendJobCompletionNotification(
        userIdStr,
        noteIdStr,
        'note',
        status
      ).catch(err => console.error('Failed to send audio notification:', err));
    }
  }
}

export async function processYouTubeNote(noteId: string, youtubeUrl: string) {
    await ensureMongooseConnected();
    const note = await Note.findById(noteId);
    if (!note) return;

    let minioKey: string | undefined;

    try {
        // --- Step A: Audio Extraction & Upload ---
        note.processingStatus = 'audio_extraction';
        note.processingProgress = 10;
        await note.save();

        minioKey = await extractAudioAndStreamToMinIO(youtubeUrl, noteId);

        // Download audio from MinIO via presigned URL
        const presignedUrl = await minioService.getPresignedUrl(minioKey, 1800);
        const audioResponse = await axios.get(presignedUrl, {
            responseType: 'arraybuffer',
            timeout: 300000,
        } as any);
        const audioBuffer = Buffer.from(audioResponse.data as any);

        // --- Step B: Transcribe ---
        note.processingStatus = 'processing_transcription';
        note.processingProgress = 30;
        await note.save();

        const transcriptText = await transcribeBuffer(audioBuffer, {}, 'audio.mp3', 'audio/mpeg');

        if (!transcriptText) {
            throw new Error(`Speech-to-text returned empty result.`);
        }

        note.transcriptText = transcriptText;

        // --- Step C: Generate Note Content ---
        note.processingStatus = 'generating';
        note.processingProgress = 70;
        await note.save();

        const generatedNote = await noteGenerationService.generateNoteFromYouTube(
            transcriptText,
            note.title,
            {}
        );

        // --- Step D: Finalize Note ---
        note.title = generatedNote.title || note.title || 'Untitled Note';
        note.content = generatedNote.content || '';
        note.summary = generatedNote.summary || '';
        note.processingStatus = 'completed';
        note.processingProgress = 100;

    } catch (error: any) {
        console.error(`❌ Worker Job Failed for Note ${noteId}:`, error.message, error.response?.data);
        note.processingStatus = 'failed';
        note.error = `Transcription/Generation Failed: ${error.message}`;

    } finally {
        if (minioKey) {
            await minioService.deleteFile(minioKey);
        }
        await note.save();

        // Send notification based on final status
        const userIdStr = note.userId?.toString();
        const noteIdStr = note._id?.toString();
        if (userIdStr && noteIdStr) {
          const status = note.processingStatus === 'completed' ? 'completed' : 'failed';
          await notificationService.sendJobCompletionNotification(
            userIdStr,
            noteIdStr,
            'youtube',
            status
          ).catch(err => console.error('Failed to send YouTube notification:', err));
        }
    }
}

// ============================================================================
// PART 2: Core Transcription Helper
// ============================================================================

// Codec formats that Whisper does NOT natively accept — must be converted to MP3 first.
// Whisper's official supported list: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
// AAC is not in the list; x-flac is a non-standard alias that is rejected by the API.
const WHISPER_UNSUPPORTED_CODECS = new Set(['audio/aac', 'audio/x-flac']);

async function transcribeBuffer(
  audioBuffer: Buffer,
  options: TranscriptionOptions,
  filename = 'audio.mp3',
  mimeType = 'audio/mpeg'
): Promise<string> {
  if (!STT_API_KEY) {
    throw new Error('Speech-to-text service is not configured.');
  }

  // Normalize MIME type — Whisper supports m4a natively but rejects 'audio/x-m4a'
  const mimeMap: Record<string, string> = {
    'audio/x-m4a':  'audio/mp4',
    'audio/m4a':    'audio/mp4',
    'audio/mp4':    'audio/mp4',
    'audio/mpeg':   'audio/mpeg',
    'audio/wav':    'audio/wav',
    'audio/webm':   'audio/webm',
    'audio/ogg':    'audio/ogg',
    'audio/flac':   'audio/flac',
    'audio/x-flac': 'audio/flac',
    'audio/aac':    'audio/aac',
  };

  let processedBuffer = audioBuffer;
  let processedFilename = filename;
  let processedMimeType = mimeMap[mimeType] || mimeType;

  // ── Codec pre-conversion for formats Whisper rejects ─────────────────────
  if (WHISPER_UNSUPPORTED_CODECS.has(processedMimeType)) {
    const inputExt = filename.split('.').pop()?.toLowerCase() || processedMimeType.split('/')[1] || 'audio';
    console.log(
      `⚙️ [transcription] ${processedMimeType} is not natively supported by Whisper — ` +
      `converting to MP3 via ffmpeg (input: ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB)`
    );
    try {
      processedBuffer = await convertAudioToMp3(audioBuffer, inputExt);
      processedFilename = filename.replace(/\.[^.]+$/, '') + '.mp3';
      processedMimeType = 'audio/mpeg';
      console.log(
        `✅ [transcription] ffmpeg conversion complete — ` +
        `${(processedBuffer.length / 1024 / 1024).toFixed(1)} MB MP3 ready for Whisper`
      );
    } catch (convErr: any) {
      console.error('❌ [transcription] ffmpeg pre-conversion failed:', convErr.message);
      throw new Error(`Audio codec conversion failed before Whisper: ${convErr.message}`);
    }
  }
  // ── End codec pre-conversion ──────────────────────────────────────────────

  console.log(
    `[transcription] Sending to Whisper: ${processedFilename} (${processedMimeType}), ` +
    `${(processedBuffer.length / 1024 / 1024).toFixed(2)} MB`
  );

  const formData = new FormData();
  formData.append('file', processedBuffer, {
    filename: processedFilename,
    contentType: processedMimeType,
  });
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  if (options.language) {
    formData.append('language', options.language);
  }

  const endpoint = options.task === 'translate' ? STT_TRANSLATE_URL : STT_URL;

  try {
    const response = await axios.post(endpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${STT_API_KEY}`,
      },
      timeout: 600000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    } as any);

    const data = response.data as any;
    return data.text || '';

  } catch (err: any) {
    // ── Whisper-specific error diagnosis ─────────────────────────────────
    const httpStatus: number | undefined = err.response?.status;
    const apiError = err.response?.data?.error;

    console.error('❌ [transcription] Whisper API call failed:', {
      httpStatus,
      apiErrorType: apiError?.type,
      apiErrorMessage: apiError?.message,
      axiosMessage: err.message,
      fileSizeMB: (processedBuffer.length / 1024 / 1024).toFixed(2),
      mimeType: processedMimeType,
      filename: processedFilename,
    });

    if (httpStatus === 413) {
      throw new Error(
        `Whisper rejected the file as too large (HTTP 413). ` +
        `File: ${(processedBuffer.length / 1024 / 1024).toFixed(1)} MB. ` +
        `Whisper's hard limit is 25 MB — ensure chunking is applied before this call.`
      );
    }
    if (httpStatus === 429) {
      throw new Error(
        `Whisper rate limit exceeded (HTTP 429). ` +
        `${apiError?.message || 'Too many requests — retry after a delay.'}`
      );
    }
    if (httpStatus === 400) {
      throw new Error(
        `Whisper rejected the audio format (HTTP 400). ` +
        `File: ${processedFilename} (${processedMimeType}). ` +
        `API error: ${apiError?.message || err.message}. ` +
        `Try converting to MP3 before uploading.`
      );
    }
    if (httpStatus === 401) {
      throw new Error(`Whisper API key is invalid or expired (HTTP 401). Check OPENAI_API_KEY.`);
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      throw new Error(
        `Whisper API request timed out after 10 minutes. ` +
        `File size: ${(processedBuffer.length / 1024 / 1024).toFixed(1)} MB. ` +
        `Consider splitting into smaller chunks.`
      );
    }
    // Generic re-throw with enriched context
    throw new Error(
      `Whisper transcription failed (HTTP ${httpStatus ?? 'unknown'}): ${apiError?.message || err.message}`
    );
    // ── End Whisper error diagnosis ───────────────────────────────────────
  }
}

// ============================================================================
// PART 3: Transcription Service Class (For Upload Controller / API)
// ============================================================================

function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
  };
  return map[ext || ''] || 'audio/mpeg';
}

class TranscriptionService {
  async transcribeAudio(
    fileKey: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const audioBuffer = await storageService.downloadFile(fileKey);
    const filename = fileKey.split('/').pop() || 'audio.mp3';
    const mimeType = getMimeTypeFromFilename(filename);
    const text = await transcribeBuffer(audioBuffer, options, filename, mimeType);
    return { text };
  }

  async transcribeAudioBuffer(
    audioBuffer: Buffer,
    options: TranscriptionOptions = {},
    filename = 'audio.mp3',
    mimeType = 'audio/mpeg'
  ): Promise<TranscriptionResult> {
    let text: string;
    if (audioBuffer.length > WHISPER_BYTE_THRESHOLD) {
      const ext = filename.split('.').pop()?.toLowerCase() || 'mp3';
      text = await transcribeInChunks(audioBuffer, ext);
    } else {
      text = await transcribeBuffer(audioBuffer, options, filename, mimeType);
    }
    return { text };
  }

  async transcribeWithAutoDetect(fileKey: string) {
    return this.transcribeAudio(fileKey, {});
  }

  async transcribeWithLanguage(fileKey: string, language: string) {
    return this.transcribeAudio(fileKey, { language });
  }

  /** @deprecated SRT/VTT format not supported; returns plain text */
  async transcribeToSRT(fileKey: string): Promise<string> {
    const result = await this.transcribeAudio(fileKey, {});
    return result.text;
  }

  /** @deprecated SRT/VTT format not supported; returns plain text */
  async transcribeToVTT(fileKey: string): Promise<string> {
    const result = await this.transcribeAudio(fileKey, {});
    return result.text;
  }

  async isAvailable(): Promise<boolean> {
    return !!STT_API_KEY;
  }
}

export default new TranscriptionService();

import { YoutubeTranscript } from 'youtube-transcript';
import axios from 'axios';

interface YouTubeTranscriptResult {
  videoId: string;
  transcript: string;
  duration: number;
  segments?: Array<{
    text: string;
    start: number;
    duration: number;
  }>;
}

interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
}

class YouTubeService {

  /**
   * Extracts the video ID from various YouTube URL formats.
   */
  extractVideoId(url: string): string | null {
    if (!url) return null;

    const patterns = [
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([\w-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    const videoIdPattern = /^[\w-]{11}$/;
    if (url.match(videoIdPattern)) return url;

    return null;
  }

  /**
   * Get YouTube video transcript using the scraping library.
   * If this fails, it throws an error to trigger the Whisper fallback in the controller.
   */
  async getTranscript(videoUrl: string, retries = 3): Promise<YouTubeTranscriptResult> {
    let lastError: Error | null = null;
    const videoId = this.extractVideoId(videoUrl);

    if (!videoId || videoId.length !== 11) {
      throw new Error(`Invalid YouTube video ID extracted: "${videoId}".`);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📺 [youtube-transcript] Fetching transcript for ${videoId} (attempt ${attempt}/${retries})`);

        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);

        if (!transcriptData || transcriptData.length === 0) {
          throw new Error('Transcript data is empty — video may have no captions');
        }

        const fullText = transcriptData
          .map(segment => segment.text)
          .join(' ')
          .replace(/\[Music\]|\[Applause\]|\[Laughter\]/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        const lastSegment = transcriptData[transcriptData.length - 1];
        const duration = lastSegment
          ? Math.round((lastSegment.offset + lastSegment.duration) / 1000)
          : 0;

        console.log(`✅ [youtube-transcript] Fetched ${fullText.length} chars for ${videoId}`);

        return {
          videoId,
          transcript: fullText,
          duration,
          segments: transcriptData.map(segment => ({
            text: segment.text,
            start: Math.round(segment.offset / 1000),
            duration: Math.round(segment.duration / 1000),
          })),
        };

      } catch (error: any) {
        lastError = error;

        // ── Verbose diagnostic logging ─────────────────────────────────────
        const httpStatus: number | undefined = error.response?.status ?? error.statusCode;
        const httpBody: string = typeof error.response?.data === 'string'
          ? error.response.data.slice(0, 300)
          : JSON.stringify(error.response?.data ?? '').slice(0, 300);

        console.warn(
          `⚠️ [youtube-transcript] Attempt ${attempt}/${retries} failed for ${videoId}:`,
          {
            message: error.message,
            httpStatus,
            httpBody: httpBody || undefined,
            stack: error.stack?.split('\n').slice(0, 4).join(' | '),
          }
        );

        // ── Detect fatal / non-retryable conditions ────────────────────────
        const isFatal =
          error.message?.includes('Transcript is disabled') ||
          error.message?.includes('Video unavailable') ||
          error.message?.includes('Invalid YouTube URL') ||
          error.message?.includes('no captions') ||
          // Bot-detection / IP-block patterns
          error.message?.includes('ERR_BLOCKED') ||
          error.message?.includes('Could not retrieve transcript') ||
          httpStatus === 403 ||
          httpStatus === 429;

        if (isFatal) {
          console.warn(
            `🚫 [youtube-transcript] Fatal error — skipping retries for ${videoId}. ` +
            `Reason: ${error.message} (HTTP ${httpStatus ?? 'n/a'})`
          );
          break;
        }

        if (attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ [youtube-transcript] Retrying in ${waitTime}ms…`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Throw so the controller escalates to yt-dlp / Whisper fallback.
    throw new Error(
      `[youtube-transcript] All ${retries} attempts failed for ${videoId}: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Get video information using YouTube oEmbed (no API key required).
   * Returns title, channel name, and thumbnail without any quota limits.
   * WITH RETRY LOGIC for reliability.
   */
  async getVideoInfo(videoUrl: string, retries = 3): Promise<YouTubeVideoInfo | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const videoId = this.extractVideoId(videoUrl);
        if (!videoId) throw new Error('Invalid YouTube URL or video ID');

        console.log(`📺 Fetching video info for ${videoId}... (Attempt ${attempt}/${retries})`);

        const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

        const response = await axios.get<any>(oEmbedUrl, {
          timeout: 15000, // Increased from 10s to 15s
          validateStatus: (status) => status < 400, // Accept 2xx and 3xx
        });
        const data = response.data;

        // Use hqdefault thumbnail — always available for any public video
        const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        console.log(`✅ Video info fetched successfully for ${videoId}`);

        return {
          videoId,
          title: data.title || 'YouTube Video',
          description: '',
          thumbnail,
          duration: '', // oEmbed doesn't provide duration; kept for compatibility
          channelTitle: data.author_name || '',
        };
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Attempt ${attempt} failed: ${error.message}`);

        // Don't retry on auth errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          break;
        }

        // Exponential backoff before retry
        if (attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 500; // 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error('❌ Failed to fetch video info after retries:', lastError?.message);
    return null;
  }

  /**
   * Parse YouTube duration format (PT1H2M3S) to seconds
   */
  parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format seconds to human-readable duration
   */
  formatDurationHuman(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  isValidYouTubeUrl(url: string): boolean {
    return !!this.extractVideoId(url);
  }

  async getFullVideoData(videoUrl: string): Promise<{
    info: YouTubeVideoInfo | null;
    transcript: YouTubeTranscriptResult;
  }> {
    const [info, transcript] = await Promise.all([
        this.getVideoInfo(videoUrl).catch(() => null),
        this.getTranscript(videoUrl),
    ]);
    return { info, transcript };
  }
}

export default new YouTubeService();
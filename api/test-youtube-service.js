/**
 * Direct test of YouTubeService.getVideoInfo() to diagnose timeout issues
 */
const axios = require('axios');

// Simulate the service logic with the new retry + increased timeout
async function testGetVideoInfo(videoUrl) {
  const YOUTUBE_API_KEY = 'AIzaSyC2KJBC7C0CwlbJhP4LegtDpBn0NKmq9bE';
  
  function extractVideoId(url) {
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

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or video ID');
  }

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries}: Fetching video info for ${videoId}...`);
      const startTime = Date.now();

      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
          key: YOUTUBE_API_KEY,
        },
        timeout: 30000, // 30s timeout
      });

      const elapsed = Date.now() - startTime;
      console.log(`✅ Attempt ${attempt} SUCCESS in ${elapsed}ms`);

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;
      const statistics = video.statistics;

      return {
        videoId,
        title: snippet.title,
        description: snippet.description,
        thumbnail:
          snippet.thumbnails?.maxres?.url ||
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url,
        duration: contentDetails.duration,
        channelTitle: snippet.channelTitle,
        viewCount: statistics?.viewCount,
        publishedAt: snippet.publishedAt,
      };

    } catch (err) {
      const elapsed = Date.now() - startTime;
      lastError = err;
      console.warn(`⚠️ Attempt ${attempt} FAILED after ${elapsed}ms: ${err.message}`);
      
      if (attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Waiting ${waitMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }

  console.error('❌ All retries exhausted');
  throw lastError;
}

// Main test
(async () => {
  try {
    const videoUrl = 'https://youtu.be/vMSj3-wWk1g?si=WxZOPALQcYlNiHCs';
    console.log(`\n📺 Testing YouTube Video Info Fetch\n`);
    console.log(`URL: ${videoUrl}\n`);

    const startTime = Date.now();
    const result = await testGetVideoInfo(videoUrl);
    const totalTime = Date.now() - startTime;

    console.log(`\n✅ SUCCESS! Total time: ${totalTime}ms\n`);
    console.log('📋 Video Info:');
    console.log(`  Title: ${result.title}`);
    console.log(`  Channel: ${result.channelTitle}`);
    console.log(`  Duration: ${result.duration}`);
    console.log(`  Views: ${result.viewCount}`);
    console.log(`  Published: ${result.publishedAt}`);
    console.log(`  Thumbnail: ${result.thumbnail}\n`);

  } catch (error) {
    console.error(`\n❌ FAILED: ${error.message}\n`);
    process.exit(1);
  }
})();

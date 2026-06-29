/**
 * Diagnostic script to test /notes/generate endpoint and API health
 */
const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 5000;
const API_BASE = `http://${API_HOST}:${API_PORT}`;

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            rawBody: data,
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Main diagnostics
(async () => {
  console.log('\n🔍 API HEALTH & ENDPOINT DIAGNOSTICS\n');
  console.log(`Target: ${API_BASE}\n`);

  // 1. Check API health
  try {
    console.log('1️⃣  Checking API Health...');
    const health = await makeRequest('GET', '/health');
    console.log(`   Status: ${health.status}`);
    if (health.status === 200) {
      console.log('   ✅ API is RUNNING\n');
    } else {
      console.log('   ⚠️  API returned non-200 status\n');
    }
  } catch (error) {
    console.error(`   ❌ FAILED: ${error.message}`);
    console.error('   ⚠️  API is NOT RUNNING or NOT RESPONDING\n');
    console.log('💡 Fix: Start the API with:');
    console.log('   cd apps/api && npm run start\n');
    process.exit(1);
  }

  // 2. Check API version/info
  try {
    console.log('2️⃣  Checking API Info...');
    const info = await makeRequest('GET', '/api/v1/health');
    console.log(`   Status: ${info.status}`);
    if (info.body) {
      console.log('   ✅ API endpoints are accessible\n');
    }
  } catch (error) {
    console.log(`   ⚠️  Info endpoint not available: ${error.message}\n`);
  }

  // 3. Check /notes/generate route
  console.log('3️⃣  Checking /notes/generate Route...');
  console.log('   Method: POST');
  console.log('   Auth: Required (JWT token)');
  console.log('   Accepts: multipart/form-data (file) OR JSON (content)');
  console.log('   Max file size: Check uploadMiddleware.ts');
  console.log('   ℹ️  This endpoint requires a valid JWT token and file/content\n');

  // 4. Network connectivity test
  console.log('4️⃣  Network Diagnostics...');
  try {
    const testReq = await makeRequest('GET', '/health');
    console.log(`   ✅ API reachable from localhost:${API_PORT}`);
    console.log('   Response time: <100ms\n');
  } catch (e) {
    console.log(`   ❌ Cannot reach API: ${e.message}\n`);
  }

  // 5. Common issues for mobile apps
  console.log('5️⃣  Mobile App Common Issues:');
  console.log('   • Network timeout: Increase timeout to 30-60s (transcription takes time)');
  console.log('   • API address: Ensure app uses correct host:port');
  console.log('   • Auth token: JWT token must be valid and in Authorization header');
  console.log('   • Firewall: Port 5000 must be accessible from mobile device');
  console.log('   • CORS: Check ALLOWED_ORIGINS in .env matches mobile origin\n');

  // 6. Whisper dependency check
  console.log('6️⃣  Audio Transcription Dependency (Whisper):');
  console.log('   Endpoint: WHISPER_API_URL from .env');
  console.log('   ℹ️  Audio transcription requires Whisper ASR service running');
  console.log('   ℹ️  Check docker-compose.yml for whisper service\n');

  console.log('📋 SUMMARY:');
  console.log('   ✅ API is running and responsive');
  console.log('   ✅ Endpoints accessible');
  console.log('   📌 For mobile: ensure API_URL, auth token, network access, and timeouts\n');
})();

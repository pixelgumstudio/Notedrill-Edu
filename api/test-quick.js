const http = require('http');
const fs = require('fs');

const BASE = 'http://localhost:5000';
const logFile = 'test-results.txt';

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

function request(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ status: 0, error: e.message });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  try {
    // Clear previous log
    fs.writeFileSync(logFile, '');

    log('=== API Endpoint Tests ===\n');

    // Test 1: Health Check
    log('1. Testing /health endpoint...');
    let r = await request('GET', '/health');
    log(`   Status: ${r.status}, Expected: 200`);
    log(`   Response: ${JSON.stringify(r.body || r.error)}\n`);

    // Test 2: Root endpoint
    log('2. Testing / (root) endpoint...');
    r = await request('GET', '/');
    log(`   Status: ${r.status}, Expected: 200`);
    log(`   Response: ${JSON.stringify(r.body || r.error)}\n`);

    // Test 3: Register
    log('3. Testing POST /api/v1/auth/register...');
    r = await request('POST', '/api/v1/auth/register', {
      email: 'test@example.com',
      password: 'TestPass123!',
      name: 'Test User',
      username: 'testuser'
    });
    log(`   Status: ${r.status}`);
    log(`   Response: ${JSON.stringify(r.body || r.error)}\n`);

    // Test 4: Check username
    log('4. Testing POST /api/v1/auth/check-username...');
    r = await request('POST', '/api/v1/auth/check-username', {
      username: 'testuser'
    });
    log(`   Status: ${r.status}`);
    log(`   Response: ${JSON.stringify(r.body || r.error)}\n`);

    log('\n=== Tests Complete ===');
    process.exit(0);
  } catch (error) {
    log('ERROR: ' + error.message);
    process.exit(1);
  }
}

runTests();

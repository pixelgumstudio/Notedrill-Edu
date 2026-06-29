const http = require('http');

const BASE = 'http://localhost:5000';
let TOKEN = '';
let FOLDER_ID = '';
let NOTE_ID = '';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

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
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(name, status, expected, pass) {
  const icon = pass ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name} - HTTP ${status} (expected ${expected})`);
}

async function run() {
  let r, pass;
  const results = { pass: 0, fail: 0 };

  // 1. Login
  r = await request('POST', '/api/v1/auth/login', { email: 'testclaude@example.com', password: 'TestPass123!' });
  pass = r.status === 200 && r.body.success;
  log('Login', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;
  if (r.body.data?.tokens) TOKEN = r.body.data.tokens.accessToken;

  // 2. Get Me
  r = await request('GET', '/api/v1/auth/me', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('Get Me', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 3. Check Username
  r = await request('POST', '/api/v1/auth/check-username', { username: 'testnew' });
  pass = r.status === 200 && r.body.success;
  log('Check Username', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 4. Refresh Token
  if (TOKEN) {
    const loginR = await request('POST', '/api/v1/auth/login', { email: 'testclaude@example.com', password: 'TestPass123!' });
    const refreshToken = loginR.body.data?.tokens?.refreshToken;
    r = await request('POST', '/api/v1/auth/refresh', { refreshToken });
    pass = r.status === 200 && r.body.success;
    log('Refresh Token', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
    if (r.body.data?.tokens) TOKEN = r.body.data.tokens.accessToken;
  }

  // 5. Update Profile
  r = await request('PUT', '/api/v1/auth/profile', { name: 'Claude Updated' }, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('Update Profile', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 6. Complete Signup
  r = await request('POST', '/api/v1/auth/complete-signup', { goals: ['exam-prep'], contentTypes: ['text'] }, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('Complete Signup', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 7. No auth test
  r = await request('GET', '/api/v1/auth/me');
  pass = r.status === 401;
  log('No Auth - Get Me', r.status, 401, pass);
  pass ? results.pass++ : results.fail++;

  // === FOLDERS ===
  console.log('\n--- Folder Endpoints ---');

  // 8. Create Folder
  r = await request('POST', '/api/v1/folders', { name: 'Test Folder', color: '#FF0000' }, TOKEN);
  pass = r.status === 201 && r.body.success;
  log('Create Folder', r.status, 201, pass);
  pass ? results.pass++ : results.fail++;
  if (r.body.data?._id) FOLDER_ID = r.body.data._id;

  // 9. Get Folders
  r = await request('GET', '/api/v1/folders', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('Get Folders', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 10. Update Folder
  if (FOLDER_ID) {
    r = await request('PUT', `/api/v1/folders/${FOLDER_ID}`, { name: 'Updated Folder', color: '#00FF00' }, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Update Folder', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // === NOTES ===
  console.log('\n--- Note Endpoints ---');

  // 11. Create Note
  r = await request('POST', '/api/v1/notes', { title: 'Test Note', content: 'This is a test note with enough content for testing purposes', sourceType: 'text' }, TOKEN);
  pass = r.status === 201 && r.body.success;
  log('Create Note', r.status, 201, pass);
  pass ? results.pass++ : results.fail++;
  if (r.body.data?._id) NOTE_ID = r.body.data._id;

  // 12. Get Notes
  r = await request('GET', '/api/v1/notes', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('Get Notes', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 13. Get Note by ID
  if (NOTE_ID) {
    r = await request('GET', `/api/v1/notes/${NOTE_ID}`, null, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Get Note by ID', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // 14. Update Note
  if (NOTE_ID) {
    r = await request('PUT', `/api/v1/notes/${NOTE_ID}`, { title: 'Updated Note Title' }, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Update Note', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // 15. Generate Note (text)
  r = await request('POST', '/api/v1/notes/generate', { title: 'Generated Note', sourceType: 'text', content: 'This is content for generating a note from text input.' }, TOKEN);
  pass = r.status === 201 && r.body.success;
  log('Generate Note (text)', r.status, 201, pass);
  pass ? results.pass++ : results.fail++;

  // 16. Search Notes
  r = await request('GET', '/api/v1/notes/search?q=test', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('Search Notes', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // 17. Move Note to Folder
  if (NOTE_ID && FOLDER_ID) {
    r = await request('POST', `/api/v1/notes/${NOTE_ID}/move`, { folderId: FOLDER_ID }, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Move Note to Folder', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // 18. Move Note to Root
  if (NOTE_ID) {
    r = await request('POST', `/api/v1/notes/${NOTE_ID}/move`, { folderId: null }, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Move Note to Root', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // 19. Toggle Note Sharing
  if (NOTE_ID) {
    r = await request('POST', `/api/v1/notes/${NOTE_ID}/share`, null, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Toggle Note Sharing', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // 20. Export Note
  if (NOTE_ID) {
    r = await request('POST', `/api/v1/notes/${NOTE_ID}/export`, { format: 'pdf' }, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Export Note', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // === FLASHCARDS ===
  console.log('\n--- Flashcard Endpoints ---');

  // 21. List Flashcard Sets (empty)
  r = await request('GET', '/api/v1/flashcards', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('List Flashcard Sets', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // === QUIZZES ===
  console.log('\n--- Quiz Endpoints ---');

  // 22. List Quizzes (empty)
  r = await request('GET', '/api/v1/quizzes', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('List Quizzes', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // === CHAT ===
  console.log('\n--- Chat Endpoints ---');

  // 23. List Chat Sessions (empty)
  r = await request('GET', '/api/v1/chat/sessions', null, TOKEN);
  pass = r.status === 200 && r.body.success;
  log('List Chat Sessions', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // === CLEANUP ===
  console.log('\n--- Cleanup ---');

  // 24. Delete Note
  if (NOTE_ID) {
    r = await request('DELETE', `/api/v1/notes/${NOTE_ID}`, null, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Delete Note', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // 25. Delete Folder
  if (FOLDER_ID) {
    r = await request('DELETE', `/api/v1/folders/${FOLDER_ID}`, null, TOKEN);
    pass = r.status === 200 && r.body.success;
    log('Delete Folder', r.status, 200, pass);
    pass ? results.pass++ : results.fail++;
  }

  // === HEALTH ===
  console.log('\n--- Health ---');
  r = await request('GET', '/health');
  pass = r.status === 200 && r.body.status === 'ok';
  log('Health Check', r.status, 200, pass);
  pass ? results.pass++ : results.fail++;

  // === SUMMARY ===
  console.log(`\n=============================`);
  console.log(`RESULTS: ${results.pass} passed, ${results.fail} failed out of ${results.pass + results.fail}`);
  console.log(`=============================`);

  // Cleanup test user
  r = await request('DELETE', '/api/v1/auth/account', null, TOKEN);
  console.log(`Test user cleanup: HTTP ${r.status}`);
}

run().catch(console.error);

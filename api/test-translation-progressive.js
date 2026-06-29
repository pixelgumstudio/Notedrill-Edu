const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function testWithStepByStepDebug() {
  try {
    // Register user
    console.log('📝 Registering...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: `testuser${Date.now()}@test.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      username: `testuser${Date.now()}`
    });

    const token = registerRes.data.data.tokens.accessToken;
    console.log('✅ User registered');

    // Create medium-length note first (to test if the limit is per-request or per-content)
    console.log('\n📝 Test 1: Short content (500 chars)');
    let noteRes = await axios.post(
      `${BASE_URL}/notes`,
      {
        title: 'Short test',
        content: 'Lorem ipsum dolor sit amet. '.repeat(20), // ~500 chars
        sourceType: 'text'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    let noteId = noteRes.data.data._id;

    try {
      const translateRes = await axios.put(
        `${BASE_URL}/notes/${noteId}/translate`,
        { targetLanguage: 'fr' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      );
      console.log('✅ Success - Translated:', translateRes.data.data.content.substring(0, 50));
    } catch (e) {
      console.log('❌ Failed:', e.response?.data?.error);
    }

    // Test 2: Medium content
    console.log('\n📝 Test 2: Medium content (5000 chars)');
    noteRes = await axios.post(
      `${BASE_URL}/notes`,
      {
        title: 'Medium test',
        content: 'Lorem ipsum dolor sit amet. '.repeat(200), // ~5500 chars
        sourceType: 'text'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    noteId = noteRes.data.data._id;

    try {
      const translateRes = await axios.put(
        `${BASE_URL}/notes/${noteId}/translate`,
        { targetLanguage: 'fr' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      );
      console.log('✅ Success - Content length:', translateRes.data.data.content.length);
    } catch (e) {
      console.log('❌ Failed:', e.response?.data?.error);
    }

    // Test 3: Larger content
    console.log('\n📝 Test 3: Large content (20000 chars)');
    noteRes = await axios.post(
      `${BASE_URL}/notes`,
      {
        title: 'Large test',
        content: 'Lorem ipsum dolor sit amet. '.repeat(750), // ~20500 chars
        sourceType: 'text'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    noteId = noteRes.data.data._id;

    try {
      const translateRes = await axios.put(
        `${BASE_URL}/notes/${noteId}/translate`,
        { targetLanguage: 'fr' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 }
      );
      console.log('✅ Success - Content length:', translateRes.data.data.content.length);
    } catch (e) {
      console.log('❌ Failed:', e.response?.data?.error);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }

  process.exit(0);
}

setTimeout(testWithStepByStepDebug, 2000);

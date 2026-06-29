const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

async function testTranslation() {
  try {
    // First, register and login
    console.log('📝 Registering test user...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: `testuser${Date.now()}@test.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      username: `testuser${Date.now()}`
    });

    const token = registerRes.data.data.tokens.accessToken;
    const userId = registerRes.data.data.user.id;
    console.log('✅ User registered');

    // Create a note
    console.log('\n📝 Creating test note...');
    const noteRes = await axios.post(
      `${BASE_URL}/notes`,
      {
        title: 'Translation Test',
        content: 'This is a test note for translation. The translation service should handle this content properly.',
        sourceType: 'text'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const noteId = noteRes.data.data._id;
    console.log('✅ Note created:', noteId);

    // Try to translate the note
    console.log('\n🌐 Attempting translation to French...');
    try {
      const translateRes = await axios.put(
        `${BASE_URL}/notes/${noteId}/translate`,
        { targetLanguage: 'fr' },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000
        }
      );
      console.log('✅ Translation successful!');
      console.log('   Translated content:', translateRes.data.data.content?.substring(0, 100));
    } catch (translateErr) {
      console.log('❌ Translation error:');
      console.log('   Status:', translateErr.response?.status);
      console.log('   Message:', translateErr.response?.data?.message);
      console.log('   Error:', translateErr.response?.data?.error);
      console.log('\n📋 Full error details:');
      console.log(JSON.stringify(translateErr.response?.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
  }

  process.exit(0);
}

setTimeout(testTranslation, 2000);

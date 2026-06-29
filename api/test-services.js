const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/v1';

// Test data
const testEmail = `testservices${Date.now()}@test.com`;
const testPassword = 'TestPassword123!';

async function runTests() {
  let token = '';
  let userId = '';
  let noteId = '';

  try {
    // 1. Register user
    console.log('\n📝 1️⃣ REGISTERING USER...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'Test User',
      username: `testuser${Date.now()}`
    });
    console.log('Response:', JSON.stringify(registerRes.data, null, 2));
    console.log('✅ User registered:', registerRes.data.data?.user?.email || registerRes.data.data?.email);
    token = registerRes.data.data?.tokens?.accessToken;
    userId = registerRes.data.data?.user?._id || registerRes.data.data?._id;

    // 2. Create a test note with content
    console.log('\n📝 2️⃣ CREATING NOTE WITH CONTENT...');
    const noteRes = await axios.post(
      `${BASE_URL}/notes`,
      {
        title: 'Test Note for AI Generation',
        content: 'Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs in chloroplasts and involves two main stages: the light-dependent reactions and the light-independent reactions (Calvin cycle). During photosynthesis, plants absorb carbon dioxide and water, and with the help of sunlight, produce glucose and oxygen. This process is crucial for life on Earth as it produces oxygen and forms the base of most food chains.',
        sourceType: 'text'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Note created:', noteRes.data.data._id);
    noteId = noteRes.data.data._id;
    console.log('   Title:', noteRes.data.data.title);
    console.log('   Summary:', noteRes.data.data.summary || '(empty)');
    console.log('   Content length:', noteRes.data.data.content?.length || 0);

    // 3. Test Quiz Generation
    console.log('\n🎯 3️⃣ TESTING QUIZ GENERATION...');
    try {
      const quizRes = await axios.post(
        `${BASE_URL}/quizzes/generate`,
        {
          noteId: noteId,
          questionCount: 5,
          difficulty: 'medium',
          questionTypes: ['multiple-choice']
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000
        }
      );
      console.log('✅ Quiz generated successfully');
      console.log('   Questions:', quizRes.data.data.questions?.length || 0);
      if (quizRes.data.data.questions && quizRes.data.data.questions[0]) {
        console.log('   Sample Q:', quizRes.data.data.questions[0].questionText?.substring(0, 50));
      }
    } catch (quizErr) {
      console.log('❌ Quiz generation error:', quizErr.response?.data?.message || quizErr.message);
    }

    // 4. Test Flashcard Generation
    console.log('\n📇 4️⃣ TESTING FLASHCARD GENERATION...');
    try {
      const fcRes = await axios.post(
        `${BASE_URL}/flashcards/generate`,
        {
          noteId: noteId,
          cardCount: 5,
          difficulty: 'medium'
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000
        }
      );
      console.log('✅ Flashcards generated successfully');
      console.log('   Cards:', fcRes.data.data.cards?.length || 0);
      if (fcRes.data.data.cards && fcRes.data.data.cards[0]) {
        console.log('   Sample front:', fcRes.data.data.cards[0].front?.substring(0, 50));
      }
    } catch (fcErr) {
      console.log('❌ Flashcard generation error:', fcErr.response?.data?.message || fcErr.message);
    }

    // 5. Verify note was saved correctly
    console.log('\n📋 5️⃣ VERIFYING SAVED NOTE...');
    const getRes = await axios.get(
      `${BASE_URL}/notes/${noteId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    console.log('✅ Note retrieved from DB');
    console.log('   Title:', getRes.data.data.title);
    console.log('   Summary:', getRes.data.data.summary || '(empty - ISSUE!)');
    console.log('   Content length:', getRes.data.data.content?.length || 0);

    console.log('\n' + '═'.repeat(50));
    console.log('🎉 TEST COMPLETE');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }

  process.exit(0);
}

// Wait for server and run tests
setTimeout(runTests, 2000);

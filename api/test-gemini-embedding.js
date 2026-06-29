// Test Gemini API for embedding support
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiEmbedding() {
  try {
    console.log('🔍 Testing Gemini API for embedding support...\n');

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    console.log('✓ API Key found\n');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Try text-embedding-004 model
    console.log('📡 Testing text-embedding-004 model...');
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    const text = 'Hello, this is a test embedding';
    console.log('📝 Text:', text);
    console.log('');

    const result = await model.embedContent(text);

    if (!result.embedding || !result.embedding.values) {
      throw new Error('No embedding values returned');
    }

    console.log('✅ Success!');
    console.log('📊 Embedding dimension:', result.embedding.values.length);
    console.log('📈 Sample values:', result.embedding.values.slice(0, 5));
    console.log('');
    console.log('🎉 Gemini API embeddings are working correctly!');
    console.log('');
    console.log('✨ You can use the Gemini-based embedding service instead of Vertex AI');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');

    if (error.message?.includes('text-embedding-004')) {
      console.error('⚠️  The text-embedding-004 model may not be available via Gemini API');
      console.error('Alternative options:');
      console.error('1. Set up Vertex AI with proper service account permissions');
      console.error('2. Use a different embedding provider (OpenAI, Cohere, etc.)');
      console.error('3. Check if Gemini API supports embeddings in your region');
    }

    process.exit(1);
  }
}

testGeminiEmbedding();

// List available Gemini models for your API key
require('dotenv').config();
const https = require('https');

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('🔍 Checking available models for your API key...\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);

          if (response.models && response.models.length > 0) {
            console.log('✅ Available models:');
            console.log('==================\n');

            response.models.forEach(model => {
              console.log(`📦 Model: ${model.name}`);
              console.log(`   Display Name: ${model.displayName}`);
              console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
              console.log('');
            });

            console.log('\n💡 Use the model name (after "models/") in your gemini.service.ts');
            console.log('\nExample: If model name is "models/gemini-1.5-flash", use "gemini-1.5-flash"');
          } else {
            console.log('⚠️  No models found for this API key');
          }
          resolve();
        } else {
          console.error(`❌ Error: HTTP ${res.statusCode}`);
          console.error(data);
          console.error('\nPossible issues:');
          console.error('1. Invalid API key');
          console.error('2. Generative Language API not enabled in Google Cloud Console');
          console.error('3. Billing not set up');
          console.error('4. Regional restrictions');
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      console.error('❌ Network error:', err.message);
      reject(err);
    });
  });
}

listModels().catch(() => process.exit(1));

// apps/api/src/test-gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...\n');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try models with -latest suffix (these use v1 API)
  const modelsToTest = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro-001',
  ];
  
  for (const modelName of modelsToTest) {
    console.log(`🧪 Testing: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "Hello from NoteDrill!"');
      const text = result.response.text();
      console.log(`✅ SUCCESS with ${modelName}`);
      console.log(`   Response: ${text.substring(0, 50)}...\n`);
      
      console.log(`\n🎉 Use this model in your code: "${modelName}"`);
      return;
      
    } catch (error: any) {
      console.log(`❌ FAILED: ${error.status} - ${error.statusText}`);
      if (error.message.includes('API key not valid')) {
        console.log('   ⚠️ API key issue - check your key at https://aistudio.google.com/app/apikey\n');
        return;
      }
    }
  }
  
  console.log('\n❌ All models failed. Your API key might need to be regenerated.');
  console.log('   Visit: https://aistudio.google.com/app/apikey');
}

testGemini();
// Direct test of translation service
const path = require('path');

// Set environment variables
process.env.GOOGLE_PROJECT_ID = 'notedrill';
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'google-credentials.json');

// Create a test text
const longText = `
Photosynthesis is the process by which plants convert light energy into chemical energy.
It occurs in chloroplasts and involves two main stages: the light-dependent reactions and the light-independent reactions.
During photosynthesis, plants absorb carbon dioxide and water, producing glucose and oxygen.
This process is crucial for life on Earth as it produces oxygen and forms the base of most food chains.
The light-dependent reactions occur in the thylakoid membranes of chloroplasts.
Here, light energy is captured by chlorophyll and other photosynthetic pigments.
This energy is used to split water molecules into hydrogen and oxygen.
The oxygen is released as a byproduct, while the hydrogen ions are used to create ATP and NADPH.
These molecules are essential energy carriers for the next stage of photosynthesis.
The light-independent reactions, also known as the Calvin cycle, occur in the stroma of chloroplasts.
Here, the ATP and NADPH produced by the light reactions are used to convert carbon dioxide into glucose.
This process involves three main stages: carbon fixation, reduction, and regeneration of ribulose bisphosphate.
`.repeat(10); // Make it long

async function test() {
  try {
    console.log(`📝 Testing translation service with ${longText.length} character text...`);
    
    // Import translation service
    const translationService = require('./src/services/translation.service').default;
    
    console.log('\n1️⃣ Testing single text translation (with chunking)...');
    const result1 = await translationService.translateText(longText, 'fr');
    console.log('✅ Success! Translated length:', result1.translatedText.length);
    console.log('   Preview:', result1.translatedText.substring(0, 100));
    
    console.log('\n2️⃣ Testing batch translation (with chunking)...');
    const result2 = await translationService.translateBatch([longText], 'es');
    console.log('✅ Success! Translated length:', result2[0].translatedText.length);
    console.log('   Preview:', result2[0].translatedText.substring(0, 100));
    
    console.log('\n3️⃣ Testing batch with multiple texts...');
    const result3 = await translationService.translateBatch(
      ['Short text to translate', longText, 'Another short text'],
      'de'
    );
    console.log('✅ Success! Translated', result3.length, 'texts');
    result3.forEach((r, i) => {
      console.log(`   Text ${i+1}: ${r.translatedText.length} chars`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

setTimeout(test, 1000);

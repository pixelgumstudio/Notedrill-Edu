const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api/v1';

async function testLongTranslation() {
  try {
    // Register and login
    console.log('📝 Registering test user...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: `testuser${Date.now()}@test.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      username: `testuser${Date.now()}`
    });

    const token = registerRes.data.data.tokens.accessToken;
    console.log('✅ User registered');

    // Create a very long text (simulate long PDF content)
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
    Carbon fixation is the process by which carbon dioxide is incorporated into organic compounds.
    The enzyme RuBisCO catalyzes the addition of carbon dioxide to ribulose bisphosphate.
    This produces a six-carbon compound that immediately splits into two three-carbon compounds called 3-phosphoglycerate.
    In the reduction stage, 3-phosphoglycerate is converted to glyceraldehyde 3-phosphate using ATP and NADPH.
    Some of the glyceraldehyde 3-phosphate is used to synthesize glucose, while the rest is used to regenerate ribulose bisphosphate.
    The regeneration of ribulose bisphosphate completes the Calvin cycle, allowing it to continue.
    Photosynthesis is affected by various environmental factors including light intensity, carbon dioxide concentration, and temperature.
    Plants have evolved various adaptations to maximize photosynthesis under different environmental conditions.
    C3 plants, such as wheat and rice, are most efficient in cool conditions.
    C4 plants, such as corn and sugarcane, are more efficient in hot, dry conditions.
    CAM plants, such as cacti, can open their stomata only at night to conserve water.
    Photosynthesis is not only important for plants but also for the entire biosphere.
    It is the primary source of oxygen in our atmosphere and the base of nearly all food chains.
    Without photosynthesis, life as we know it would not exist.
    The efficiency of photosynthesis varies among different organisms and environmental conditions.
    In optimal conditions, plants can convert about 6 percent of the light energy they receive into chemical energy in the form of glucose.
    This may seem inefficient, but it is actually quite remarkable given the complexity of the process.
    Scientists are working to improve photosynthesis through genetic engineering and biotechnology.
    The goal is to create more efficient crops that can produce more food with fewer resources.
    Understanding photosynthesis is also important for addressing climate change.
    By enhancing photosynthesis, we may be able to increase carbon dioxide uptake and reduce atmospheric levels of this greenhouse gas.
    Photosynthesis occurs in the chloroplasts of plant cells, which are specialized organelles.
    Chloroplasts are surrounded by a double membrane envelope and contain stacked thylakoids called grana.
    The stroma is the fluid-filled space inside the chloroplast where the Calvin cycle takes place.
    Chlorophyll, the main photosynthetic pigment, absorbs light energy and gives plants their green color.
    Other photosynthetic pigments, such as carotenoids and xanthophylls, also contribute to light absorption.
    These pigments are arranged in photosystems, which are complexes of proteins and pigments.
    Photosystem II and Photosystem I are the two main photosystems involved in the light reactions.
    The electron transport chain transfers electrons from Photosystem II to Photosystem I.
    This process is coupled to the pumping of hydrogen ions into the thylakoid lumen.
    The resulting proton gradient drives the synthesis of ATP by the enzyme ATP synthase.
    NADPH is produced when electrons from Photosystem I reduce NADP+.
    The light reactions are thus the "power-generating" stage of photosynthesis.
    The Calvin cycle is the "biosynthetic" stage where glucose is synthesized.
    Both stages are essential for photosynthesis and must be coordinated for optimal efficiency.
    Variations in photosynthetic efficiency have been observed among different plant species and varieties.
    These variations are due to differences in enzyme activity, pigment composition, and structural features.
    Plant breeders have used this knowledge to develop crop varieties with improved photosynthetic efficiency.
    This has resulted in increased yields and improved tolerance to environmental stress.
    Photosynthesis research continues to be an active area of scientific investigation.
    New techniques such as imaging spectroscopy and molecular biology are providing new insights into the process.
    One area of research focuses on improving the efficiency of RuBisCO, the most abundant protein on Earth.
    Another area focuses on understanding the regulation of photosynthesis in response to changing environmental conditions.
    Climate change is expected to alter the environmental conditions under which plants photosynthesize.
    Rising temperatures, changes in precipitation patterns, and increased atmospheric carbon dioxide will all affect photosynthesis.
    Some plants may benefit from increased carbon dioxide levels, while others may suffer from heat stress or drought.
    Understanding how photosynthesis responds to climate change is crucial for predicting crop yields and ecosystem productivity.
    Agriculture depends heavily on photosynthesis, which is why improving photosynthetic efficiency is important for food security.
    Photosynthesis also plays a key role in the global carbon cycle.
    Through photosynthesis, plants remove carbon dioxide from the atmosphere and fix it into organic compounds.
    When these organic compounds are decomposed or combusted, carbon dioxide is released back into the atmosphere.
    This cycling of carbon is essential for maintaining a balance in the composition of our atmosphere.
    Deforestation and the burning of fossil fuels have disrupted this balance, leading to increased atmospheric carbon dioxide levels.
    Photosynthesis by remaining forests and other vegetation can help mitigate this problem by removing some of this excess carbon dioxide.
    However, the rate at which we are adding carbon dioxide to the atmosphere far exceeds the rate at which natural photosynthesis can remove it.
    This is why addressing climate change requires reducing our greenhouse gas emissions as well as protecting existing vegetation.
    Photosynthesis is truly a remarkable process that sustains life on Earth.
    Understanding its mechanisms, efficiency, and regulation is crucial for addressing the challenges of food security and climate change.
    Continued research into photosynthesis will undoubtedly yield valuable insights for both basic science and practical applications.
    `.repeat(5); // Repeat to make it very long

    // Create note with long text
    console.log(`\n📝 Creating note with long content (${longText.length} characters)...`);
    const noteRes = await axios.post(
      `${BASE_URL}/notes`,
      {
        title: 'Long Translation Test',
        content: longText,
        sourceType: 'text'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const noteId = noteRes.data.data._id;
    console.log('✅ Note created');

    // Try to translate the long note
    console.log('\n🌐 Attempting translation of long content to French...');
    console.log(`   Content size: ${longText.length} characters`);
    
    try {
      const startTime = Date.now();
      const translateRes = await axios.put(
        `${BASE_URL}/notes/${noteId}/translate`,
        { targetLanguage: 'fr' },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000 // 60 second timeout for long translation
        }
      );
      const elapsed = Date.now() - startTime;
      
      console.log(`✅ Translation successful! (took ${elapsed}ms)`);
      console.log(`   Translated content length: ${translateRes.data.data.content?.length || 0} characters`);
      console.log(`   Preview: ${translateRes.data.data.content?.substring(0, 150)}...`);
    } catch (translateErr) {
      console.log('❌ Translation failed:');
      console.log('   Status:', translateErr.response?.status);
      console.log('   Message:', translateErr.response?.data?.message);
      if (translateErr.response?.data?.error) {
        console.log('   Error:', translateErr.response.data.error);
      }
      console.log('\n📋 Full error:');
      console.log(JSON.stringify(translateErr.response?.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
  }

  process.exit(0);
}

setTimeout(testLongTranslation, 2000);

// Test if embedding service is working with Google Cloud credentials
require('dotenv').config();
const { PredictionServiceClient } = require('@google-cloud/aiplatform');

async function testEmbedding() {
  try {
    console.log('🔍 Testing Google Cloud Embedding Service...\n');

    // Check environment variables
    console.log('Environment Variables:');
    console.log('✓ GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('✓ GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID);
    console.log('✓ GOOGLE_LOCATION:', process.env.GOOGLE_LOCATION || 'us-central1');
    console.log('');

    const project = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION || 'us-central1';

    if (!project) {
      throw new Error('GOOGLE_PROJECT_ID is not set');
    }

    // Initialize client
    const client = new PredictionServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });

    const endpoint = `projects/${project}/locations/${location}/publishers/google/models/text-embedding-004`;

    console.log('📡 Endpoint:', endpoint);
    console.log('');

    // Test with a simple text
    const instance = {
      content: 'Hello, this is a test embedding',
      task_type: 'RETRIEVAL_DOCUMENT',
    };

    const request = {
      endpoint: endpoint,
      instances: [instance],
    };

    console.log('🚀 Sending prediction request...');
    const [response] = await client.predict(request);

    if (!response.predictions || response.predictions.length === 0) {
      throw new Error('No predictions returned');
    }

    const prediction = response.predictions[0];
    const predictionObj = prediction.structValue?.fields;
    const embeddingsField = predictionObj?.embeddings?.structValue?.fields;
    const valuesField = embeddingsField?.values?.listValue?.values;

    if (!valuesField) {
      throw new Error('Invalid response structure');
    }

    const embedding = valuesField.map((v) => v.numberValue);

    console.log('✅ Success! Generated embedding with dimension:', embedding.length);
    console.log('📊 Sample values:', embedding.slice(0, 5));
    console.log('');
    console.log('🎉 Google Cloud authentication is working correctly!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 16) {
      console.error('\n⚠️  Authentication Error Details:');
      console.error('This is an UNAUTHENTICATED error (code 16)');
      console.error('\nPossible solutions:');
      console.error('1. Verify service account has "Vertex AI User" role');
      console.error('2. Enable Vertex AI API in Google Cloud Console');
      console.error('3. Check billing is enabled for the project');
    }
    process.exit(1);
  }
}

testEmbedding();

// Check Google Cloud setup for Vertex AI
require('dotenv').config();
const https = require('https');

async function checkGoogleCloudSetup() {
  console.log('🔍 Checking Google Cloud Configuration...\n');

  const project = process.env.GOOGLE_PROJECT_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  console.log('Environment Configuration:');
  console.log('✓ Project ID:', project);
  console.log('✓ Credentials Path:', credentialsPath);
  console.log('');

  // Load credentials
  const fs = require('fs');
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    console.log('Service Account Information:');
    console.log('✓ Email:', credentials.client_email);
    console.log('✓ Project ID:', credentials.project_id);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to load credentials file:', error.message);
    process.exit(1);
  }

  console.log('📋 Required Setup Steps:\n');
  console.log('1. Enable Vertex AI API:');
  console.log('   Visit: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=' + project);
  console.log('   Click "Enable" if not already enabled\n');

  console.log('2. Grant Service Account Permissions:');
  console.log('   Visit: https://console.cloud.google.com/iam-admin/iam?project=' + project);
  console.log('   Find service account:', credentials.client_email);
  console.log('   Add role: "Vertex AI User"\n');

  console.log('3. Verify Billing is Enabled:');
  console.log('   Visit: https://console.cloud.google.com/billing/linkedaccount?project=' + project);
  console.log('   Ensure a billing account is linked\n');

  console.log('4. Alternative: Use Gemini API for embeddings instead of Vertex AI');
  console.log('   The Gemini API is simpler and uses API keys instead of service accounts');
  console.log('   Model: text-embedding-004 is available via Gemini API\n');

  console.log('📝 Quick Setup Commands:\n');
  console.log('If you have gcloud CLI installed, run these commands:\n');
  console.log(`gcloud services enable aiplatform.googleapis.com --project=${project}`);
  console.log(`gcloud projects add-iam-policy-binding ${project} \\`);
  console.log(`  --member="serviceAccount:${credentials.client_email}" \\`);
  console.log(`  --role="roles/aiplatform.user"`);
}

checkGoogleCloudSetup().catch(console.error);

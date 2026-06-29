// Clear all notes, folders, and chat sessions from the database
// Run with: node apps/api/clear-database.js

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/notedrill';

async function clearDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // List of collections to clear
    const collectionsToKeep = ['users']; // Keep users
    const collectionsToClear = ['notes', 'folders', 'chatsessions', 'flashcardsets', 'quizzes', 'files'];

    console.log('\n⚠️  WARNING: This will delete all data from the following collections:');
    collectionsToClear.forEach(col => console.log(`   - ${col}`));
    console.log('\n✅ Users will be preserved\n');

    // Get confirmation
    console.log('Starting in 3 seconds... Press Ctrl+C to cancel\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clear each collection
    for (const collectionName of collectionsToClear) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        console.log(`✅ Cleared ${collectionName}: ${result.deletedCount} documents deleted`);
      } catch (error) {
        if (error.message.includes('ns not found')) {
          console.log(`⚠️  Collection ${collectionName} doesn't exist, skipping...`);
        } else {
          console.error(`❌ Error clearing ${collectionName}:`, error.message);
        }
      }
    }

    console.log('\n✨ Database cleaned successfully!');
    console.log('📝 All notes, folders, chat sessions, flashcards, quizzes, and files have been removed.');
    console.log('👤 User accounts preserved.\n');

    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearDatabase();

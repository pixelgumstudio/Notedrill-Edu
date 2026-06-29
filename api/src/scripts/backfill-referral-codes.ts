/**
 * One-time migration: generate my_referral_code for all users who don't have one.
 *
 * Run with:
 *   npx ts-node -r dotenv/config src/scripts/backfill-referral-codes.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User';

async function generateUniqueUserCode(username: string): Promise<string> {
  const prefix = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
    const code = prefix + suffix;
    const exists = await User.findOne({ my_referral_code: code });
    if (!exists) return code;
  }
  return Math.random().toString(36).toUpperCase().slice(2, 10);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in environment');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const users = await User.find({
    $or: [
      { my_referral_code: { $exists: false } },
      { my_referral_code: null },
      { my_referral_code: '' },
    ],
  }).select('_id username my_referral_code');

  console.log(`Found ${users.length} users without a referral code`);

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const code = await generateUniqueUserCode(user.username);
      await User.updateOne({ _id: user._id }, { my_referral_code: code });
      updated++;
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated}/${users.length}`);
      }
    } catch (err) {
      console.error(`Failed for user ${user._id}:`, err);
      failed++;
    }
  }

  console.log(`Done. Updated: ${updated}, Failed: ${failed}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

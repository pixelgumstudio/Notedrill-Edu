/**
 * One-time migration: generate a schoolId for all orgs that don't have one.
 * schoolId was added to the Org schema as `required: true` with no default,
 * which only enforces on new saves — pre-existing orgs never got backfilled.
 *
 * Run with:
 *   npx ts-node -r dotenv/config src/scripts/backfill-school-ids.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Org } from '../models/Org';
import { generateUniqueSchoolId } from '../services/org.service';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in environment');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const orgs = await Org.find({
    $or: [{ schoolId: { $exists: false } }, { schoolId: null }, { schoolId: '' }],
  }).select('_id name schoolId');

  console.log(`Found ${orgs.length} orgs without a School ID`);

  let updated = 0;
  let failed = 0;

  for (const org of orgs) {
    try {
      const schoolId = await generateUniqueSchoolId(org.name);
      await Org.updateOne({ _id: org._id }, { schoolId });
      console.log(`  ${org.name} -> ${schoolId}`);
      updated++;
    } catch (err) {
      console.error(`Failed for org ${org._id} (${org.name}):`, err);
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

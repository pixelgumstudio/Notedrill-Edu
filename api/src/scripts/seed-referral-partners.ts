/**
 * Seed script: Create demo ReferralPartner codes for testing/development
 *
 * Run with: npx ts-node src/scripts/seed-referral-partners.ts
 *
 * Creates demo codes: DEMO, PROMO, TECHBRO, EARLY
 * All codes are active and ready to use during onboarding
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ReferralPartner } from '../models/ReferralPartner';

dotenv.config();

const DEMO_PARTNERS = [
  {
    code: 'DEMO',
    name: 'Demo Code',
    description: 'Test referral code for development',
    is_active: true,
  },
  {
    code: 'PROMO',
    name: 'Promotional Code',
    description: 'Early access promotion code',
    is_active: true,
  },
  {
    code: 'TECHBRO',
    name: 'Tech Influencer',
    description: 'Referral partner from tech community',
    is_active: true,
  },
  {
    code: 'EARLY',
    name: 'Early Adopters',
    description: 'Early adopter program code',
    is_active: true,
  },
];

async function seedReferralPartners() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/notedrill';
    console.log(`Connecting to MongoDB: ${mongoUri}`);

    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Clear existing demo codes
    const deleteResult = await ReferralPartner.deleteMany({
      code: { $in: DEMO_PARTNERS.map(p => p.code) }
    });
    console.log(`✓ Removed ${deleteResult.deletedCount} existing demo codes`);

    // Insert demo partners
    const inserted = await ReferralPartner.insertMany(DEMO_PARTNERS);
    console.log(`✓ Created ${inserted.length} demo referral partners:`);

    inserted.forEach(partner => {
      console.log(`  - ${partner.code}: ${partner.name}`);
    });

    console.log('\n✅ Seeding complete!');
    console.log('\nYou can now test referral codes at onboarding:');
    console.log('  Try entering: DEMO, PROMO, TECHBRO, or EARLY');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

seedReferralPartners();

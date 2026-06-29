import { User } from '../models/User';
import { FREE_TIER_LIMITS, QuotaFeature } from '../config/quota.config';

export class QuotaExceededError extends Error {
  constructor(public readonly feature: QuotaFeature) {
    super(`Free trial limit reached. Upgrade to Pro to continue using ${feature}.`);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Synchronous gate: throws QuotaExceededError when a FREE user has exhausted
 * both their lifetime trial slot and any bonus credits for the feature.
 * PRO users are always allowed through.
 */
export function checkQuota(
  user: { subscription: 'FREE' | 'PRO'; freeUsage: any; bonusCredits?: any },
  feature: QuotaFeature
): void {
  if (user.subscription !== 'FREE') return;

  const count: number = user.freeUsage?.[feature]?.count ?? 0;
  if (count < FREE_TIER_LIMITS[feature]) return;

  const bonus: number = user.bonusCredits?.[feature] ?? 0;
  if (bonus > 0) return;

  throw new QuotaExceededError(feature);
}

/**
 * Persist the quota deduction after a successful generation.
 * - If the lifetime trial slot is not yet consumed, increment freeUsage.count.
 * - Otherwise, decrement bonusCredits (guarded by $gt:0 to avoid going negative).
 * Safe to call fire-and-forget: errors are swallowed internally.
 */
export async function incrementQuota(userId: string, feature: QuotaFeature): Promise<void> {
  try {
    const user = await User.findById(userId)
      .select('subscription freeUsage bonusCredits')
      .lean();

    if (!user || user.subscription !== 'FREE') return;

    const count: number = (user.freeUsage as any)?.[feature]?.count ?? 0;

    if (count < FREE_TIER_LIMITS[feature]) {
      await User.findByIdAndUpdate(userId, {
        $inc: { [`freeUsage.${feature}.count`]: 1 },
      }).exec();
    } else {
      await User.findOneAndUpdate(
        { _id: userId, [`bonusCredits.${feature}`]: { $gt: 0 } },
        { $inc: { [`bonusCredits.${feature}`]: -1 } }
      ).exec();
    }
  } catch (err) {
    console.error(`[quota] Failed to increment ${feature} for user ${userId}:`, err);
  }
}

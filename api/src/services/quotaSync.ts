import { Types } from 'mongoose';
import { Org } from '../models/Org';
import { User } from '../models/User';

const ENTITLED_STATUSES = new Set(['trialing', 'active']);

/**
 * Reconciles quota.service.ts's per-user `User.subscription` flag with the
 * org's real subscription state. quota.service.ts only ever checks
 * `subscription`, so this is the bridge until quota gating reads org state
 * directly — call it whenever an org's subscriptionStatus changes (e.g. from
 * a future gateway webhook), not on a schedule.
 */
export async function syncOrgPlanToUsers(orgId: string): Promise<{ matchedCount: number; modifiedCount: number }> {
  const org = await Org.findById(orgId).lean();
  if (!org) throw Object.assign(new Error('Organisation not found.'), { status: 404 });

  const targetSubscription = ENTITLED_STATUSES.has(org.subscriptionStatus) ? 'PRO' : 'FREE';

  const result = await User.updateMany(
    { orgId: new Types.ObjectId(orgId), subscription: { $ne: targetSubscription } },
    { $set: { subscription: targetSubscription } }
  );

  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

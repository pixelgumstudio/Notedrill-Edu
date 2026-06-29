import axios from 'axios';

export interface RevenueCatSubscriptionStatus {
  isActive: boolean;
  entitlementId?: string;
  expirationDate?: Date;
  originalPurchaseDate?: Date;
  willRenew?: boolean;
}

/**
 * Verify a user's subscription status directly with RevenueCat API.
 * Uses the email as an alias to look up the customer's entitlements.
 *
 * @param email The user's email address (used as RevenueCat alias)
 * @returns Subscription status including active status and entitlement details
 */
export async function verifyRevenueCatSubscription(
  email: string
): Promise<RevenueCatSubscriptionStatus> {
  const apiKey = process.env.REVENUECAT_API_KEY;
  const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID || 'Notedrill Pro';

  if (!apiKey) {
    console.warn('⚠️ REVENUECAT_API_KEY not configured, treating as no active subscription');
    return { isActive: false };
  }

  try {
    // Query RevenueCat API for customer by email alias
    const response = await axios.get<{ customer: any }>(
      `https://api.revenuecat.com/v1/customers/${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const customerInfo = response.data.customer;

    if (!customerInfo) {
      return { isActive: false };
    }

    // Check if the target entitlement is active
    const entitlements = customerInfo.entitlements || {};
    const targetEntitlement = entitlements[entitlementId];

    if (!targetEntitlement || !targetEntitlement.expires_date) {
      return { isActive: false };
    }

    const expirationDate = new Date(targetEntitlement.expires_date);
    const isActive = expirationDate > new Date();

    return {
      isActive,
      entitlementId,
      expirationDate,
      originalPurchaseDate: targetEntitlement.purchase_date
        ? new Date(targetEntitlement.purchase_date)
        : undefined,
      willRenew: targetEntitlement.will_renew,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      // Customer not found in RevenueCat
      return { isActive: false };
    }

    console.error('❌ RevenueCat API error:', {
      status: error.response?.status,
      message: error.message,
      email,
    });

    // Don't fail the restore process if RevenueCat is temporarily down
    // Return false so user is created with FREE tier, can retry later
    return { isActive: false };
  }
}

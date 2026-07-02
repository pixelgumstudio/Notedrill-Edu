import { Request, Response } from 'express';
import crypto from 'crypto';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { Org } from '../models/Org';
import { Transaction } from '../models/Transaction';
import { syncOrgPlanToUsers } from '../services/quotaSync';

function addInterval(date: Date, interval: 'month' | 'year'): Date {
  const next = new Date(date);
  if (interval === 'month') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

async function activateOrgSubscription(params: {
  orgId: string;
  gateway: 'paystack' | 'polar';
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
  currentPeriodEnd: Date;
}): Promise<void> {
  const { orgId, gateway, gatewayCustomerId, gatewaySubscriptionId, currentPeriodEnd } = params;

  await Org.findByIdAndUpdate(orgId, {
    subscriptionStatus: 'active',
    paymentGateway: gateway,
    ...(gatewayCustomerId ? { gatewayCustomerId } : {}),
    ...(gatewaySubscriptionId ? { gatewaySubscriptionId } : {}),
    currentPeriodEnd,
  });

  // CRITICAL: bump every teacher/student in this org to PRO immediately.
  await syncOrgPlanToUsers(orgId);
}

// ── Paystack ──────────────────────────────────────────────────────────────────

async function handlePaystack(req: Request, res: Response): Promise<void> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error('[webhook] PAYSTACK_SECRET_KEY not configured — rejecting webhook');
    res.status(500).send();
    return;
  }

  const rawBody = req.body as Buffer;
  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');

  if (!signature || hash !== signature) {
    console.warn('[webhook] Invalid Paystack signature');
    res.status(401).send();
    return;
  }

  const event = JSON.parse(rawBody.toString('utf8'));

  if (event.event === 'charge.success') {
    const reference: string | undefined = event.data?.reference;
    if (!reference) {
      res.status(400).send();
      return;
    }

    const transaction = await Transaction.findById(reference);
    if (!transaction) {
      console.warn(`[webhook] Paystack charge.success for unknown transaction: ${reference}`);
      res.status(200).send(); // Ack anyway — Paystack retries relentlessly on non-2xx
      return;
    }

    transaction.status = 'success';
    await transaction.save();

    // Paystack's one-off "initialize transaction" charge carries no billing
    // interval (it isn't Paystack's separate Subscriptions API) — this product
    // is sold as an annual plan (see the billing page's "billed yearly" copy).
    await activateOrgSubscription({
      orgId: transaction.orgId.toString(),
      gateway: 'paystack',
      gatewayCustomerId: event.data?.customer?.customer_code,
      currentPeriodEnd: addInterval(new Date(), 'year'),
    });
  }

  res.status(200).send();
}

// ── Polar ─────────────────────────────────────────────────────────────────────

function normalizeHeaders(headers: Request['headers']): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') normalized[key] = value;
    else if (Array.isArray(value)) normalized[key] = value.join(',');
  }
  return normalized;
}

async function handlePolar(req: Request, res: Response): Promise<void> {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] POLAR_WEBHOOK_SECRET not configured — rejecting webhook');
    res.status(500).send();
    return;
  }

  let event;
  try {
    event = validateEvent(req.body as Buffer, normalizeHeaders(req.headers), webhookSecret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.warn('[webhook] Invalid Polar signature');
      res.status(403).send();
      return;
    }
    throw err;
  }

  if (event.type === 'subscription.created' || event.type === 'subscription.updated') {
    const subscription = event.data;
    const metadata = subscription.metadata as Record<string, unknown> | undefined;
    const orgId = metadata?.orgId as string | undefined;
    const transactionId = metadata?.transactionId as string | undefined;

    // Metadata is set on our checkout request in billing.controller.ts and
    // expected to carry through to the resulting subscription — verify this
    // against a real Polar sandbox payload before relying on it in production.
    if (!orgId) {
      console.warn(`[webhook] Polar ${event.type} with no orgId in metadata (subscription ${subscription.id})`);
      res.status(200).send();
      return;
    }

    if (transactionId) {
      await Transaction.findByIdAndUpdate(transactionId, { status: 'success' }).catch(() => {});
    }

    const interval = subscription.recurringInterval === 'month' ? 'month' : 'year';

    await activateOrgSubscription({
      orgId,
      gateway: 'polar',
      gatewayCustomerId: subscription.customerId,
      gatewaySubscriptionId: subscription.id,
      currentPeriodEnd: addInterval(new Date(), interval),
    });
  }

  res.status(200).send();
}

// ── Entry point — dispatches by gateway-specific signature header ─────────────

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.headers['x-paystack-signature']) {
      await handlePaystack(req, res);
    } else if (req.headers['webhook-signature']) {
      await handlePolar(req, res);
    } else {
      res.status(400).send();
    }
  } catch (err: any) {
    console.error('[webhook] Unhandled error:', err.message);
    res.status(500).send();
  }
};

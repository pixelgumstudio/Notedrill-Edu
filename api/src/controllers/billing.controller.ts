import { Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response';
import { requireOrgId } from './org.controller';
import { Org } from '../models/Org';
import { Transaction } from '../models/Transaction';

function isNigeria(registeredCountry: string | undefined): boolean {
  const normalized = (registeredCountry || '').trim().toLowerCase();
  return normalized === 'ng' || normalized === 'nigeria';
}

/**
 * Starts a checkout session with the gateway appropriate for the org's
 * registeredCountry — Paystack for Nigeria, Polar everywhere else — and
 * records a pending Transaction so the future webhook has something to
 * reconcile against.
 */
export const createCheckout = async (req: AuthRequest, res: Response): Promise<void> => {
  const transactionId = new mongoose.Types.ObjectId();

  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const org = await Org.findById(orgId);
    if (!org) {
      res.status(404).json(errorResponse('Organisation not found.', ERROR_CODES.NOT_FOUND));
      return;
    }

    if (!org.amountDue || org.amountDue <= 0) {
      res.status(400).json(errorResponse('Your current plan does not require payment.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const nigeria = isNigeria(org.registeredCountry);
    const gateway: 'paystack' | 'polar' = nigeria ? 'paystack' : 'polar';
    const currency = nigeria ? 'NGN' : 'USD';
    const frontendUrl = process.env.FRONTEND_URL || 'https://edu.notedrill.com';
    const successUrl = `${frontendUrl}/edu/billing?checkout=success`;

    const transaction = await Transaction.create({
      _id: transactionId,
      orgId: org._id,
      gateway,
      gatewayReferenceId: transactionId.toString(),
      amount: org.amountDue,
      currency,
      status: 'pending',
    });

    let checkoutUrl: string | undefined;

    if (nigeria) {
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        res.status(500).json(errorResponse('Paystack is not configured.', ERROR_CODES.SERVER_ERROR));
        return;
      }

      const response = await axios.post<{ data?: { authorization_url?: string } }>(
        'https://api.paystack.co/transaction/initialize',
        {
          email: org.adminEmail,
          amount: Math.round(org.amountDue * 100), // Paystack expects the amount in kobo
          currency,
          reference: transactionId.toString(),
          callback_url: successUrl,
          metadata: { orgId: org._id.toString(), transactionId: transactionId.toString() },
        },
        { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } }
      );

      checkoutUrl = response.data?.data?.authorization_url;
    } else {
      const accessToken = process.env.POLAR_ACCESS_TOKEN;
      const productId = process.env.POLAR_PRODUCT_ID;
      if (!accessToken || !productId) {
        res.status(500).json(errorResponse('Polar is not configured.', ERROR_CODES.SERVER_ERROR));
        return;
      }

      const response = await axios.post<{ id?: string; url?: string }>(
        'https://api.polar.sh/v1/checkouts/',
        {
          products: [productId],
          customer_email: org.adminEmail,
          success_url: successUrl,
          metadata: { orgId: org._id.toString(), transactionId: transactionId.toString() },
        },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );

      checkoutUrl = response.data?.url;

      // Polar assigns its own checkout id — track it instead of our placeholder
      // so a future webhook (keyed on Polar's id) can find this Transaction.
      if (response.data?.id) {
        transaction.gatewayReferenceId = response.data.id;
        await transaction.save();
      }
    }

    if (!checkoutUrl) {
      throw new Error(`${gateway} did not return a checkout URL.`);
    }

    res.json(successResponse({ checkoutUrl }));
  } catch (err: any) {
    await Transaction.findByIdAndUpdate(transactionId, { status: 'failed' }).catch(() => {});
    console.error('[billing] createCheckout error:', err.response?.data ?? err.message);
    res.status(502).json(errorResponse('Could not start checkout. Please try again.', ERROR_CODES.SERVER_ERROR));
  }
};

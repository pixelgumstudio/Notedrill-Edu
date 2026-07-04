import mongoose, { Document, Schema } from 'mongoose';

export type OrgSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export type OrgPaymentGateway = 'paystack' | 'polar' | null;

export interface IOrg extends Document {
  name: string;
  /** The registering admin's personal name — used for their User.name at first login, not the org's name. */
  adminName: string;
  /** Human-readable login/reference ID derived from the org name (e.g. "GREENWOOD-8392"). */
  schoolId: string;
  schoolType: 'university' | 'secondary' | 'primary' | 'tutoring_center' | 'other';
  state: string;
  city: string;
  examFocus: string[];
  estimatedStudents: number;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  amountDue: number;
  seatLimit: number;
  domain?: string;
  adminEmail: string;
  isVerified: boolean;
  /** ISO 3166-1 alpha-2 code (e.g. 'NG'). Drives Paystack-vs-Polar routing in billing.controller.ts. */
  registeredCountry: string;
  // ── Subscription state ──────────────────────────────────────────────────
  subscriptionStatus: OrgSubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
  // ── Gateway-agnostic external references ────────────────────────────────
  paymentGateway: OrgPaymentGateway;
  gatewayCustomerId?: string;
  gatewaySubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrgSchema = new Schema<IOrg>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    schoolId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    schoolType: {
      type: String,
      enum: ['university', 'secondary', 'primary', 'tutoring_center', 'other'],
      required: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    examFocus: {
      type: [String],
      default: [],
    },
    estimatedStudents: {
      type: Number,
      required: true,
      min: 1,
    },
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free',
    },
    amountDue: {
      type: Number,
      default: 0,
    },
    seatLimit: {
      type: Number,
      default: 0,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Defaults to 'NG' since org registration doesn't collect a country yet
    // and every existing org is Nigeria-based; see billing.controller.ts.
    registeredCountry: {
      type: String,
      default: 'NG',
      trim: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid'],
      default: 'trialing',
    },
    trialEndsAt: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    paymentGateway: {
      type: String,
      enum: ['paystack', 'polar', null],
      default: null,
    },
    gatewayCustomerId: {
      type: String,
    },
    gatewaySubscriptionId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

OrgSchema.index({ adminEmail: 1 });
OrgSchema.index({ domain: 1 }, { sparse: true });

// New orgs get a 14-day trial window, stamped once at creation and persisted
// (not a schema-level default, which would silently recompute on every read
// for legacy documents missing the field instead of preserving the original date).
OrgSchema.pre('save', function (next) {
  if (this.isNew && !this.trialEndsAt) {
    this.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }
  next();
});

export const Org = mongoose.model<IOrg>('Org', OrgSchema);

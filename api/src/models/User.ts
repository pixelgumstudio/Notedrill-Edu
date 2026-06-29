import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IReviewStatus {
  lastPromptedDate?: Date;
  promptsThisYear: number;
  hasOptedOut: boolean;
}

export interface IFreeUsageEntry {
  count: number;
}

export interface IFreeUsage {
  notes: IFreeUsageEntry;
  quizzes: IFreeUsageEntry;
  flashcards: IFreeUsageEntry;
  chats: IFreeUsageEntry;
}

export interface IBonusCredits {
  notes: number;
  quizzes: number;
  flashcards: number;
  chats: number;
}

export interface IDeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceName?: string;
  registeredAt: Date;
}

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  username: string;
  subscription: 'FREE' | 'PRO';
  orgId?: Types.ObjectId;
  role: 'student' | 'org_admin' | 'superadmin';
  authMethod?: 'local' | 'google' | 'apple' | 'phone' | 'org_otp';
  supabaseId?: string;
  googleId?: string;
  appleId?: string;
  phoneNumber?: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  hasCompletedSignup: boolean;
  authProvider: 'local' | 'google' | 'apple' | 'phone';
  profilePicture?: string;
  avatarKey?: string;
  // Signup flow data
  goals?: string[];
  contentTypes?: string[];
  reviewStyle?: string;
  frustrations?: string[];
  referralSource?: string;
  referral_code?: string;
  referred_by_partner?: Types.ObjectId;
  my_referral_code?: string;
  referred_by_user?: Types.ObjectId;
  preferredLanguage?: string;
  studyLanguage?: string | null;
  isBanned: boolean;
  lastActiveAt?: Date;
  notesCount: number;
  reviewStatus: IReviewStatus;
  refreshTokenHashes: Array<{
    hash: string;
    createdAt: Date;
    expiresAt: Date;
  }>;
  deviceTokens: IDeviceToken[];
  freeUsage: IFreeUsage;
  bonusCredits: IBonusCredits;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: false, // Not required for OAuth users
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    subscription: {
      type: String,
      enum: ['FREE', 'PRO'],
      default: 'FREE',
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Org',
      sparse: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['student', 'org_admin', 'superadmin'],
      default: 'student',
    },
    authMethod: {
      type: String,
      enum: ['local', 'google', 'apple', 'phone', 'org_otp'],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    appleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true, // Allow null values
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'apple', 'phone'],
      default: 'local',
    },
    profilePicture: {
      type: String,
    },
    avatarKey: {
      type: String,
    },
    hasCompletedSignup: {
      type: Boolean,
      default: false,
    },
    // Signup flow preferences
    goals: [{
      type: String,
    }],
    contentTypes: [{
      type: String,
    }],
    reviewStyle: {
      type: String,
    },
    frustrations: [{
      type: String,
    }],
    referralSource: {
      type: String,
    },
    referral_code: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    referred_by_partner: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralPartner',
      sparse: true,
    },
    my_referral_code: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    referred_by_user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
      enum: ['en', 'en-GB', 'en-AU', 'en-CA', 'es', 'es-MX', 'fr', 'fr-CA', 'de', 'pt', 'pt-PT', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'sk', 'sl', 'hr', 'hu', 'ro', 'el', 'tr', 'ru', 'uk', 'ar', 'ar-AE', 'ar-EG', 'he', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'ur', 'zh-CN', 'zh-TW', 'ja', 'ko', 'vi', 'th', 'ms', 'id', 'ca'],
    },
    studyLanguage: {
      type: String,
      default: null,
      enum: [null, 'en', 'en-GB', 'en-AU', 'en-CA', 'es', 'es-MX', 'fr', 'fr-CA', 'de', 'pt', 'pt-PT', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'sk', 'sl', 'hr', 'hu', 'ro', 'el', 'tr', 'ru', 'uk', 'ar', 'ar-AE', 'ar-EG', 'he', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'pa', 'ur', 'zh-CN', 'zh-TW', 'ja', 'ko', 'vi', 'th', 'ms', 'id', 'ca'],
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    notesCount: {
      type: Number,
      default: 0,
    },
    reviewStatus: {
      lastPromptedDate: { type: Date, default: null },
      promptsThisYear: { type: Number, default: 0 },
      hasOptedOut: { type: Boolean, default: false },
    },
    lastActiveAt: {
      type: Date,
      default: null,
      index: true,
    },
    refreshTokenHashes: {
      type: [
        {
          hash:      { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          expiresAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    freeUsage: {
      notes:      { count: { type: Number, default: 0 } },
      quizzes:    { count: { type: Number, default: 0 } },
      flashcards: { count: { type: Number, default: 0 } },
      chats:      { count: { type: Number, default: 0 } },
    },
    bonusCredits: {
      notes:      { type: Number, default: 0 },
      quizzes:    { type: Number, default: 0 },
      flashcards: { type: Number, default: 0 },
      chats:      { type: Number, default: 0 },
    },
    deviceTokens: {
      type: [
        {
          token:        { type: String, required: true, index: true },
          platform:     { type: String, enum: ['ios', 'android', 'web'], required: true },
          deviceName:   String,
          registeredAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it exists and has been modified (or is new)
  if (!this.password || !this.isModified('password')) return next();

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password for login
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  // OAuth users don't have passwords
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

export const User = mongoose.model<IUser>('User', userSchema);

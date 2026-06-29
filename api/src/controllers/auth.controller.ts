import { Request, Response } from 'express';
import { User } from '../models/User';
import { verifyRefreshToken } from '../utils/jwt';
import { issueAndStoreTokens, hashToken } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';
import { googleOAuthClient } from '../config/google';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response';
import { validatePassword } from '../utils/passwordValidator';
import storageService from '../services/storage.service';

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

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, username } = req.body;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      res.status(400).json(
        errorResponse(
          passwordValidation.errors.join('. '),
          ERROR_CODES.VALIDATION_ERROR
        )
      );
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json(
        errorResponse(
          existingUser.email === email
            ? 'Email already registered'
            : 'Username already taken',
          ERROR_CODES.CONFLICT
        )
      );
      return;
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      username,
    });

    await user.save();
    const referralCode = await generateUniqueUserCode(user.username);
    await User.updateOne({ _id: user._id }, { my_referral_code: referralCode });

    const tokens = await issueAndStoreTokens(user);

    // Return user and tokens
    res.status(201).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            hasCompletedSignup: user.hasCompletedSignup,
            createdAt: user.createdAt,
          },
          tokens,
          isNewUser: true,
        },
        'User registered successfully'
      )
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json(
      errorResponse('Registration failed', ERROR_CODES.SERVER_ERROR)
    );
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email (include password field)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401).json(
        errorResponse('Invalid email or password', ERROR_CODES.UNAUTHORIZED)
      );
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      res.status(401).json(
        errorResponse('Invalid email or password', ERROR_CODES.UNAUTHORIZED)
      );
      return;
    }

    const tokens = await issueAndStoreTokens(user);

    // Return user and tokens
    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            hasCompletedSignup: user.hasCompletedSignup,
            authProvider: user.authProvider,
            profilePicture: user.profilePicture,
            createdAt: user.createdAt,
          },
          tokens,
          isNewUser: false,
        },
        'Login successful'
      )
    );
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json(
      errorResponse('Login failed', ERROR_CODES.SERVER_ERROR)
    );
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // User is attached to request by auth middleware
    let user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json(
        errorResponse('User not found', ERROR_CODES.NOT_FOUND)
      );
      return;
    }

    // Lazily generate referral code for existing users
    if (!user.my_referral_code) {
      const code = await generateUniqueUserCode(user.username);
      user = await User.findByIdAndUpdate(
        user._id,
        { my_referral_code: code },
        { new: true }
      ) ?? user;
    }

    // Count users referred by this user
    const referralCount = await User.countDocuments({ referred_by_user: user._id });

    // Generate fresh presigned URL for uploaded avatar (overrides OAuth URL in response only)
    let resolvedProfilePicture = user.profilePicture;
    if (user.avatarKey) {
      try {
        resolvedProfilePicture = await storageService.getFileUrl(user.avatarKey, 604800);
      } catch (err) {
        console.error('Failed to generate avatar URL:', err);
      }
    }

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: resolvedProfilePicture,
            authProvider: user.authProvider,
            isPhoneVerified: user.isPhoneVerified,
            isEmailVerified: user.isEmailVerified,
            hasCompletedSignup: user.hasCompletedSignup,
            goals: user.goals,
            contentTypes: user.contentTypes,
            reviewStyle: user.reviewStyle,
            notesCount: user.notesCount ?? 0,
            reviewStatus: user.reviewStatus ?? { promptsThisYear: 0, hasOptedOut: false },
            my_referral_code: user.my_referral_code,
            referral_count: referralCount,
            createdAt: user.createdAt,
          },
        },
        'User retrieved successfully'
      )
    );
  } catch (error: any) {
    console.error('Get me error:', error);
    res.status(500).json(
      errorResponse('Failed to get user', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Google OAuth Sign In/Sign Up
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      res.status(400).json(
        errorResponse('Google ID token or access token is required', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    let googleId: string | undefined;
    let email: string | undefined;
    let name: string | undefined;
    let picture: string | undefined;

    if (idToken) {
      // Verify the Google ID token
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        res.status(401).json(
          errorResponse('Invalid Google ID token', ERROR_CODES.UNAUTHORIZED)
        );
        return;
      }

      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } else if (accessToken) {
      // Verify access token by fetching user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoResponse.ok) {
        res.status(401).json(
          errorResponse('Invalid Google access token', ERROR_CODES.UNAUTHORIZED)
        );
        return;
      }

      const userInfo = (await userInfoResponse.json()) as {
        id?: string;
        email?: string;
        name?: string;
        picture?: string;
      };

      // Assign only when the expected types are present
      if (typeof userInfo.id === 'string') {
        googleId = userInfo.id;
      }
      if (typeof userInfo.email === 'string') {
        email = userInfo.email;
      }
      if (typeof userInfo.name === 'string') {
        name = userInfo.name;
      }
      if (typeof userInfo.picture === 'string') {
        picture = userInfo.picture;
      }
    }

    if (!googleId) {
      res.status(401).json(
        errorResponse('Invalid Google token', ERROR_CODES.UNAUTHORIZED)
      );
      return;
    }

    if (!email) {
      res.status(400).json(
        errorResponse('Email not provided by Google', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Check if user exists with this Google ID or email
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    let isNewUser = false;

    if (user) {
      // Update Google ID if user exists with email but not Google ID
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && !user.profilePicture) {
          user.profilePicture = picture;
        }
        await user.save();
      }
    } else {
      // Create new user
      isNewUser = true;
      // Sanitize username: replace any non-alphanumeric/underscore chars with underscore
      const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const username = emailPrefix + '_' + Date.now().toString(36);

      user = new User({
        email,
        name: name || email.split('@')[0],
        username,
        googleId,
        authProvider: 'google',
        profilePicture: picture,
        isEmailVerified: true, // Google emails are verified
      });

      await user.save();
      const referralCode = await generateUniqueUserCode(user.username);
      await User.updateOne({ _id: user._id }, { my_referral_code: referralCode });
    }

    const tokens = await issueAndStoreTokens(user);

    res.status(isNewUser ? 201 : 200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            hasCompletedSignup: user.hasCompletedSignup,
            createdAt: user.createdAt,
          },
          tokens,
          isNewUser,
          needsProfileSetup: !user.hasCompletedSignup,
        },
        isNewUser ? 'User created successfully' : 'Login successful'
      )
    );
  } catch (error: any) {
    console.error('Google auth error:', error);
    res.status(500).json(
      errorResponse('Google authentication failed', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Refresh Token
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json(
        errorResponse('Refresh token is required', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Step 1 — verify the JWT signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json(
          errorResponse('Refresh token expired. Please login again.', ERROR_CODES.TOKEN_EXPIRED)
        );
        return;
      }
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json(
          errorResponse('Invalid refresh token. Please login again.', ERROR_CODES.INVALID_TOKEN)
        );
        return;
      }
      throw error;
    }

    // Step 2 — load user from DB
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json(
        errorResponse('User not found. Please login again.', ERROR_CODES.UNAUTHORIZED)
      );
      return;
    }

    // Step 3 — verify the token exists in the DB (not revoked) and is not expired
    const incomingHash = hashToken(token);
    const now = new Date();
    const tokenIndex = (user.refreshTokenHashes ?? []).findIndex(
      (t) => t.hash === incomingHash && t.expiresAt > now
    );

    if (tokenIndex === -1) {
      // Token was revoked (e.g. logout from another device) or never stored.
      // Treat as a potential replay attack — wipe all sessions for this user.
      user.refreshTokenHashes = [];
      await user.save();
      res.status(401).json(
        errorResponse('Session expired or revoked. Please login again.', ERROR_CODES.UNAUTHORIZED)
      );
      return;
    }

    // Step 4 — rotate: remove the consumed token before issuing a new pair
    user.refreshTokenHashes.splice(tokenIndex, 1);

    // issueAndStoreTokens pushes the new hash and calls user.save()
    const tokens = await issueAndStoreTokens(user);

    res.status(200).json(
      successResponse({ tokens }, 'Token refreshed successfully')
    );
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json(
      errorResponse('Token refresh failed', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Update user profile (for completing profile after OAuth/phone signup)
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, username, preferredLanguage } = req.body;
    const userId = req.user?._id;

    // Check if username is already taken
    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        res.status(400).json(
          errorResponse('Username already taken', ERROR_CODES.CONFLICT)
        );
        return;
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        ...(name && { name }),
        ...(username && { username }),
        ...(preferredLanguage !== undefined && { preferredLanguage }),
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json(
        errorResponse('User not found', ERROR_CODES.NOT_FOUND)
      );
      return;
    }

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
            isPhoneVerified: user.isPhoneVerified,
            isEmailVerified: user.isEmailVerified,
            preferredLanguage: user.preferredLanguage,
            createdAt: user.createdAt,
          },
        },
        'Profile updated successfully'
      )
    );
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json(
      errorResponse('Profile update failed', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Complete signup flow - saves user preferences and marks signup as complete
export const completeSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { goals, contentTypes, reviewStyle, frustrations, referralSource, name, username } = req.body;

    // Check if username is already taken (if provided)
    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        res.status(400).json(
          errorResponse('Username already taken', ERROR_CODES.CONFLICT)
        );
        return;
      }
    }

    let user = await User.findByIdAndUpdate(
      userId,
      {
        hasCompletedSignup: true,
        ...(goals && { goals }),
        ...(contentTypes && { contentTypes }),
        ...(reviewStyle && { reviewStyle }),
        ...(frustrations && { frustrations }),
        ...(referralSource && { referralSource }),
        ...(name && { name }),
        ...(username && { username }),
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json(
        errorResponse('User not found', ERROR_CODES.NOT_FOUND)
      );
      return;
    }

    // Generate referral code if not already set
    if (!user.my_referral_code) {
      const code = await generateUniqueUserCode(user.username);
      user = await User.findByIdAndUpdate(
        userId,
        { my_referral_code: code },
        { new: true }
      ) ?? user;
    }

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            hasCompletedSignup: user.hasCompletedSignup,
            goals: user.goals,
            contentTypes: user.contentTypes,
            reviewStyle: user.reviewStyle,
            my_referral_code: user.my_referral_code,
            createdAt: user.createdAt,
          },
        },
        'Signup completed successfully'
      )
    );
  } catch (error: any) {
    console.error('Complete signup error:', error);
    res.status(500).json(
      errorResponse('Failed to complete signup', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Skip signup flow - marks signup as complete without saving preferences
export const skipSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    const user = await User.findByIdAndUpdate(
      userId,
      { hasCompletedSignup: true },
      { new: true }
    );

    if (!user) {
      res.status(404).json(
        errorResponse('User not found', ERROR_CODES.NOT_FOUND)
      );
      return;
    }

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
            hasCompletedSignup: user.hasCompletedSignup,
            createdAt: user.createdAt,
          },
        },
        'Signup skipped'
      )
    );
  } catch (error: any) {
    console.error('Skip signup error:', error);
    res.status(500).json(
      errorResponse('Failed to skip signup', ERROR_CODES.SERVER_ERROR)
    );
  }
};

/**
 * Check if a username is available
 * @route POST /api/v1/auth/check-username
 * @access Public
 */
export const checkUsernameAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = req.params.username || req.body.username;

    // Validate username format
    if (!username || typeof username !== 'string') {
      res.status(400).json(errorResponse('Username is required', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    // Convert to lowercase for consistent checking
    const lowercaseUsername = username.toLowerCase().trim();

    // Validate username format (3-20 chars, alphanumeric + underscore)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(lowercaseUsername)) {
      res.status(400).json(
        errorResponse(
          'Username must be 3-20 characters (letters, numbers, underscores only)',
          ERROR_CODES.VALIDATION_ERROR
        )
      );
      return;
    }

    // Reserved usernames that cannot be used
    const reservedUsernames = [
      'admin', 'administrator', 'root', 'support', 'help',
      'api', 'www', 'mail', 'ftp', 'localhost', 'notedrill',
      'test', 'demo', 'user', 'guest', 'null', 'undefined'
    ];

    if (reservedUsernames.includes(lowercaseUsername)) {
      res.status(400).json(
        errorResponse(
          'This username is reserved and cannot be used',
          ERROR_CODES.VALIDATION_ERROR
        )
      );
      return;
    }

    // Check if username exists in database
    const existingUser = await User.findOne({ username: lowercaseUsername });

    if (existingUser) {
      res.status(200).json(
        successResponse(
          { available: false, username: lowercaseUsername },
          'Username is already taken'
        )
      );
      return;
    }

    // Username is available
    res.status(200).json(
      successResponse(
        { available: true, username: lowercaseUsername },
        'Username is available'
      )
    );
  } catch (error: any) {
    console.error('Check username availability error:', error);
    res.status(500).json(
      errorResponse('Failed to check username availability', ERROR_CODES.SERVER_ERROR)
    );
  }
};

/**
 * Delete user account and all associated data
 * @route DELETE /api/v1/auth/account
 * @access Private
 */
export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json(errorResponse('Unauthorized', ERROR_CODES.UNAUTHORIZED));
      return;
    }

    // Import models dynamically to avoid circular dependencies
    const Note = (await import('../models/Note')).default;
    const Quiz = (await import('../models/Quiz')).default;
    const FlashcardSet = (await import('../models/FlashcardSet')).default;
    const ChatSession = (await import('../models/ChatSession')).default;
    const Folder = (await import('../models/Folder')).default;
    const File = (await import('../models/File')).default;

    console.log(`Starting account deletion for user: ${userId}`);

    // Delete all user data in parallel for better performance
    await Promise.all([
      Note.deleteMany({ userId }),
      Quiz.deleteMany({ userId }),
      FlashcardSet.deleteMany({ userId }),
      ChatSession.deleteMany({ userId }),
      Folder.deleteMany({ userId }),
      File.deleteMany({ userId }),
    ]);

    console.log(`Deleted all associated data for user: ${userId}`);

    // Finally, delete the user account
    await User.findByIdAndDelete(userId);

    console.log(`Successfully deleted user account: ${userId}`);

    res.status(200).json(
      successResponse(
        { deleted: true },
        'Account and all associated data have been permanently deleted'
      )
    );
  } catch (error: any) {
    console.error('Delete account error:', error);
    res.status(500).json(
      errorResponse('Failed to delete account', ERROR_CODES.SERVER_ERROR)
    );
  }
};

export const uploadProfilePicture = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json(errorResponse('No file provided', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const userId = req.user?._id;
    const file = req.file;

    if (!file.mimetype.startsWith('image/')) {
      res.status(400).json(errorResponse('File must be an image', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json(errorResponse('User not found', ERROR_CODES.NOT_FOUND));
      return;
    }

    if (user.avatarKey) {
      try {
        await storageService.deleteFile(user.avatarKey);
      } catch (err) {
        console.warn('Could not delete old avatar, continuing:', err);
      }
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const avatarPath = `avatars/${userId}/${Date.now()}.${ext}`;
    const fileKey = await storageService.uploadFile(file.buffer, avatarPath, file.mimetype);

    user.avatarKey = fileKey;
    await user.save();

    const profilePictureUrl = await storageService.getFileUrl(fileKey, 604800);

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            profilePicture: profilePictureUrl,
          },
        },
        'Profile picture updated successfully'
      )
    );
  } catch (error: any) {
    console.error('Upload profile picture error:', error);
    res.status(500).json(
      errorResponse('Failed to upload profile picture', ERROR_CODES.SERVER_ERROR)
    );
  }
};


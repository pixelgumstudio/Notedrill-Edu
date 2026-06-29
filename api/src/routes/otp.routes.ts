import { Router } from 'express';
import {
  sendOTP,
  sendSignupOTP,
  sendLoginOTP,
  verifySignupOTP,
  verifyLoginOTP,
  resendOTP,
} from '../controllers/otp.controller';
import { validate } from '../middleware/validate';
import {
  sendOTPSchema,
  verifySignupOTPSchema,
  verifyLoginOTPSchema,
  resendOTPSchema,
} from '@notedrill/validation';

const router = Router();

// Send OTP — unified (new + existing users)
router.post('/send', validate(sendOTPSchema), sendOTP);

// Send OTP (legacy split routes)
router.post('/send/signup', validate(sendOTPSchema), sendSignupOTP);
router.post('/send/login', validate(sendOTPSchema), sendLoginOTP);

// Alias routes for backward compatibility
router.post('/send-signup', validate(sendOTPSchema), sendSignupOTP);
router.post('/send-login', validate(sendOTPSchema), sendLoginOTP);

// Verify OTP
router.post('/verify/signup', validate(verifySignupOTPSchema), verifySignupOTP);
router.post('/verify/login', validate(verifyLoginOTPSchema), verifyLoginOTP);

// Resend OTP
router.post('/resend', validate(resendOTPSchema), resendOTP);

export default router;

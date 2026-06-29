import { Router } from 'express';
import {
  register,
  login,
  getMe,
  googleAuth,
  refreshToken,
  updateProfile,
  completeSignup,
  skipSignup,
  checkUsernameAvailability,
  deleteAccount,
  uploadProfilePicture,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import upload from '../middleware/uploadMiddleware';
import { registerSchema, loginSchema } from '@notedrill/validation';

const router = Router();

router.post('/check-username', checkUsernameAvailability);
router.get('/check-username/:username', checkUsernameAvailability);

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

router.post('/google', googleAuth);

router.post('/refresh-token', refreshToken);
router.post('/refresh', refreshToken);

router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.post('/profile/picture', authenticate, upload.single('file'), uploadProfilePicture);
router.post('/complete-signup', authenticate, completeSignup);
router.post('/skip-signup', authenticate, skipSignup);
router.delete('/account', authenticate, deleteAccount);

export default router;

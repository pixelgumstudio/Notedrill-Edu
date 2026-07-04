import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import {
  registerOrg,
  recoverSchoolIdHandler,
  getOrgDashboard,
  listStudents,
  getOrgStudent,
  getStudentActivity,
  addStudent,
  addStudentsBulk,
  removeStudent,
} from '../controllers/org.controller';
import {
  sendOrgInviteOTP,
  verifyOrgInviteOTP,
  sendStudentLoginOTP,
  verifyStudentLoginOTP,
} from '../controllers/orgAuth.controller';

const router = Router();

// Small dedicated multer instance for CSV roster uploads — kept separate from
// the media-upload middleware, whose allowlist is scoped to images/audio/video/PDF.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2MB is generous for a roster CSV
  fileFilter: (_req, file, cb) => {
    const isCsvMime = ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain'].includes(file.mimetype);
    const isCsvExt = file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsvMime && !isCsvExt) {
      const error: any = new Error('Only CSV files are accepted.');
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

// ── OTP auth — no authentication required ─────────────────────────────────────
// Legacy paths (kept for backwards-compat)
router.post('/auth/otp/send', sendOrgInviteOTP);
router.post('/auth/otp/verify', verifyOrgInviteOTP);
// Frontend-expected paths
router.post('/login/request', sendOrgInviteOTP);
router.post('/login/verify', verifyOrgInviteOTP);
router.post('/student/login/request', sendStudentLoginOTP);
router.post('/student/login/verify', verifyStudentLoginOTP);

// ── Org registration ──────────────────────────────────────────────────────────
// POST /register — public (superadmin-initiated onboarding flow)
router.post('/register', registerOrg);
// POST /recover-school-id — public "forgot your School ID" recovery
router.post('/recover-school-id', recoverSchoolIdHandler);

// ── Dashboard — orgId derived from JWT ───────────────────────────────────────
router.get('/dashboard', authenticate, requireRole('org_admin', 'superadmin'), getOrgDashboard);

// ── Student management — orgId derived from JWT ──────────────────────────────
// Order matters: /students/:id/activity must be registered before /students/:id
router.get('/students', authenticate, requireRole('org_admin', 'superadmin'), listStudents);
router.get('/students/:id/activity', authenticate, requireRole('org_admin', 'superadmin'), getStudentActivity);
router.get('/students/:id', authenticate, requireRole('org_admin', 'superadmin'), getOrgStudent);
router.post('/students', authenticate, requireRole('org_admin', 'superadmin'), addStudent);
router.post(
  '/students/bulk',
  authenticate,
  requireRole('org_admin', 'superadmin'),
  csvUpload.single('file'),
  addStudentsBulk
);
router.delete('/students/:id', authenticate, requireRole('org_admin', 'superadmin'), removeStudent);

export default router;

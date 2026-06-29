import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import {
  registerOrg,
  getOrgDashboard,
  listStudents,
  getOrgStudent,
  getStudentActivity,
  addStudent,
  removeStudent,
} from '../controllers/org.controller';
import {
  sendOrgInviteOTP,
  verifyOrgInviteOTP,
  sendStudentLoginOTP,
  verifyStudentLoginOTP,
} from '../controllers/orgAuth.controller';

const router = Router();

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

// ── Dashboard — orgId derived from JWT ───────────────────────────────────────
router.get('/dashboard', authenticate, requireRole('org_admin', 'superadmin'), getOrgDashboard);

// ── Student management — orgId derived from JWT ──────────────────────────────
// Order matters: /students/:id/activity must be registered before /students/:id
router.get('/students', authenticate, requireRole('org_admin', 'superadmin'), listStudents);
router.get('/students/:id/activity', authenticate, requireRole('org_admin', 'superadmin'), getStudentActivity);
router.get('/students/:id', authenticate, requireRole('org_admin', 'superadmin'), getOrgStudent);
router.post('/students', authenticate, requireRole('org_admin', 'superadmin'), addStudent);
router.delete('/students/:id', authenticate, requireRole('org_admin', 'superadmin'), removeStudent);

export default router;

import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response';
import {
  createOrg,
  getOrgById,
  getOrgStudents,
  getOrgSeatUsage,
  removeStudentFromOrg,
  inviteStudentToOrg,
} from '../services/org.service';
import { orgRegisterSchema } from '@notedrill/validation';
import { User } from '../models/User';
import Note from '../models/Note';
import Quiz from '../models/Quiz';
import FlashcardSet from '../models/FlashcardSet';

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireOrgId(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.orgId;
  if (!orgId) {
    res.status(403).json(errorResponse(
      'Organisation context required. Ensure you are logged in as an org admin.',
      ERROR_CODES.FORBIDDEN
    ));
    return null;
  }
  return orgId;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type StudentStatus = 'active' | 'inactive' | 'never';

function deriveStatus(lastActiveAt: Date | null | undefined, sevenDaysAgo: Date): StudentStatus {
  if (!lastActiveAt) return 'never';
  return lastActiveAt >= sevenDaysAgo ? 'active' : 'inactive';
}

// ── Registration ───────────────────────────────────────────────────────────────

export const registerOrg = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = orgRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const org = await createOrg(parsed.data);
    res.status(201).json(successResponse({ orgId: org._id.toString() }, 'Organisation registered successfully.'));
  } catch (err: any) {
    const status = err.status ?? 500;
    res.status(status).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const getOrgDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    const org = await getOrgById(orgId);
    if (!org) {
      res.status(404).json(errorResponse('Organisation not found.', ERROR_CODES.NOT_FOUND));
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const members = await User.find({ orgId: orgObjectId }, { _id: 1, lastActiveAt: 1 }).lean();
    const memberIds = members.map((m) => m._id);
    const activeStudents = members.filter(
      (m) => (m as any).lastActiveAt && (m as any).lastActiveAt >= sevenDaysAgo
    ).length;

    const [totalNotes, seatUsage, quizzesTaken, flashcardSessions, scoreAgg] = await Promise.all([
      Note.countDocuments({ orgId: orgObjectId, deletedAt: null }),
      getOrgSeatUsage(orgId),
      memberIds.length > 0 ? Quiz.countDocuments({ userId: { $in: memberIds } }) : Promise.resolve(0),
      memberIds.length > 0
        ? FlashcardSet.countDocuments({ userId: { $in: memberIds } })
        : Promise.resolve(0),
      memberIds.length > 0
        ? (Quiz as any).aggregate([
            { $match: { userId: { $in: memberIds }, averageScore: { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$averageScore' } } },
          ])
        : Promise.resolve([]),
    ]);

    const avgScore = Math.round((scoreAgg[0]?.avg ?? 0) * 10) / 10;
    const billingAmount = org.amountDue ? `₦${org.amountDue.toLocaleString()}` : '₦0';
    const billingStatus = org.plan === 'free' ? 'Trial active' : 'Paid';

    res.json(
      successResponse({
        studentCount: seatUsage.used,
        seatLimit: seatUsage.limit,
        activeStudents,
        quizzesTaken,
        flashcardSessions,
        avgScore,
        billingAmount,
        billingStatus,
        totalNotes,
      })
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    res.status(status).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Student list ──────────────────────────────────────────────────────────────

export const listStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const filter = req.query.filter as string | undefined;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rawStudents = await getOrgStudents(orgId);
    if (rawStudents.length === 0) {
      res.json(successResponse([]));
      return;
    }

    const memberIds = rawStudents.map((s: any) => s._id as mongoose.Types.ObjectId);

    // Batch aggregations — avoid N+1 per student
    const [quizAgg, flashAgg] = await Promise.all([
      (Quiz as any).aggregate([
        { $match: { userId: { $in: memberIds } } },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            avgScore: {
              $avg: { $cond: [{ $ifNull: ['$averageScore', false] }, '$averageScore', null] },
            },
          },
        },
      ]),
      (FlashcardSet as any).aggregate([
        { $match: { userId: { $in: memberIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]),
    ]);

    const quizMap = new Map<string, { count: number; avgScore: number | null }>(
      quizAgg.map((q: any) => [q._id.toString(), { count: q.count, avgScore: q.avgScore }])
    );
    const flashMap = new Map<string, number>(
      flashAgg.map((f: any) => [f._id.toString(), f.count])
    );

    let students = rawStudents.map((s: any) => {
      const sid = (s._id as mongoose.Types.ObjectId).toString();
      const lastActiveAt: Date | null = s.lastActiveAt ?? null;
      const quiz = quizMap.get(sid);
      return {
        id: sid,
        name: s.name || s.username,
        email: s.email,
        quizCount: quiz?.count ?? 0,
        avgScore: quiz?.avgScore != null ? Math.round(quiz.avgScore * 10) / 10 : null,
        flashcardCount: flashMap.get(sid) ?? 0,
        lastActive: lastActiveAt ? formatDate(lastActiveAt) : null,
        status: deriveStatus(lastActiveAt, sevenDaysAgo),
      };
    });

    if (filter === 'active') {
      students = students.filter((s) => s.status === 'active');
    } else if (filter === 'never') {
      students = students.filter((s) => s.status === 'never');
    }

    res.json(successResponse(students));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Single student detail ─────────────────────────────────────────────────────

export const getOrgStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const { id: studentId } = req.params;
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    const student = await User.findOne(
      { _id: studentId, orgId: orgObjectId },
      '-password -refreshTokenHashes -deviceTokens'
    ).lean();

    if (!student) {
      res.status(404).json(errorResponse('Student not found in this organisation.', ERROR_CODES.NOT_FOUND));
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    const [quizAgg, flashCount] = await Promise.all([
      (Quiz as any).aggregate([
        { $match: { userId: studentObjectId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgScore: {
              $avg: { $cond: [{ $ifNull: ['$averageScore', false] }, '$averageScore', null] },
            },
          },
        },
      ]),
      FlashcardSet.countDocuments({ userId: studentObjectId }),
    ]);

    const lastActiveAt: Date | null = (student as any).lastActiveAt ?? null;

    res.json(
      successResponse({
        id: studentId,
        name: (student as any).name || (student as any).username,
        email: student.email,
        quizCount: quizAgg[0]?.count ?? 0,
        avgScore: quizAgg[0]?.avgScore != null ? Math.round(quizAgg[0].avgScore * 10) / 10 : null,
        flashcardCount: flashCount,
        lastActive: lastActiveAt ? formatDate(lastActiveAt) : null,
        status: deriveStatus(lastActiveAt, sevenDaysAgo),
      })
    );
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Student activity (quiz + flashcard history) ───────────────────────────────

export const getStudentActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const { id: studentId } = req.params;
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    // Security: ensure this student belongs to the caller's org
    const belongs = await User.exists({ _id: studentId, orgId: orgObjectId });
    if (!belongs) {
      res.status(404).json(errorResponse('Student not found in this organisation.', ERROR_CODES.NOT_FOUND));
      return;
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    const [quizzes, flashcardSets] = await Promise.all([
      Quiz.find({ userId: studentObjectId })
        .populate<{ noteId: { title: string } | null }>('noteId', 'title')
        .sort({ createdAt: -1 })
        .lean(),
      FlashcardSet.find({ userId: studentObjectId })
        .populate<{ noteId: { title: string } | null }>('noteId', 'title')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const quizHistory = quizzes.map((q: any) => ({
      id: (q._id as mongoose.Types.ObjectId).toString(),
      fileTitle: (q.noteId as any)?.title ?? 'Unknown file',
      score: q.averageScore != null ? Math.round(q.averageScore) : 0,
      date: formatDate(new Date(q.createdAt)),
    }));

    const flashcardHistory = flashcardSets.map((f: any) => ({
      id: (f._id as mongoose.Types.ObjectId).toString(),
      fileTitle: (f.noteId as any)?.title ?? 'Unknown file',
      cardsReviewed: f.totalCards ?? (f.cards?.length ?? 0),
      date: formatDate(new Date(f.createdAt)),
    }));

    res.json(successResponse({ quizHistory, flashcardHistory }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Add / invite student ──────────────────────────────────────────────────────

export const addStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const { email, firstName, lastName } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json(errorResponse('A valid email address is required.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const result = await inviteStudentToOrg(orgId, email, firstName, lastName);
    res.json(
      successResponse(result, `Invite sent to ${result.email}. OTP expires in ${result.expiresIn / 60} minutes.`)
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    res.status(status).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Bulk student invite (CSV) ───────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BULK_ROWS = 500;

export const addStudentsBulk = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    if (!req.file) {
      res.status(400).json(errorResponse('A CSV file is required.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    let records: Record<string, string>[];
    try {
      const { parse } = await import('csv-parse/sync');
      records = parse(req.file.buffer, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr: any) {
      res.status(400).json(errorResponse(`Could not parse CSV file: ${parseErr.message}`, ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    if (records.length === 0) {
      res.status(400).json(errorResponse('CSV file has no rows.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    if (records.length > MAX_BULK_ROWS) {
      res.status(400).json(errorResponse(
        `CSV has ${records.length} rows — the maximum per upload is ${MAX_BULK_ROWS}. Split it into smaller files.`,
        ERROR_CODES.VALIDATION_ERROR
      ));
      return;
    }

    let successCount = 0;
    const errors: { email: string; reason: string }[] = [];

    for (const record of records) {
      const email = (record.email ?? '').trim();
      const firstName = (record.firstname ?? '').trim();
      const lastName = (record.lastname ?? '').trim();

      if (!email || !EMAIL_REGEX.test(email)) {
        errors.push({ email: email || '(blank)', reason: 'Missing or invalid email address' });
        continue;
      }
      if (!firstName) {
        errors.push({ email, reason: 'Missing first name' });
        continue;
      }

      try {
        await inviteStudentToOrg(orgId, email, firstName, lastName || undefined);
        successCount += 1;
      } catch (err: any) {
        errors.push({ email, reason: err.message || 'Failed to send invite' });
      }
    }

    res.json(successResponse(
      { successCount, failureCount: errors.length, errors },
      `Invited ${successCount} of ${records.length} students.`
    ));
  } catch (err: any) {
    const status = err.status ?? 500;
    res.status(status).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Remove student ────────────────────────────────────────────────────────────

export const removeStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    const { id: userId } = req.params;
    await removeStudentFromOrg(orgId, userId);
    res.json(successResponse(null, 'Student removed from organisation.'));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, ERROR_CODES.SERVER_ERROR));
  }
};

// ── Legacy export (kept so any lingering imports don't break at compile time) ──
/** @deprecated Use addStudent. Route is now POST /org/students */
export const inviteStudent = addStudent;

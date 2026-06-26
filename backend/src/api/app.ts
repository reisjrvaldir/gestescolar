import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { isDbConfigured } from '../db/pool';
import { plansRouter } from './routes/plans';
import { studentsRouter } from './routes/students';
import { staffRouter } from './routes/staff';
import { classesRouter } from './routes/classes';
import { gradesRouter } from './routes/grades';
import { attendanceRouter } from './routes/attendance';
import { meRouter } from './routes/me';
import { invoicesRouter } from './routes/invoices';
import { expensesRouter } from './routes/expenses';
import { settingsRouter } from './routes/settings';
import { schoolPlansRouter } from './routes/schoolPlans';
import { dashboardRouter } from './routes/dashboard';
import { ticketsRouter } from './routes/tickets';
import { lgpdRouter } from './routes/lgpd';
import { calendarRouter } from './routes/calendar';
import { timeclockRouter } from './routes/timeclock';
import { schedulesRouter } from './routes/schedules';
import { messagesRouter } from './routes/messages';
import { leaveRequestsRouter } from './routes/leaveRequests';
import { staffDocumentsRouter } from './routes/staffDocuments';
import { cronRouter } from './routes/cron';
import { webhooksRouter } from './routes/webhooks';

export const app = express();

// --- Security headers ---
app.use(helmet({ contentSecurityPolicy: false }));

// --- CORS restrito a origens conhecidas ---
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'https://gestescolar.com.br',
  'https://www.gestescolar.com.br',
  'http://localhost:5173',
].filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Blocked by CORS'));
  },
  credentials: true,
}));

// --- Rate limiting global (60 req/min por IP) ---
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

// Rate limit severo para auth/onboarding (5 req/min por IP)
const authLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { code: 'rate_limit', message: 'Muitas tentativas. Aguarde 1 minuto.' } });
app.use('/api/me/onboarding', authLimiter);

app.use(express.json({ limit: '5mb' }));

// Health check — não depende do banco.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gestescolar-backend', dbConfigured: isDbConfigured });
});

app.use('/api/plans', plansRouter);
app.use('/api/students', studentsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/classes', classesRouter);
app.use('/api/grades', gradesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/me', meRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/school-plans', schoolPlansRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/lgpd', lgpdRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/timeclock', timeclockRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/leave-requests', leaveRequestsRouter);
app.use('/api/staff-documents', staffDocumentsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/webhooks', webhooksRouter);

// 404 padrão
app.use((_req, res) => res.status(404).json({ code: 'not_found', message: 'Rota não encontrada' }));

// Handler de erro global
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API] erro:', err);
  res.status(500).json({ code: 'internal', message: 'Erro interno do servidor' });
});

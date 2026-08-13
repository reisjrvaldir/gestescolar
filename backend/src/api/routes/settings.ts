import { Router } from 'express';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../lib/validateBody';
import { schoolSettingsSchema } from '../../../../shared/schemas';
import { MODULE_CATALOG, type ModuleKey } from '../../../../shared/moduleCatalog';
import { audit } from '../../lib/audit';

const VALID_MODULE_KEYS = new Set<string>(MODULE_CATALOG.map((m) => m.key));

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// Express 4 não encaminha rejeições de handlers async para o error handler
// global automaticamente — sem o try/catch, uma falha no SQL (ex.: coluna
// ausente por migration não aplicada) deixa a requisição pendurada para
// sempre, sem resposta. O cliente fica "Carregando…" indefinidamente.
settingsRouter.get('/', async (req, res) => {
  try {
    const data = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select id, name, legal_name, cnpj, email, phone, logo_url, status,
                subscription_status, trial_ends_at,
                coalesce(late_fine_pct, 0)::float8     as late_fine_pct,
                coalesce(late_interest_pct, 0)::float8 as late_interest_pct
           from public.schools where id = $1`,
        [req.ctx!.schoolId],
      );
      return rows[0] ?? null;
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[settings.get] erro:', err?.message ?? err);
    res.status(500).json({ code: 'settings_load_failed', message: 'Não foi possível carregar as configurações.' });
  }
});

// GET /api/settings/modules — mapa { moduleKey: boolean } dos módulos habilitados.
// Ausência da chave = ativo (default). Retorna o mapa cru — o frontend combina
// com o catálogo para renderizar.
settingsRouter.get('/modules', async (req, res) => {
  try {
    const data = await withTenant(req.ctx!, async (c) => {
      const { rows } = await c.query(
        `select coalesce(enabled_modules, '{}'::jsonb) as enabled_modules
           from public.schools where id = $1`,
        [req.ctx!.schoolId],
      );
      return rows[0]?.enabled_modules ?? {};
    });
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[settings.modules.get] erro:', err?.message ?? err);
    res.status(500).json({ code: 'modules_load_failed', message: 'Não foi possível carregar os módulos.' });
  }
});

// PUT /api/settings/modules — atualiza o mapa de módulos habilitados.
// Filtra chaves fora do catálogo antes de gravar (impede sujeira/injeção).
settingsRouter.put('/modules', requireRole('school_admin', 'superadmin'), async (req, res) => {
  const incoming = (req.body?.enabled_modules ?? {}) as Record<string, unknown>;
  const clean: Record<ModuleKey, boolean> = {} as Record<ModuleKey, boolean>;
  for (const [k, v] of Object.entries(incoming)) {
    if (!VALID_MODULE_KEYS.has(k)) continue;
    if (typeof v !== 'boolean') continue;
    clean[k as ModuleKey] = v;
  }
  try {
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.schools set enabled_modules = $2::jsonb where id = $1`,
        [req.ctx!.schoolId, JSON.stringify(clean)],
      );
      await audit(c, {
        schoolId: req.ctx!.schoolId!, userId: req.ctx!.profileId,
        action: 'MODULES_UPDATED', entityType: 'school', entityId: req.ctx!.schoolId!,
        metadata: { enabled_modules: clean },
      });
    });
    res.json({ ok: true, data: clean });
  } catch (err: any) {
    console.error('[settings.modules.put] erro:', err?.message ?? err);
    res.status(500).json({ code: 'modules_save_failed', message: 'Não foi possível salvar os módulos.' });
  }
});

settingsRouter.put('/', requireRole('school_admin', 'superadmin'), validateBody(schoolSettingsSchema), async (req, res) => {
  const p = req.body as import('../../../../shared/schemas').SchoolSettingsOutput;

  const ALLOWED_COLS = ['name', 'legal_name', 'cnpj', 'email', 'phone', 'logo_url', 'late_fine_pct', 'late_interest_pct'];
  const fields = Object.entries(p).filter(([k, v]) => v !== undefined && ALLOWED_COLS.includes(k));
  if (fields.length === 0) return res.json({ ok: true });

  const sets = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const vals = fields.map(([, v]) => v);

  try {
    await withTenant(req.ctx!, async (c) => {
      await c.query(
        `update public.schools set ${sets} where id = $1`,
        [req.ctx!.schoolId, ...vals],
      );
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[settings.put] erro:', err?.message ?? err);
    res.status(500).json({ code: 'settings_save_failed', message: 'Não foi possível salvar as configurações.' });
  }
});

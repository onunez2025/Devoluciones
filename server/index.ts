import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

import { getRedisClient } from './lib/redis';
import { safeError } from './lib/security';
import { readPoolPromise } from './db';
import { verifyToken, verifyTokenForDownload, APP_IDENTIFIER } from './middleware/auth';

import authRouter from './routes/auth';
import ssoAuthRouter from './routes/ssoAuth';
import devolucionesRouter from './routes/devoluciones';
import uploadRouter from './routes/upload';
import publicEquipmentRouter from './routes/publicEquipment';
import profileRouter from './routes/profile';
import rolesRouter from './routes/roles';
import managementsRouter from './routes/managements';
import c4cRouter from './routes/c4c';
import lookupsRouter from './routes/lookups';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();

// [SECURITY] Proxy de confianza para que express-rate-limit vea la IP real
app.set('trust proxy', 1);

// [SECURITY] CORS — múltiples orígenes desde env, con guard de producción
if (IS_PRODUCTION && !(process.env.ALLOWED_ORIGINS || '').trim()) {
  console.warn('WARNING: ALLOWED_ORIGINS no configurado en producción.');
}
app.use(cors({
  origin: (origin, callback) => {
    if (!IS_PRODUCTION) return callback(null, true);
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// [SECURITY] Cabeceras de seguridad via helmet (incluye CSP)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// [SECURITY] Rate limiting general (1000 req / 15 min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
  store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:dev:' }), // eslint-disable-line @typescript-eslint/no-explicit-any
});
app.use(limiter);

// Auth rate limiter — starts with safe defaults, overwritten from EBM.AppSessionConfig at startup
// keyGenerator: IP + username — cada usuario tiene su propio contador (evita que IP compartida de oficina bloquee a todos)
const authKeyGenerator = (req: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const username = String(req.body?.username || '').toLowerCase().trim().substring(0, 50);
  return `${req.ip}:${username}`;
};
let authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: authKeyGenerator,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' },
  store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:dev:auth:' }), // eslint-disable-line @typescript-eslint/no-explicit-any
});
app.use('/api/auth/login', (req: any, res: any, next: any) => authLimiter(req, res, next)); // eslint-disable-line @typescript-eslint/no-explicit-any

// [SECURITY] Limitar tamaño de body para prevenir DoS
app.use(express.json({ limit: '2mb' }));

const port = process.env.PORT || 3000;

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth/sso', ssoAuthRouter);
app.use('/api/auth', authRouter);
app.use('/api/devoluciones', verifyToken, devolucionesRouter);
app.use('/api/upload', verifyToken, uploadRouter);
app.use('/api/public/equipment', verifyToken, publicEquipmentRouter);
app.use('/api/profile', verifyToken, profileRouter);
app.use('/api/roles', verifyToken, rolesRouter);
app.use('/api/managements', verifyToken, managementsRouter);
app.use('/api/c4c', verifyTokenForDownload, c4cRouter);
// Prefijo amplio -- mapea internamente /equipos/lookup, /sap/lookup, /lookups/* (paths
// originales, no unificados bajo /api/lookups). Montado después de los routers más
// específicos para que sus rutas tengan prioridad si algún path llegara a superponerse.
app.use('/api', verifyToken, lookupsRouter);

// --- APPLICATIONS (AppSwitcher dinámico) ---
app.get('/api/applications', verifyToken, async (req, res) => {
  try {
    const pool = await readPoolPromise;
    const activeOnly = req.query.activeOnly === 'true';
    let query = `
      SELECT
        a.Id as id,
        a.Code as code,
        a.Label as label,
        a.Url as url,
        a.LogoUrl as logo_url,
        CAST(a.IsActive AS BIT) as is_active,
        a.DisplayOrder as display_order,
        a.CreatedAt as created_at,
        b.FontTitle as font_title,
        b.FontSubtitle as font_subtitle,
        b.FontHeader as font_header,
        b.FontSidebar as font_sidebar,
        b.FontTableData as font_table_data,
        b.BaseFontSize as base_font_size,
        b.SidebarWidth as sidebar_width,
        b.SidebarCollapsedWidth as sidebar_collapsed_width,
        b.SidebarDefaultState as sidebar_default_state,
        CAST(ISNULL(b.SidebarHoverExpand, 1) AS BIT) as sidebar_hover_expand,
        CAST(ISNULL(b.SidebarAllowCollapse, 1) AS BIT) as sidebar_allow_collapse,
        b.HeaderHeight as header_height,
        b.TableRowHeight as table_row_height,
        b.TransitionDuration as transition_duration,
        b.RadiusChip as radius_chip,
        b.RadiusButton as radius_button,
        b.RadiusInput as radius_input,
        b.RadiusCard as radius_card,
        b.RadiusModal as radius_modal,
        b.LightPrimary as light_primary,
        b.LightPrimaryForeground as light_primary_foreground,
        b.LightBg as light_bg,
        b.LightCard as light_card,
        b.LightBorder as light_border,
        b.LightTextPrimary as light_text_primary,
        b.LightTextSecondary as light_text_secondary,
        b.DarkPrimary as dark_primary,
        b.DarkPrimaryForeground as dark_primary_foreground,
        b.DarkBg as dark_bg,
        b.DarkCard as dark_card,
        b.DarkBorder as dark_border,
        b.DarkTextPrimary as dark_text_primary,
        b.DarkTextSecondary as dark_text_secondary,
        b.ShadowLevel1 as shadow_level_1,
        b.ShadowLevel2 as shadow_level_2,
        b.ShadowLevel3 as shadow_level_3,
        b.MobileFontScale as mobile_font_scale,
        b.MobileRadiusCard as mobile_radius_card,
        b.MobileRadiusButton as mobile_radius_button,
        b.MobilePaddingScale as mobile_padding_scale
      FROM [dbo].[GAC_APP_TB_CONSOLE_APPLICATIONS] a
      LEFT JOIN [dbo].[GAC_APP_TB_CONSOLE_APP_BRANDING] b ON a.Id = b.ApplicationId
    `;
    if (activeOnly) {
      query += ' WHERE a.IsActive = 1';
    }
    query += ' ORDER BY a.DisplayOrder ASC';

    const result = await pool.request().query(query);

    const apps = result.recordset.map(row => ({
      id: row.id,
      code: row.code,
      label: row.label,
      url: row.url,
      logo_url: row.logo_url,
      is_active: row.is_active,
      display_order: row.display_order,
      created_at: row.created_at,
      sidebar_width: row.sidebar_width,
      sidebar_collapsed_width: row.sidebar_collapsed_width,
      sidebar_default_state: row.sidebar_default_state,
      sidebar_hover_expand: row.sidebar_hover_expand,
      sidebar_allow_collapse: row.sidebar_allow_collapse,
      theme_config: row.font_title ? {
        typography: {
          fontTitle: row.font_title,
          fontSubtitle: row.font_subtitle,
          fontHeader: row.font_header,
          fontSidebar: row.font_sidebar,
          fontTableData: row.font_table_data,
          baseFontSize: row.base_font_size,
        },
        border: {
          radiusChip: row.radius_chip,
          radiusButton: row.radius_button,
          radiusCard: row.radius_card,
          radiusModal: row.radius_modal,
          radiusInput: row.radius_input,
        },
        light: {
          primary: row.light_primary,
          primaryForeground: row.light_primary_foreground,
          background: row.light_bg,
          card: row.light_card,
          border: row.light_border,
          textPrimary: row.light_text_primary,
          textSecondary: row.light_text_secondary,
        },
        dark: {
          primary: row.dark_primary,
          primaryForeground: row.dark_primary_foreground,
          background: row.dark_bg,
          card: row.dark_card,
          border: row.dark_border,
          textPrimary: row.dark_text_primary,
          textSecondary: row.dark_text_secondary,
        },
        layout: {
          sidebarWidth: row.sidebar_width,
          headerHeight: row.header_height,
          tableRowHeight: row.table_row_height,
          transitionDuration: row.transition_duration,
        },
        shadows: {
          level1: row.shadow_level_1,
          level2: row.shadow_level_2,
          level3: row.shadow_level_3,
        },
        responsive: {
          mobileFontScale: row.mobile_font_scale,
          mobileRadiusCard: row.mobile_radius_card,
          mobileRadiusButton: row.mobile_radius_button,
          mobilePaddingScale: row.mobile_padding_scale,
        }
      } : null
    }));

    res.json(apps);
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ error: safeError(err) });
  }
});

// --- Servir Frontend Estático ---

app.use(express.static(path.join(__dirname, '..', 'dist')));

// Manejar rutas de React (SPA)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const errorHandler: express.ErrorRequestHandler = (err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : (err as Error).message });
};
app.use(errorHandler);

interface SessionConfig { rateLimitMaxAttempts: number; rateLimitWindowMinutes: number; }

async function fetchSessionConfig(): Promise<SessionConfig> {
  try {
    const pool = await readPoolPromise;
    const result = await pool.request().input('code', sql.VarChar(20), APP_IDENTIFIER)
      .query('SELECT RateLimitMaxAttempts, RateLimitWindowMinutes FROM EBM.AppSessionConfig WHERE UPPER(AppCode) = UPPER(@code)');
    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      return { rateLimitMaxAttempts: row.RateLimitMaxAttempts, rateLimitWindowMinutes: row.RateLimitWindowMinutes };
    }
  } catch (err: unknown) {
    console.warn('[SessionConfig] Could not fetch from DB, using defaults:', (err as Error).message);
  }
  return { rateLimitMaxAttempts: 20, rateLimitWindowMinutes: 15 };
}

app.listen(port, () => {
  console.log(`🚀 Servidor Devoluciones corriendo en http://localhost:${port}`);
  fetchSessionConfig().then(cfg => {
    authLimiter = rateLimit({
      windowMs: cfg.rateLimitWindowMinutes * 60 * 1000,
      max: cfg.rateLimitMaxAttempts,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: authKeyGenerator,
      message: { error: `Demasiados intentos de inicio de sesión. Espera ${cfg.rateLimitWindowMinutes} minutos.` },
      store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:dev:auth:' }), // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    console.log(`[SessionConfig] Auth limiter: ${cfg.rateLimitMaxAttempts} intentos / ${cfg.rateLimitWindowMinutes} min`);
  }).catch(err => console.error('[SessionConfig] Failed to load rate limit config:', err));
});

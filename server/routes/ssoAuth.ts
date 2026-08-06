import { Router } from 'express';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { readPoolPromise } from '../db';
import { JWT_SECRET, APP_IDENTIFIER } from '../middleware/auth';
import { safeError, sanitizeLog } from '../lib/security';
import { exchangeCodeForToken, getCasdoorUserInfo, getCasdoorAuthorizeUrl } from '../lib/casdoorClient';
import { sendSsoPendingEmail, sendSsoFirstRetryEmail, sendSsoFinalRetryEmail } from '../lib/mailer';

const router = Router();

// ─── Casdoor SSO (Google/Microsoft) ──────────────────────────────────────────
// Login social vía Casdoor (auth.siatc.cloud). La gestión de "Solicitudes de
// Acceso SSO" (aprobar/rechazar) está centralizada en SIATC Console — esta app
// solo emite el login y notifica el lado de la solicitud (pendiente/reintentos).
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const SSO_APP_CODE = 'DEV';
const SSO_APP_LABEL = 'Devoluciones';
const SSO_MAX_RESUBMIT_RETRIES = 2;

function redirectToSsoStatus(res: any, status: 'pending' | 'rejected' | 'error', reason?: string, retriesLeft?: number): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    const params = new URLSearchParams({ status });
    if (reason) params.set('reason', reason);
    if (typeof retriesLeft === 'number') params.set('retriesLeft', String(retriesLeft));
    res.redirect(`${FRONTEND_URL}/sso-status?${params.toString()}`);
}

// GET redirige al login social de Casdoor — mantiene client_id/redirect_uri solo del lado del servidor.
// ?provider=google|microsoft salta la pantalla de selección de Casdoor y va directo a ese proveedor.
// ?resubmit=true marca el intento como una re-solicitud explícita desde la pantalla de rechazo — el
// marcador viaja en el "state" (sobrevive el viaje de ida y vuelta por Casdoor) y se valida en /callback.
router.get('/authorize', (req: any, res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isResubmit = req.query.resubmit === 'true';
    const state = isResubmit ? `resubmit-${uuidv4().replace(/-/g, '')}` : uuidv4().replace(/-/g, '');
    const provider = typeof req.query.provider === 'string' ? req.query.provider : undefined;
    res.redirect(getCasdoorAuthorizeUrl(state, provider));
});

// GET callback de Casdoor tras un login social (Google/Microsoft) — ruta pública, sin verifyToken.
router.get('/callback', async (req: any, res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const code = String(req.query.code || '');
    if (!code) return redirectToSsoStatus(res, 'error', 'Falta el código de autorización.');

    try {
        const accessToken = await exchangeCodeForToken(code);
        const profile = await getCasdoorUserInfo(accessToken);

        const email = (profile.email || '').trim().toLowerCase();
        if (!email) return redirectToSsoStatus(res, 'error', 'Casdoor no devolvió un correo verificado.');

        const pool = await readPoolPromise;

        // 1. ¿Ya existe un usuario real con este correo y con acceso a Devoluciones?
        // Igual que el login normal: se calcula casId (LEFT JOIN EBM.UserCAS) — en Devoluciones
        // el CAS solo filtra datos (RLS), no bloquea el login como en Gestor FSM.
        const userResult = await pool.request()
            .input('email', sql.NVarChar(sql.MAX), email)
            .input('app', sql.NVarChar(sql.MAX), APP_IDENTIFIER)
            .query(`
                SELECT u.Id as id, u.Username as username, u.RoleId as role_id, r.Name as role_name,
                       u.Apps as apps, CAST(u.IsActive AS BIT) as is_active, uc.CASId as cas_id
                FROM [EBM].[Users] u
                LEFT JOIN [EBM].[Roles] r ON u.RoleId = r.Id
                LEFT JOIN [EBM].[UserCAS] uc ON u.Id = uc.UserId
                WHERE u.Email = @email AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
            `);
        const user = userResult.recordset[0];

        if (user && user.is_active) {
            const permsResult = await pool.request()
                .input('roleId', sql.UniqueIdentifier, user.role_id)
                .query('SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @roleId');
            const perms = permsResult.recordset.map((p: any) => p.Permission); // eslint-disable-line @typescript-eslint/no-explicit-any

            const token = jwt.sign(
                {
                    id: user.id, role_id: user.role_id, role: user.role_name, username: user.username,
                    permissions: perms, apps: user.apps, casId: user.cas_id || null,
                    // Fase 20: ssoPilot solo se firma si no hay un COOKIE_DOMAIN propio configurado (ej.
                    // producción real todavía sin dominio QA aislado). Con COOKIE_DOMAIN configurada
                    // (entorno QA, dominio .qa.siatc.cloud), se omite para permitir la cookie compartida
                    // real entre las 10 apps QA sin arriesgar sesiones de producción.
                    ...(process.env.COOKIE_DOMAIN ? {} : { ssoPilot: true }),
                },
                JWT_SECRET,
                { expiresIn: '12h' }
            );

            const params = new URLSearchParams({ ssoToken: token });
            return res.redirect(`${FRONTEND_URL}/sso-login?${params.toString()}`);
        }

        if (user && !user.is_active) {
            return redirectToSsoStatus(res, 'rejected', 'Tu cuenta está desactivada. Contacta a un administrador.');
        }

        // 2. No existe (o no tiene acceso a DEV aún): revisar si ya hay una solicitud previa
        const pendingResult = await pool.request()
            .input('email', sql.NVarChar(sql.MAX), email)
            .query(`SELECT TOP 1 Status, RejectionReason, RetryCount FROM EBM.PendingSSORequests WHERE Email = @email ORDER BY RequestedAt DESC`);
        const existing = pendingResult.recordset[0];

        if (existing?.Status === 'pending') {
            return redirectToSsoStatus(res, 'pending');
        }
        if (existing?.Status === 'rejected') {
            const retryCount: number = existing.RetryCount ?? 0;
            const isResubmit = String(req.query.state || '').startsWith('resubmit-');

            if (isResubmit && retryCount < SSO_MAX_RESUBMIT_RETRIES) {
                // Re-solicitud explícita desde la pantalla de rechazo — reabre la misma fila,
                // sin duplicarla, y notifica al usuario que quedó pendiente de nuevo.
                const newRetryCount = retryCount + 1;
                await pool.request()
                    .input('email', sql.NVarChar(sql.MAX), email)
                    .input('retryCount', sql.Int, newRetryCount)
                    .query(`
                        UPDATE EBM.PendingSSORequests
                        SET Status = 'pending', RetryCount = @retryCount, ReviewedBy = NULL,
                            ReviewedAt = NULL, RejectionReason = NULL, AssignedRoleId = NULL,
                            RequestedAt = SYSUTCDATETIME()
                        WHERE Email = @email
                    `);
                if (newRetryCount >= SSO_MAX_RESUBMIT_RETRIES) {
                    await sendSsoFinalRetryEmail(email, SSO_APP_LABEL);
                } else {
                    await sendSsoFirstRetryEmail(email, SSO_APP_LABEL);
                }
                return redirectToSsoStatus(res, 'pending');
            }

            const retriesLeft = Math.max(SSO_MAX_RESUBMIT_RETRIES - retryCount, 0);
            return redirectToSsoStatus(res, 'rejected', existing.RejectionReason, retriesLeft);
        }

        // 3. Crear la solicitud nueva
        // Nota: Casdoor no expone en /api/userinfo cuál proveedor externo (Google/Microsoft) usó
        // el usuario — se guarda genérico como 'sso'. Para distinguirlo habría que consultar la
        // Admin API de Casdoor con el CasdoorUserId, fuera de alcance de este piloto.
        try {
            await pool.request()
                .input('email', sql.VarChar(255), email)
                .input('fullName', sql.VarChar(200), profile.name || profile.preferred_username || null)
                .input('provider', sql.VarChar(50), 'sso')
                .input('casdoorUserId', sql.VarChar(100), profile.sub || '')
                .input('appCode', sql.VarChar(20), SSO_APP_CODE)
                .query(`
                    INSERT INTO EBM.PendingSSORequests (Email, FullName, Provider, CasdoorUserId, AppCode)
                    VALUES (@email, @fullName, @provider, @casdoorUserId, @appCode)
                `);
            await sendSsoPendingEmail(email, SSO_APP_LABEL);
        } catch (insertErr: unknown) {
            // Condición de carrera: dos requests casi simultáneas (doble click, doble pestaña)
            // pueden pasar el chequeo de "no existe" de arriba antes de que cualquiera inserte.
            // El índice único filtrado UX_PendingSSORequests_Email_Pending (Email, WHERE
            // Status='pending') rechaza la segunda con "duplicate key" -- se trata como éxito
            // (alguien más ya ganó la carrera y creó la fila), no como error real.
            const msg = (insertErr as Error)?.message || '';
            if (!msg.includes('duplicate key')) throw insertErr;
        }

        return redirectToSsoStatus(res, 'pending');
    } catch (error: unknown) {
        console.error('[SSO Callback] Error:', safeError(error), sanitizeLog(String(req.query.state || '')));
        return redirectToSsoStatus(res, 'error', 'Ocurrió un error validando tu sesión. Intenta de nuevo.');
    }
});

export default router;

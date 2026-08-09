import { Router } from 'express';
import { dominioCookie } from '../lib/dominioCookie.js';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { readPoolPromise, writePoolPromise } from '../db';
import { verifyToken, JWT_SECRET, APP_IDENTIFIER, clearSharedCookie } from '../middleware/auth';
import { blacklistToken, invalidateAllUserSessions } from '../lib/redis';
import { safeError } from '../lib/security';

const router = Router();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido').max(255),
  password: z.string().min(1, 'Contraseña requerida').max(255),
});

router.post('/login', async (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: 'Datos de login inválidos', details: parseResult.error.issues });
  }
  const { username, password } = parseResult.data;
  try {
    const pool = await writePoolPromise;
    const result = await pool.request()
      .input('u', sql.NVarChar(sql.MAX), username)
      .input('app', sql.NVarChar(sql.MAX), APP_IDENTIFIER)
      .query(`
        SELECT u.*, r.Name as RoleName, uc.CASId as cas_id, c.Nombre_CAS as cas_name, LTRIM(RTRIM(c.Abrev_nombre_colaboradores)) as cas_prefijo,
            r.InactivityTimeoutMinutes as role_timeout, r.WarningBeforeMinutes as role_warning,
            m.Name as management_name
        FROM [EBM].[Users] u
        LEFT JOIN [EBM].[Roles] r ON u.RoleId = r.Id
        LEFT JOIN [EBM].[UserCAS] uc ON u.Id = uc.UserId
        LEFT JOIN [dbo].[GAC_APP_TB_CAS] c ON uc.CASId = c.ID_CAS
        LEFT JOIN [EBM].[Managements] m ON u.ManagementId = m.Id
        WHERE (u.Username = @u OR u.Email = @u)
          AND u.IsActive = 1
          AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
      `);

    const user = result.recordset[0];

    if (!user || !user.PasswordHash || !(await bcrypt.compare(password, user.PasswordHash))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const permsResult = await pool.request()
      .input('rid', sql.UniqueIdentifier, user.RoleId)
      .query("SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @rid");

    const perms = permsResult.recordset.map(p => p.Permission);

    const appCfgResult = await pool.request()
      .input('appCode', sql.VarChar(20), APP_IDENTIFIER)
      .query('SELECT DefaultInactivityTimeoutMinutes, DefaultWarningBeforeMinutes FROM EBM.AppSessionConfig WHERE UPPER(AppCode) = UPPER(@appCode)');
    const appCfg = appCfgResult.recordset[0];
    const timeoutMinutes: number = user.role_timeout ?? appCfg?.DefaultInactivityTimeoutMinutes ?? 30;
    const warningMinutes: number = user.role_warning ?? appCfg?.DefaultWarningBeforeMinutes ?? 2;

    const token = jwt.sign(
      {
        id: user.Id,
        role_id: user.RoleId,
        role: user.RoleName,
        username: user.Username,
        full_name: user.FullName,
        permissions: perms,
        apps: user.Apps || '',
        casId: user.cas_id || null,
        casName: user.cas_name || null,
        casPrefijo: user.cas_prefijo || null
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const ssoToken = jwt.sign(
      { id: user.Id, role: user.RoleName, role_name: user.RoleName, username: user.Username, apps: user.Apps || '', casId: user.cas_id || null },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    if (IS_PRODUCTION) {
      res.cookie('token', ssoToken, {
        domain: dominioCookie(req),
        maxAge: 12 * 60 * 60 * 1000,
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/'
      });
    }

    res.json({
      token,
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        fullName: user.FullName,
        role_name: user.RoleName,
        role: user.RoleName,
        permissions: perms,
        perms: perms,
        apps: user.Apps || '',
        avatarUrl: user.AvatarUrl,
        casName: user.cas_name || null,
        management_id: user.ManagementId || null,
        management_name: user.management_name || null,
        requires_password_change: user.RequiresPasswordChange === 1
      },
      sessionConfig: { timeoutMinutes, warningMinutes }
    });

  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error en Login:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: safeError(error) });
  }
});

router.post('/logout', verifyToken, async (req: any, res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const token = req.headers['authorization']!.split(' ')[1];
    await blacklistToken(token, req.user?.exp ?? 0);
    // Invalida también cualquier otro token del mismo usuario (ej. re-firmado por otra app del
    // ecosistema vía su propio /auth/me) -- un logout debe cerrar la sesión en todas las apps QA,
    // no solo revocar el token puntual que se usó para llamar a este endpoint.
    await invalidateAllUserSessions(req.user?.id);
    // Borrar la cookie compartida aquí mismo (Set-Cookie de la respuesta) en vez de depender
    // solo del document.cookie del cliente, que puede no alcanzar a comprometerse antes de que
    // la página navegue tras el logout.
    clearSharedCookie(res, req);
    res.json({ message: 'Sesión cerrada correctamente.' });
});

// --- Endpoint SSO: emite token fresco con campos app-específicos ---
router.get('/me', verifyToken, async (req: any, res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });

    const pool = await readPoolPromise;
    const userResult = await pool.request()
      .input('id', sql.UniqueIdentifier, userId)
      .input('app', sql.NVarChar(sql.MAX), APP_IDENTIFIER)
      .query(`
        SELECT u.Id, u.Username, u.Email, u.FullName, u.AvatarUrl, r.Name as RoleName, u.RoleId, u.Apps, u.RequiresPasswordChange, uc.CASId as cas_id, c.Nombre_CAS as cas_name, LTRIM(RTRIM(c.Abrev_nombre_colaboradores)) as cas_prefijo,
            u.ManagementId as management_id, m.Name as management_name
        FROM [EBM].[Users] u
        LEFT JOIN [EBM].[Roles] r ON u.RoleId = r.Id
        LEFT JOIN [EBM].[UserCAS] uc ON u.Id = uc.UserId
        LEFT JOIN [dbo].[GAC_APP_TB_CAS] c ON uc.CASId = c.ID_CAS
        LEFT JOIN [EBM].[Managements] m ON u.ManagementId = m.Id
        WHERE u.Id = @id AND u.IsActive = 1
          AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
      `);

    const user = userResult.recordset[0];
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const permsResult = await pool.request()
      .input('rid', sql.UniqueIdentifier, user.RoleId)
      .query("SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @rid");
    const perms = permsResult.recordset.map((p: any) => p.Permission); // eslint-disable-line @typescript-eslint/no-explicit-any

    const freshToken = jwt.sign(
      {
        id: user.Id,
        role_id: user.RoleId,
        role: user.RoleName,
        username: user.Username,
        full_name: user.FullName,
        permissions: perms,
        apps: user.Apps || '',
        casId: user.cas_id || null,
        casName: user.cas_name || null,
        casPrefijo: user.cas_prefijo || null,
        // Propaga el claim del piloto Casdoor al token regenerado — el frontend de esta app
        // también reescribe la cookie compartida por su cuenta en validateSession() (useAuth.tsx),
        // así que necesita poder detectar ssoPilot decodificando este freshToken, no solo el backend.
        ...(req.user?.ssoPilot ? { ssoPilot: true } : {})
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Los tokens marcados ssoPilot=true no deben reescribir la cookie compartida aquí — hoy eso
    // pasa solo cuando NO se esta en el dominio QA aislado (produccion real). En QA el callback
    // de Casdoor deja
    // de firmar ssoPilot=true, así que esta cookie sí se escribe y el SSO cruzado real funciona.
    if (!req.user?.ssoPilot) {
      const ssoToken = jwt.sign(
        { id: user.Id, role: user.RoleName, role_name: user.RoleName, username: user.Username, apps: user.Apps || '', casId: user.cas_id || null },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      if (IS_PRODUCTION) {
        res.cookie('token', ssoToken, {
          domain: dominioCookie(req),
          maxAge: 12 * 60 * 60 * 1000,
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          path: '/'
        });
      }
    }

    res.json({
      token: freshToken,
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        fullName: user.FullName,
        role_name: user.RoleName,
        role: user.RoleName,
        permissions: perms,
        perms: perms,
        apps: user.Apps || '',
        avatarUrl: user.AvatarUrl,
        casName: user.cas_name || null,
        management_id: user.management_id || null,
        management_name: user.management_name || null,
        requires_password_change: user.RequiresPasswordChange === 1
      }
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error en /api/auth/me:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;

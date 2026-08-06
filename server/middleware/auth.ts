import sql from 'mssql';
import jwt from 'jsonwebtoken';
import { writePoolPromise } from '../db';
import { isTokenBlacklisted, isSessionInvalidated } from '../lib/redis';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no configurado. El servidor no puede iniciarse de forma segura.');
  process.exit(1);
}
export const JWT_SECRET = process.env.JWT_SECRET as string;

// Fase 20: dominio de la cookie SSO compartida configurable por entorno. Sin definir, el
// comportamiento es idéntico al de siempre (.siatc.cloud) -- producción real no cambia.
// En QA se configura como .qa.siatc.cloud para aislar la sesión compartida de producción.
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.siatc.cloud';

// Borra la cookie compartida del lado del servidor (Set-Cookie en la respuesta) cuando se
// detecta un token invalidado/blacklisteado. No depende de que el JS del cliente logre borrarla
// antes de la siguiente navegación -- evita el bucle de recarga infinita que eso puede causar
// (ver bitácora Fase 20: la limpieza vía document.cookie + window.location.href en el mismo
// tick no siempre alcanza a comprometerse antes de que la página navegue).
export function clearSharedCookie(res: any): void { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (process.env.NODE_ENV === 'production') {
        res.cookie('token', '', { domain: COOKIE_DOMAIN, maxAge: 0, httpOnly: false, secure: true, sameSite: 'lax', path: '/' });
    }
}

// --- Middleware de Autenticación ---
export const verifyToken = async (req: any, res: any, next: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });

  try {
    const user = jwt.verify(token, JWT_SECRET) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (await isTokenBlacklisted(token)) {
      clearSharedCookie(res);
      return res.status(401).json({ message: 'Sesión cerrada. Inicia sesión nuevamente.' });
    }
    if (await isSessionInvalidated(user.id, user.iat)) {
      clearSharedCookie(res);
      return res.status(401).json({ message: 'Sesión cerrada. Inicia sesión nuevamente.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

// Solo para endpoints GET de descarga de archivos (browser no puede enviar headers en window.location.href)
export const verifyTokenForDownload = async (req: any, res: any, next: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1] || (req.query.token as string);
  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });
  try {
    const user = jwt.verify(token, JWT_SECRET) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (await isTokenBlacklisted(token)) {
      clearSharedCookie(res);
      return res.status(401).json({ message: 'Sesión cerrada. Inicia sesión nuevamente.' });
    }
    if (await isSessionInvalidated(user.id, user.iat)) {
      clearSharedCookie(res);
      return res.status(401).json({ message: 'Sesión cerrada. Inicia sesión nuevamente.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

export const APP_IDENTIFIER = 'DEV';

// Helper for Auditing
export async function logAudit(req: any, action: string, entity: string, entityId: string, details: Record<string, unknown>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const user = req.user;
    if (!user) return;
    const pool = await writePoolPromise;
    await pool.request()
      .input('uid', sql.UniqueIdentifier, user.id)
      .input('un', sql.NVarChar(255), user.full_name || user.username)
      .input('acc', sql.NVarChar(100), action)
      .input('ent', sql.NVarChar(100), entity)
      .input('eid', sql.NVarChar(100), entityId)
      .input('det', sql.NVarChar(sql.MAX), JSON.stringify(details))
      .input('app', sql.VarChar(20), APP_IDENTIFIER)
      .input('ip', sql.VarChar(50), req.ip || null)
      .query(`INSERT INTO [dbo].[GAC_APP_TB_AUDIT_LOG] (UsuarioID, UsuarioNombre, Accion, Entidad, EntidadID, Detalle, ApplicationCode, IPAddress, Fecha)
              VALUES (@uid, @un, @acc, @ent, @eid, @det, @app, @ip, GETDATE())`);
  } catch (err) {
    console.error('❌ Falla en Log de Auditoría DEV:', err);
  }
}

// --- Middleware de Permisos ---
export const checkPermission = (requiredPermission: string) => {
  return (_req: any, res: any, next: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const permissions = _req.user.permissions || (_req.user as any).perms; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (permissions && (permissions.includes(requiredPermission) || permissions.includes('ADMIN'))) {
      return next();
    }
    return res.status(403).json({ message: 'No tiene permisos para realizar esta acción' });
  };
};

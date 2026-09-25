import { z } from 'zod';
import { validateBody } from '../lib/validate.js';
import { Router } from 'express';
import sql from 'mssql';
import bcrypt from 'bcrypt';
import { writePoolPromise } from '../db';
import { safeError } from '../lib/security';

const router = Router();

// PUT /api/profile — autoservicio: cualquier usuario autenticado puede guardar SU PROPIO
// avatar y/o contraseña. A diferencia de PUT /api/users/:id (gateado por checkPermission
// ('USERS_EDIT')), nunca acepta un id por parametro: siempre opera sobre req.user.id, y
// solo toca AvatarUrl/PasswordHash -- nunca username/email/fullName/roleId/managementId/apps.
/**
 * ⚠️ La contraseña NO se validaba: llegaba, se hasheaba y se guardaba, así que un usuario podía dejarse
 * una de UN carácter desde su propio perfil. Barrido del 2026-09-25: pasaba en las aplicaciones que
 * tienen este endpoint, con el mismo código copiado. El mínimo de 8 es el que ya exigía SIATC Console.
 *
 * El campo se llama `password_hash` por historia, pero lo que llega es la contraseña en claro: el hash
 * lo hace este endpoint con bcrypt.
 */
const actualizarPerfilSchema = z.object({
    avatar_url: z.string().max(2048).nullable().optional(),
    password_hash: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(100).optional(),
});

router.put('/', validateBody(actualizarPerfilSchema), async (req: any, res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const { avatar_url, password_hash } = req.body;

    const pool = await writePoolPromise;
    const request = pool.request().input('id', sql.UniqueIdentifier, userId);

    const sets: string[] = [];
    if (avatar_url !== undefined) {
      request.input('avatarUrl', sql.NVarChar(sql.MAX), avatar_url || null);
      sets.push('AvatarUrl = @avatarUrl');
    }
    if (password_hash && String(password_hash).trim() !== '') {
      const hashedPwd = await bcrypt.hash(password_hash, 10);
      request.input('password', sql.NVarChar(sql.MAX), hashedPwd);
      sets.push('PasswordHash = @password', 'RequiresPasswordChange = 0');
    }

    if (sets.length > 0) {
      await request.query(`UPDATE [EBM].[Users] SET ${sets.join(', ')} WHERE Id = @id`);
    }

    const result = await pool.request().input('id', sql.UniqueIdentifier, userId)
      .query('SELECT FullName as fullName, AvatarUrl as avatarUrl, CAST(RequiresPasswordChange AS BIT) as requires_password_change FROM [EBM].[Users] WHERE Id = @id');
    if (result.recordset.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(result.recordset[0]);
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ message: 'Error al actualizar el perfil', error: safeError(error) });
  }
});

export default router;

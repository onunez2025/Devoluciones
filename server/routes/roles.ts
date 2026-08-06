import { Router } from 'express';
import sql from 'mssql';
import { readPoolPromise, writePoolPromise } from '../db';
import { checkPermission, APP_IDENTIFIER } from '../middleware/auth';
import { safeError } from '../lib/security';

const router = Router();

// Listado de roles
router.get('/', async (_req, res) => {
  try {
    const pool = await readPoolPromise;
    const result = await pool.request()
      .input('app', sql.VarChar(255), APP_IDENTIFIER)
      .query(`
        SELECT * FROM [EBM].[Roles]
        WHERE Apps LIKE '%' + @app + '%' OR Apps LIKE '%ADMIN%'
        ORDER BY Name ASC
      `);
    res.json(result.recordset);
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ message: 'Error al obtener roles', error: safeError(error) });
  }
});

// Obtener permisos de un rol
router.get('/:id/permissions', checkPermission('ROLES_VIEW'), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await readPoolPromise;
    const result = await pool.request()
      .input('rid', sql.UniqueIdentifier, id)
      .query("SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @rid");
    res.json(result.recordset.map(p => p.Permission));
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ message: 'Error al obtener permisos', error: safeError(error) });
  }
});

// Actualizar permisos de un rol
router.post('/:id/permissions', checkPermission('ROLES_EDIT'), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  try {
    const pool = await writePoolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('rid', sql.UniqueIdentifier, id)
        .query("DELETE FROM [EBM].[RolePermissions] WHERE RoleId = @rid");

      for (const perm of permissions) {
        await transaction.request()
          .input('rid', sql.UniqueIdentifier, id)
          .input('p', sql.NVarChar(sql.MAX), perm)
          .query("INSERT INTO [EBM].[RolePermissions] (RoleId, Permission) VALUES (@rid, @p)");
      }
      await transaction.commit();
      res.json({ message: 'Permisos actualizados correctamente' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ message: 'Error al actualizar permisos', error: safeError(error) });
  }
});

export default router;

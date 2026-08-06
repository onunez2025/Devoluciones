import { Router } from 'express';
import { readPoolPromise } from '../db';
import { safeError } from '../lib/security';

const router = Router();

// Listado de gerencias
router.get('/', async (_req, res) => {
  try {
    const pool = await readPoolPromise;
    const result = await pool.request().query("SELECT * FROM [EBM].[Managements] ORDER BY Name ASC");
    res.json(result.recordset);
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ message: 'Error al obtener gerencias', error: safeError(error) });
  }
});

export default router;

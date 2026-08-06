import { Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { readPoolPromise, writePoolPromise } from '../db';
import { logAudit } from '../middleware/auth';
import { safeError } from '../lib/security';

const router = Router();

const devolucionSchema = z.object({
  Ticket: z.string().min(1).max(50),
  N_Guia: z.string().max(100).optional().default(''),
  N_Serie: z.string().max(100).optional().default(''),
  Sticker: z.string().max(100).optional().default(''),
  Comentario: z.string().max(500).optional().default(''),
  Adjunto: z.string().max(500).optional().default(''),
});
const updateDevolucionSchema = z.object({
  N_Guia: z.string().max(100).optional(),
  N_Serie: z.string().max(100).optional(),
  Sticker: z.string().max(100).optional(),
  Comentario: z.string().max(500).optional(),
  Adjunto: z.string().max(500).optional(),
});
const batchDevolucionSchema = z.object({
  tickets: z.array(z.object({
    Ticket: z.string().min(1).max(50),
    N_Guia: z.string().max(100).optional(),
    N_Serie: z.string().max(100).optional(),
    Comentario: z.string().max(500).optional(),
  })).min(1, 'Se requiere al menos un ticket'),
});

// Listado de devoluciones con paginación y búsqueda
router.get('/', async (req: any, res) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * limit;

  try {
    const pool = await readPoolPromise;

    let whereClause = '';
    const request = pool.request();

    // RLS: usuario CAS solo ve devoluciones de sus tickets
    const casId = req.user?.casId || null;
    const casJoin = casId
      ? `INNER JOIN [APPGAC].[ServiciosViewSQL] svc ON TRIM(svc.Ticket) = TRIM(d.Ticket) AND svc.IdCAS = @casId`
      : '';
    if (casId) {
      request.input('casId', sql.VarChar(50), casId);
    }

    if (search) {
      whereClause = `
        WHERE d.Ticket LIKE @search
        OR d.N_Serie LIKE @search
        OR f.IdEquipo LIKE @search
      `;
      request.input('search', sql.VarChar(255), `%${search}%`);
    }

    // 1. Obtener el total de registros para paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM [dbo].[GAC_APP_TB_DEVOLUCION] d
      ${search ? 'LEFT JOIN [SIATC].[Dashboard_FSM] f ON d.Ticket = f.Ticket' : ''}
      ${casJoin}
      ${whereClause}
    `;

    const countResult = await request.query(countQuery);
    const totalRecords = countResult.recordset[0].total;

    // 2. Consulta de datos paginados
    const result = await request
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT
          d.Ticket,
          d.N_Guia,
          d.N_Serie,
          d.Sticker,
          d.Comentario,
          CAST(d.Adjunto AS NVARCHAR(MAX)) as Adjunto,
          d.Creado_el as FechaRegistro,
          f.IdEquipo,
          f.NombreCliente,
          f.NombreEquipo,
          f.ComentarioTecnico
        FROM [dbo].[GAC_APP_TB_DEVOLUCION] d
        LEFT JOIN [SIATC].[Dashboard_FSM] f ON d.Ticket = f.Ticket
        ${casJoin}
        ${whereClause}
        ORDER BY d.Creado_el DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    res.json({
      data: result.recordset,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error al obtener devoluciones:', error);
    res.status(500).json({ message: 'Error al obtener devoluciones', error: safeError(error) });
  }
});

// Estadísticas del dashboard
router.get('/stats', async (req: any, res) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const pool = await readPoolPromise;
    const casId = req.user?.casId || null;
    const sqlReq = pool.request();
    // RLS: filtro adicional por empresa CAS si el usuario es CAS
    const casFilter = casId
      ? `AND EXISTS (SELECT 1 FROM [APPGAC].[ServiciosViewSQL] svc WHERE TRIM(svc.Ticket) = TRIM(d.Ticket) AND svc.IdCAS = @casId)`
      : '';
    if (casId) {
      sqlReq.input('casId', sql.VarChar(50), casId);
    }
    const result = await sqlReq.query(`
      SELECT
        (SELECT COUNT(*) FROM [dbo].[GAC_APP_TB_DEVOLUCION] d WHERE 1=1 ${casFilter}) as total,
        (SELECT COUNT(*) FROM [dbo].[GAC_APP_TB_DEVOLUCION] d WHERE CAST(Creado_el AS DATE) = CAST(GETDATE() AS DATE) ${casFilter}) as today,
        (SELECT COUNT(*) FROM [dbo].[GAC_APP_TB_DEVOLUCION] d
         WHERE NOT EXISTS (
           SELECT 1 FROM [dbo].[GACP_APP_TB_INFORME_TECNICO_CERRADO] it
           WHERE TRIM(it.Ticket) = TRIM(d.Ticket)
         ) ${casFilter}) as noDiagnosis
    `);
    res.json(result.recordset[0]);
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// Registro masivo de devoluciones
router.post('/batch', async (req: any, res) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const parsed = batchDevolucionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.issues });
  const { tickets } = parsed.data;
  const username = req.user?.username || 'unknown';

  try {
    const pool = await writePoolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const dev of tickets) {
        await transaction.request()
          .input('Ticket', sql.VarChar(255), dev.Ticket)
          .input('Personal_ST', sql.VarChar(255), username)
          .input('Personal_Ope', sql.VarChar(255), username)
          .input('N_Guia', sql.VarChar(255), dev.N_Guia || '')
          .input('N_Serie', sql.VarChar(255), dev.N_Serie || '')
          .input('Comentario', sql.VarChar(255), dev.Comentario || 'Carga Masiva')
          .input('FechaRegistro', sql.DateTime, new Date())
          .query(`
            INSERT INTO [dbo].[GAC_APP_TB_DEVOLUCION]
            (Ticket, Personal_ST, Personal_Ope, N_Guia, N_Serie, Creado_el, Comentario)
            VALUES (@Ticket, @Personal_ST, @Personal_Ope, @N_Guia, @N_Serie, @FechaRegistro, @Comentario)
          `);
      }
      await transaction.commit();
      await logAudit(req, 'CARGA_MASIVA_DEVOLUCIONES', 'Devolucion', `${tickets.length} tickets`, { tickets: tickets.map(d => d.Ticket) });
      res.status(201).json({ message: `${tickets.length} devoluciones registradas correctamente` });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error en registro masivo:', error);
    res.status(500).json({ message: 'Error al procesar el registro masivo' });
  }
});

// Registro de nueva devolución
router.post('/', async (req: any, res) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const parsed = devolucionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.issues });
  const data = parsed.data;
  const username = req.user?.username || 'unknown';

  try {
    const pool = await writePoolPromise;

    // RLS: usuario CAS solo puede registrar devoluciones de sus propios tickets
    const casId = req.user?.casId || null;
    if (casId) {
      const ownerCheck = await pool.request()
        .input('ticket', sql.VarChar(50), data.Ticket)
        .input('casId', sql.VarChar(50), casId)
        .query(`
          SELECT 1
          FROM [APPGAC].[ServiciosViewSQL] svc
          WHERE TRIM(svc.Ticket) = TRIM(@ticket) AND svc.IdCAS = @casId
        `);
      if (ownerCheck.recordset.length === 0)
        return res.status(403).json({ message: 'El ticket no pertenece a su empresa.' });
    }

    await pool.request()
      .input('Ticket', sql.VarChar(255), data.Ticket)
      .input('Personal_ST', sql.VarChar(255), username)
      .input('Personal_Ope', sql.VarChar(255), username)
      .input('N_Guia', sql.VarChar(255), data.N_Guia)
      .input('N_Serie', sql.VarChar(255), data.N_Serie)
      .input('Sticker', sql.VarChar(255), data.Sticker)
      .input('Comentario', sql.VarChar(255), data.Comentario)
      .input('Adjunto', sql.VarChar(255), data.Adjunto)
      .input('FechaRegistro', sql.DateTime, new Date())
      .query(`
        INSERT INTO [dbo].[GAC_APP_TB_DEVOLUCION]
        (Ticket, Personal_ST, Personal_Ope, N_Guia, N_Serie, Sticker, Comentario, Adjunto, Creado_el)
        VALUES (@Ticket, @Personal_ST, @Personal_Ope, @N_Guia, @N_Serie, @Sticker, @Comentario, @Adjunto, @FechaRegistro)
      `);

    await logAudit(req, 'CREAR_DEVOLUCION', 'Devolucion', data.Ticket, { N_Guia: data.N_Guia, N_Serie: data.N_Serie, Sticker: data.Sticker });
    res.status(201).json({ message: 'Devolución registrada correctamente' });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error al registrar devolución:', error);
    res.status(500).json({ message: 'Error al registrar devolución', error: safeError(error) });
  }
});

// Actualizar devolución existente
router.put('/:ticket', async (req: any, res) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { ticket } = req.params;
  const parsed = updateDevolucionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.issues });
  const data = parsed.data;

  try {
    const pool = await writePoolPromise;

    // RLS: usuario CAS solo puede editar devoluciones de sus tickets
    const casId = req.user?.casId || null;
    if (casId) {
      const ownerCheck = await pool.request()
        .input('ticket', sql.VarChar(50), ticket)
        .input('casId', sql.VarChar(50), casId)
        .query(`
          SELECT 1
          FROM [dbo].[GAC_APP_TB_DEVOLUCION] d
          INNER JOIN [APPGAC].[ServiciosViewSQL] svc ON TRIM(svc.Ticket) = TRIM(d.Ticket)
          WHERE TRIM(d.Ticket) = TRIM(@ticket) AND svc.IdCAS = @casId
        `);
      if (ownerCheck.recordset.length === 0)
        return res.status(403).json({ message: 'La devolución no pertenece a su empresa.' });
    }

    const result = await pool.request()
      .input('Ticket', sql.VarChar(255), ticket)
      .input('N_Guia', sql.VarChar(255), data.N_Guia)
      .input('N_Serie', sql.VarChar(255), data.N_Serie)
      .input('Sticker', sql.VarChar(255), data.Sticker)
      .input('Comentario', sql.VarChar(255), data.Comentario)
      .input('Adjunto', sql.VarChar(255), data.Adjunto)
      .query(`
        UPDATE [dbo].[GAC_APP_TB_DEVOLUCION]
        SET N_Guia = @N_Guia,
            N_Serie = @N_Serie,
            Sticker = @Sticker,
            Comentario = @Comentario,
            Adjunto = @Adjunto
        WHERE Ticket = @Ticket
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'No se encontró la devolución para actualizar' });
    }

    await logAudit(req, 'EDITAR_DEVOLUCION', 'Devolucion', ticket, { N_Guia: data.N_Guia, N_Serie: data.N_Serie, Sticker: data.Sticker, Comentario: data.Comentario });
    res.json({ message: 'Devolución actualizada correctamente' });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error al actualizar devolución:', error);
    res.status(500).json({ message: 'Error al actualizar devolución', error: safeError(error) });
  }
});

export default router;

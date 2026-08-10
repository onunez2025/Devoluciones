import { Router } from 'express';
import sql from 'mssql';
import { readPoolPromise } from '../db';

const router = Router();

// Búsqueda de equipo por ticket para validación previa
// Nota: mapea a GET /api/equipos/lookup/:ticket (path original, no bajo /api/lookups)
router.get('/equipos/lookup/:ticket', async (req, res) => {
  const { ticket } = req.params;
  try {
    const pool = await readPoolPromise;
    const result = await pool.request()
      .input('ticket', sql.VarChar(255), ticket)
      .query(`
        SELECT TOP 1
          f.IdEquipo,
          f.CodigoExternoEquipo,
          f.NombreCliente,
          f.NombreEquipo,
          f.ComentarioTecnico,
          s.VC_referencia as N_Guia
        FROM [SIATC].[Dashboard_FSM] f
        LEFT JOIN [dbo].[GAC_APP_SD_ENTREGAS] s ON f.Ticket = s.VC_pedidocliente
        WHERE f.Ticket = @ticket OR f.LlamadaFSM = @ticket
      `);

    if (result.recordset.length > 0) {
      const equipo = result.recordset[0];
      res.json({
        IdEquipo: equipo.IdEquipo || equipo.CodigoExternoEquipo,
        N_Serie: '',
        N_Guia: equipo.N_Guia || '',
        NombreCliente: equipo.NombreCliente || '',
        NombreEquipo: equipo.NombreEquipo || '',
        ComentarioTecnico: equipo.ComentarioTecnico || ''
      });
    } else {
      res.status(404).json({ message: 'Equipo no encontrado en la base de datos de FSM' });
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error en lookup de equipo:', error);
    res.status(500).json({ message: 'Error interno al buscar el equipo' });
  }
});

// Búsqueda de datos SAP (Guía/Folio) por Ticket
// Nota: mapea a GET /api/sap/lookup/:ticket (path original, no bajo /api/lookups)
router.get('/sap/lookup/:ticket', async (req, res) => {
  const { ticket } = req.params;
  try {
    const pool = await readPoolPromise;
    const result = await pool.request()
      .input('ticket', sql.VarChar(255), ticket)
      .query(`
        SELECT TOP 1 VC_pedidocliente as Ticket, VC_referencia as Folio
        FROM [dbo].[GAC_APP_SD_ENTREGAS]
        WHERE VC_pedidocliente = @ticket OR VC_pedidocliente LIKE '%' + @ticket
      `);

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).json({ message: 'Ticket no encontrado en SAP' });
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('Error en lookup de SAP:', error);
    res.status(500).json({ message: 'Error interno al buscar en SAP' });
  }
});

// Listado de técnicos únicos para carga masiva
router.get('/lookups/technicians', async (_req, res) => {
  try {
    const pool = await readPoolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT TRIM(NombreTecnico + ' ' + ApellidoTecnico) as Tecnico
      FROM [SIATC].[Dashboard_FSM]
      WHERE NombreTecnico IS NOT NULL AND NombreTecnico <> ''
      ORDER BY Tecnico
    `);
    res.json(result.recordset.map(r => r.Tecnico));
  } catch {
    res.status(500).json({ message: 'Error al obtener técnicos' });
  }
});

// Buscar tickets candidatos para carga masiva
router.get('/lookups/tickets-by-period', async (req, res) => {
  const { date, tech } = req.query;
  try {
    const pool = await readPoolPromise;
    const result = await pool.request()
      .input('date', sql.Date, date)
      .input('tech', sql.VarChar(255), tech)
      .query(`
        SELECT
          f.Ticket,
          f.IdEquipo,
          f.CodigoExternoEquipo,
          f.NombreEquipo,
          f.NombreCliente,
          s.VC_referencia as N_Guia,
          f.TrabajoRealizado as Comentario
        FROM [SIATC].[Dashboard_FSM] f
        LEFT JOIN [dbo].[GAC_APP_SD_ENTREGAS] s ON f.Ticket = s.VC_pedidocliente
        WHERE CAST(f.FechaVisita AS DATE) = @date
          AND TRIM(f.NombreTecnico + ' ' + f.ApellidoTecnico) = @tech
          AND NOT EXISTS (SELECT 1 FROM [dbo].[GAC_APP_TB_DEVOLUCION] d WHERE d.Ticket = f.Ticket)
      `);
    res.json(result.recordset);
  } catch {
    res.status(500).json({ message: 'Error al buscar tickets' });
  }
});

export default router;

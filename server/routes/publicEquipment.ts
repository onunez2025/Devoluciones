import { Router } from 'express';
import sql from 'mssql';
import { readPoolPromise } from '../db';
import { safeError, sanitizeLog } from '../lib/security';

const router = Router();

// --- Public View: Historial Técnico ---
router.get('/:idEquipo/history', async (req, res) => {
  const { idEquipo } = req.params;
  const safeId = String(idEquipo).replace(/[\r\n]+/g, ' ');
  console.log(`🔍 [Public] Buscando historial para equipo: ${sanitizeLog(safeId)}`);

  try {
    const pool = await readPoolPromise;

    // Paso 1: Obtener la información básica del equipo (IdCliente y CodigoExterno)
    // Buscamos por Ticket (Indexado), IdEquipo o CodigoExterno
    const infoResult = await pool.request()
      .input('id', sql.NVarChar(sql.MAX), idEquipo)
      .query(`
        SELECT TOP 1 IdCliente, CodigoExternoEquipo
        FROM [SIATC].[Dashboard_FSM]
        WHERE Ticket = @id OR IdEquipo = @id OR CodigoExternoEquipo = @id
        ORDER BY CASE WHEN Ticket = @id THEN 0 ELSE 1 END
      `);

    if (infoResult.recordset.length === 0) {
      console.log(`⚠️ No se encontró información para el ID: ${sanitizeLog(safeId)}`);
      return res.json([]);
    }

    const { IdCliente, CodigoExternoEquipo } = infoResult.recordset[0];
    console.log(`✅ Equipo identificado: Cliente=${IdCliente}, Codigo=${CodigoExternoEquipo}. Buscando historial...`);

    // Paso 2: Buscar el historial usando los identificadores encontrados
    const historyResult = await pool.request()
      .input('idc', sql.NVarChar(sql.MAX), IdCliente)
      .input('cee', sql.NVarChar(sql.MAX), CodigoExternoEquipo)
      .query(`
        SELECT
          f.Ticket,
          f.Estado,
          f.FechaVisita as FechaCierre,
          f.IdEquipo,
          f.CodigoExternoEquipo,
          f.NombreEquipo,
          f.TrabajoRealizado,
          f.ComentarioTecnico,
          f.NombreTecnico + ' ' + f.ApellidoTecnico as Tecnico,
          f.Asunto,
          f.SolicitaNuevaVisita,
          f.MotivoNuevaVisita,
          f.LlamadaFSM,
          f.NombreCliente,
          t.Descripcion as TipoServicio
        FROM [SIATC].[Dashboard_FSM] f
        LEFT JOIN [SIATC].[FSM_TipoServicio] t ON f.IdServicio = t.Id
        WHERE f.IdCliente = @idc
          AND f.CodigoExternoEquipo = @cee
          AND f.Estado = 'Closed'
        ORDER BY f.FechaVisita DESC
      `);

    console.log(`✅ Se encontraron ${historyResult.recordset.length} registros para ${idEquipo}`);
    res.json(historyResult.recordset);
  } catch (error: unknown) {
    console.error(`❌ Error crítico en historial de equipo:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      message: 'Error al cargar el historial del equipo',
      error: safeError(error)
    });
  }
});

export default router;

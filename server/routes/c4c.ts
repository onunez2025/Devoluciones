import { Router } from 'express';
import sql from 'mssql';
import {
    ErrorC4C,
    adjuntosDeObjectId,
    alguno,
    descargarAdjuntoComoSea,
    estaConfigurado,
    igualA,
    mensajePublico,
    pedirFilas,
    soloPdf,
} from '@siatc/c4c-client';
import { readPoolPromise } from '../db';
import { safeError, sanitizeLog } from '../lib/security';

const router = Router();

// --- Integración SAP C4C (OData para PDF) ---
// Usa el cliente compartido `@siatc/c4c-client`. Lo propio de Devoluciones que SÍ se conserva: buscar el
// ticket por cuatro variantes a la vez, y preferir el PDF cuyo nombre suene a informe técnico.
router.get('/pdf/:ticket', async (req, res) => {
  const ticket = String(req.params.ticket ?? '');

  try {
    if (!estaConfigurado()) {
      return res.status(503).json({ message: 'Integración C4C no configurada en el servidor.' });
    }

    const pool = await readPoolPromise;
    const dbTicket = await pool.request()
      .input('ticket', sql.VarChar(255), ticket)
      .query('SELECT TOP 1 LlamadaFSM FROM [SIATC].[Dashboard_FSM] WHERE Ticket = @ticket');

    const llamadaFSM = dbTicket.recordset[0]?.LlamadaFSM;
    const normalizedTicket = ticket.padStart(10, '0');

    // El mismo ticket puede estar en C4C con o sin ceros a la izquierda, y bajo su número de llamada
    // FSM. Se buscan las cuatro variantes de una vez en lugar de encadenar consultas.
    const variantes = [igualA('ID', ticket), igualA('ID', normalizedTicket)];
    if (llamadaFSM) {
      variantes.push(igualA('ID', llamadaFSM));
      variantes.push(igualA('ID', String(llamadaFSM).padStart(10, '0')));
    }

    const encontrados = await pedirFilas(
      `ServiceRequestCollection?$filter=${encodeURIComponent(alguno(...variantes))}&$select=ObjectID,ID,UUID&$format=json`,
    );
    if (encontrados.length === 0) {
      console.warn(`⚠️ [C4C] No se encontró el ticket ${sanitizeLog(ticket)} en SAP con ninguna de sus variantes.`);
      return res.status(404).json({ message: 'No se encontró el ticket en SAP C4C' });
    }

    const objectId = String(encontrados[0].ObjectID);
    const adjuntos = await adjuntosDeObjectId(objectId);
    const pdfs = soloPdf(adjuntos);

    if (pdfs.length === 0) {
      console.warn(`⚠️ [C4C] Ticket ${sanitizeLog(ticket)} encontrado pero sin PDF adjunto.`);
      return res.status(404).json({ message: 'El ticket existe en C4C pero no tiene un Informe Técnico (PDF) adjunto.' });
    }

    // Preferencia propia de Devoluciones: el PDF que suena a informe técnico. Si ninguno lo lleva, vale
    // el más reciente, que es el primero porque los adjuntos vienen ordenados.
    const informe = pdfs.find((a) => /informe|technical|fsm/i.test(a.nombre)) ?? pdfs[0];

    // C4C a veces da la URL de descarga dentro del propio adjunto; cuando viene se usa esa, que es la
    // que este endpoint venía usando (`DocumentLink`). Si no, la ruta estándar desde el ticket.
    const pdf = await descargarAdjuntoComoSea(informe);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${informe.nombre.replace(/["\r\n]/g, '')}"`);
    res.send(pdf);

  } catch (error: unknown) {
    // El status de C4C NO se reenvía al navegador: un 401 suyo llegaría como sesión caducada nuestra.
    const status = error instanceof ErrorC4C && error.clase === 'NO_ENCONTRADO' ? 404 : 502;
    console.error(`❌ [C4C] Error con el ticket ${sanitizeLog(ticket)}:`, safeError(error));
    res.status(status).json({ message: mensajePublico(error) });
  }
});

export default router;

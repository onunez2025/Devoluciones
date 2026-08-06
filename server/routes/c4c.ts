import { Router } from 'express';
import sql from 'mssql';
import axios from 'axios';
import { readPoolPromise } from '../db';
import { safeError } from '../lib/security';

const router = Router();

// --- Integración SAP C4C (OData para PDF) ---
router.get('/pdf/:ticket', async (req, res) => {
  const { ticket } = req.params;
  const username = process.env.C4C_USER;
  const password = process.env.C4C_PASSWORD;
  const baseUrl = process.env.C4C_BASE_URL;

  try {
    const pool = await readPoolPromise;
    const dbTicket = await pool.request()
      .input('ticket', sql.VarChar(255), ticket)
      .query('SELECT TOP 1 LlamadaFSM FROM [SIATC].[Dashboard_FSM] WHERE Ticket = @ticket');

    const llamadaFSM = dbTicket.recordset[0]?.LlamadaFSM;
    const normalizedTicket = ticket.padStart(10, '0');

    console.log(`📡 [C4C] Iniciando búsqueda para Ticket: ${ticket}, FSM: ${llamadaFSM}`);

    // Paso 1: Buscar el ticket para obtener su ObjectID único en SAP
    let filterParts = [`ID eq '${ticket}'`, `ID eq '${normalizedTicket}'`];
    if (llamadaFSM) {
      filterParts.push(`ID eq '${llamadaFSM}'`);
      filterParts.push(`ID eq '${llamadaFSM.toString().padStart(10, '0')}'`);
    }

    const filter = filterParts.join(' or ');
    const findUrl = `${baseUrl}/ServiceRequestCollection?$filter=${encodeURIComponent(filter)}&$select=ObjectID,ID,UUID&$format=json`;

    const authConfig = {
      auth: { username: username || '', password: password || '' },
      headers: { 'Accept': 'application/json' }
    };

    const findResponse = await axios.get(findUrl, authConfig);
    const ticketsFound = findResponse.data?.d?.results || [];

    if (ticketsFound.length === 0) {
      console.warn(`⚠️ [C4C] No se encontró el ticket en SAP con el filtro: ${filter}`);
      return res.status(404).json({ message: 'No se encontró el ticket en SAP C4C' });
    }

    const sapTicket = ticketsFound[0];
    const objectId = sapTicket.ObjectID;
    console.log(`✅ [C4C] Ticket encontrado. ObjectID: ${objectId}`);

    // Paso 2: Navegar directamente a la carpeta de adjuntos usando el ObjectID (Lógica SIATC_Tecnical)
    const attachmentsUrl = `${baseUrl}/ServiceRequestCollection('${objectId}')/ServiceRequestAttachmentFolder?$format=json`;
    console.log(`📂 [C4C] Consultando adjuntos: ${attachmentsUrl}`);

    const attResponse = await axios.get(attachmentsUrl, authConfig);

    // La respuesta puede venir como d.results (colección) o d (objeto único)
    const attData = attResponse.data?.d;
    let attachments = attData?.results || (Array.isArray(attData) ? attData : (attData ? [attData] : []));

    console.log(`📂 [C4C] Total de adjuntos encontrados: ${attachments.length}`);

    // Paso 3: Filtrar para buscar el PDF (Priorizando Informe Técnico)
    const pdf = attachments.find((a: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const name = (a.Name || '').toLowerCase();
      const mime = (a.MimeType || '').toLowerCase();
      return (mime.includes('pdf') || name.endsWith('.pdf')) &&
             (name.includes('informe') || name.includes('technical') || name.includes('fsm'));
    }) || attachments.find((a: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const name = (a.Name || '').toLowerCase();
      const mime = (a.MimeType || '').toLowerCase();
      return mime.includes('pdf') || name.endsWith('.pdf');
    });

    if (!pdf) {
      console.warn(`⚠️ [C4C] Ticket ${ticket} encontrado pero sin PDF adjunto.`);
      return res.status(404).json({ message: 'El ticket existe en C4C pero no tiene un Informe Técnico (PDF) adjunto.' });
    }

    // Usamos DocumentLink o __metadata.media_src como fallback
    const downloadUrl = pdf.DocumentLink || pdf.__metadata?.media_src;

    if (!downloadUrl) {
      return res.status(404).json({ message: 'No se pudo obtener la URL de descarga del PDF.' });
    }

    console.log(`📄 [C4C] Descargando PDF: ${pdf.Name} desde ${downloadUrl}`);

    const pdfResponse = await axios.get(downloadUrl, {
      ...authConfig,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.Name}"`);
    pdfResponse.data.pipe(res);

  } catch (error: unknown) {
    console.error(`❌ [C4C] Error crítico:`, error instanceof Error ? error.message : String(error));
    res.status(500).json({
      message: 'Error de integración con SAP C4C',
      error: safeError(error)
    });
  }
});

export default router;

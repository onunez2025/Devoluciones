import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import { BlobServiceClient } from '@azure/storage-blob';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// Configuración Azure Blob Storage
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'stecnico';

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB
});

// Configuración SQL Server
const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || 'SIATC',
  options: {
    encrypt: true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

const poolPromise = new sql.ConnectionPool(sqlConfig)
  .connect()
  .then(pool => {
    console.log('✅ Conectado a SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error de conexión SQL Server:', err);
    process.exit(1);
  });

// --- Middleware de Autenticación ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

const APP_IDENTIFIER = 'DEV';

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('u', sql.VarChar, username)
      .input('app', sql.VarChar, APP_IDENTIFIER)
      .query(`
        SELECT u.*, r.Name as RoleName 
        FROM [EBM].[Users] u 
        LEFT JOIN [EBM].[Roles] r ON u.RoleId = r.Id 
        WHERE (u.Username = @u OR u.Email = @u) 
          AND u.IsActive = 1 
          AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
      `);

    const user = result.recordset[0];

    if (!user || !(await bcrypt.compare(password, user.PasswordHash))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const permsResult = await pool.request()
      .input('rid', sql.UniqueIdentifier, user.RoleId)
      .query("SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @rid");
    
    const perms = permsResult.recordset.map(p => p.Permission);

    const token = jwt.sign(
      { id: user.Id, username: user.Username, role: user.RoleName, perms },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        username: user.Username,
        fullName: user.FullName,
        role: user.RoleName,
        permissions: perms
      }
    });

  } catch (error: any) {
    console.error('Error en Login:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
});

// --- Endpoints de Devoluciones ---

// Listado de devoluciones con paginación y búsqueda
app.get('/api/devoluciones', authenticateToken, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * limit;

  try {
    const pool = await poolPromise;
    
    let whereClause = '';
    const request = pool.request();

    if (search) {
      whereClause = `
        WHERE d.Ticket LIKE @search 
        OR d.N_Serie LIKE @search 
        OR f.IdEquipo LIKE @search
      `;
      request.input('search', sql.VarChar, `%${search}%`);
    }

    // Consulta de datos con OFFSET/FETCH
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
          COUNT(*) OVER() as TotalCount
        FROM [dbo].[GAC_APP_TB_DEVOLUCION] d
        LEFT JOIN [SIATC].[Dashboard_FSM] f ON d.Ticket = f.Ticket
        ${whereClause}
        ORDER BY d.Creado_el DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

    const totalRecords = result.recordset.length > 0 ? result.recordset[0].TotalCount : 0;
    
    res.json({
      data: result.recordset,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (error: any) {
    console.error('Error al obtener devoluciones:', error);
    res.status(500).json({ message: 'Error al obtener devoluciones', error: error.message });
  }
});

// Estadísticas del dashboard
app.get('/api/devoluciones/stats', authenticateToken, async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM [dbo].[GAC_APP_TB_DEVOLUCION]) as total,
        (SELECT COUNT(*) FROM [dbo].[GAC_APP_TB_DEVOLUCION] WHERE CAST(Creado_el AS DATE) = CAST(GETDATE() AS DATE)) as today,
        (SELECT COUNT(*) FROM [dbo].[GAC_APP_TB_DEVOLUCION] d 
         WHERE NOT EXISTS (
           SELECT 1 FROM [dbo].[GACP_APP_TB_INFORME_TECNICO_CERRADO] it 
           WHERE TRIM(it.Ticket) = TRIM(d.Ticket)
         )) as noDiagnosis
    `);
    res.json(result.recordset[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// Registro de nueva devolución
app.post('/api/devoluciones', authenticateToken, async (req: any, res) => {
  const data = req.body;
  const username = req.user?.username || 'unknown';
  
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('Ticket', sql.VarChar, data.Ticket)
      .input('Personal_ST', sql.VarChar, username)
      .input('Personal_Ope', sql.VarChar, username)
      .input('N_Guia', sql.VarChar, data.N_Guia)
      .input('N_Serie', sql.VarChar, data.N_Serie)
      .input('Sticker', sql.VarChar, data.Sticker)
      .input('Comentario', sql.VarChar, data.Comentario)
      .input('Adjunto', sql.VarChar, data.Adjunto) // El campo es XML pero acepta strings en la query
      .input('FechaRegistro', sql.DateTime, new Date())
      .query(`
        INSERT INTO [dbo].[GAC_APP_TB_DEVOLUCION] 
        (Ticket, Personal_ST, Personal_Ope, N_Guia, N_Serie, Sticker, Comentario, Adjunto, Creado_el)
        VALUES (@Ticket, @Personal_ST, @Personal_Ope, @N_Guia, @N_Serie, @Sticker, @Comentario, @Adjunto, @FechaRegistro)
      `);
    
    res.status(201).json({ message: 'Devolución registrada correctamente' });
  } catch (error: any) {
    console.error('Error al registrar devolución:', error);
    res.status(500).json({ message: 'Error al registrar devolución', error: error.message });
  }
});

// Endpoint para subir imágenes a Azure Blob Storage
app.post('/api/upload', authenticateToken, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha proporcionado ninguna imagen' });
    }

    // Generar un nombre único para el archivo
    const blobName = `${uuidv4()}${path.extname(req.file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    console.log(`📤 Subiendo a Azure: ${blobName}...`);

    // Subir el buffer directamente
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    console.log(`✅ Imagen subida con éxito: ${blockBlobClient.url}`);

    res.json({ 
      imageUrl: blockBlobClient.url,
      blobName: blobName
    });
  } catch (error: any) {
    console.error('❌ Error al subir a Azure:', error);
    res.status(500).json({ 
      message: 'Error al procesar la subida a Azure', 
      error: error.message 
    });
  }
});

// --- Public View: Historial Técnico ---
app.get('/api/public/equipment/:idEquipo/history', async (req, res) => {
  const { idEquipo } = req.params;
  console.log(`🔍 Buscando historial para equipo: ${idEquipo}`);
  try {
    const pool = await poolPromise;
    console.log(`🔍 Buscando historial para equipo: ${idEquipo}...`);
    const result = await pool.request()
      .input('idEquipo', sql.NVarChar, idEquipo)
      .input('id', sql.NVarChar, idEquipo)
      .query(`
        SELECT 
          Ticket, 
          Estado, 
          FechaVisita as FechaCierre, 
          IdEquipo, 
          CodigoExternoEquipo, 
          NombreEquipo,
          TrabajoRealizado,
          ComentarioTecnico,
          NombreTecnico + ' ' + ApellidoTecnico as Tecnico,
          Asunto,
          SolicitaNuevaVisita,
          MotivoNuevaVisita,
          LlamadaFSM
        FROM [SIATC].[Dashboard_FSM] 
        WHERE (IdEquipo = @id OR CodigoExternoEquipo = @id) 
        AND Estado = 'Closed'
        ORDER BY FechaVisita DESC
      `);
    
    console.log(`✅ Se encontraron ${result.recordset.length} registros para ${idEquipo}`);
    res.json(result.recordset);
  } catch (error: any) {
    console.error(`❌ Error crítico al obtener historial para equipo ${idEquipo}:`, error.message);
    res.status(500).json({ message: `Error interno del servidor: ${error.message}` });
  }
});

// --- Integración SAP C4C (OData para PDF) ---
app.get('/api/c4c/pdf/:ticket', async (req, res) => {
  const { ticket } = req.params;
  const username = process.env.C4C_USER;
  const password = process.env.C4C_PASSWORD;
  const baseUrl = process.env.C4C_BASE_URL;

  try {
    // 1. Obtener datos adicionales del ticket desde nuestra DB para tener más criterios de búsqueda
    const pool = await poolPromise;
    const dbTicket = await pool.request()
      .input('ticket', sql.VarChar, ticket)
      .query('SELECT TOP 1 LlamadaFSM FROM [SIATC].[Dashboard_FSM] WHERE Ticket = @ticket');
    
    const llamadaFSM = dbTicket.recordset[0]?.LlamadaFSM;
    const normalizedTicket = ticket.padStart(10, '0');
    console.log(`📡 Consultando C4C (ID=${ticket} o ${normalizedTicket}, FSM=${llamadaFSM})`);

    // 2. Consulta robusta (expandiendo adjuntos de cabecera e ítems)
    const filter = `ID eq '${ticket}' or ID eq '${normalizedTicket}'`;
    const query = `${baseUrl}/ServiceRequestCollection?$filter=${encodeURIComponent(filter)}&$expand=ServiceRequestAttachmentFolder,ServiceRequestItem/ServiceRequestItemAttachmentFolder`;
    
    console.log(`📡 Query OData: ${query}`);

    const response = await axios.get(query, {
      auth: { username: username || '', password: password || '' },
      headers: { 'Accept': 'application/json' }
    });

    if (!response.data?.d?.results?.length) {
      console.warn(`❌ Ticket ${ticket} no encontrado en C4C`);
      return res.status(404).json({ message: 'No se encontró el ticket en SAP C4C' });
    }

    const serviceRequest = response.data.d.results[0];
    
    // 3. Recolectar TODOS los posibles adjuntos
    let allAttachments: any[] = [];
    
    // Adjuntos del nivel superior (ServiceRequestAttachmentFolder)
    if (serviceRequest.ServiceRequestAttachmentFolder?.results) {
      allAttachments = [...allAttachments, ...serviceRequest.ServiceRequestAttachmentFolder.results];
    }
    
    // Adjuntos de los ítems (ServiceRequestItem/ServiceRequestItemAttachmentFolder)
    if (serviceRequest.ServiceRequestItem?.results) {
      serviceRequest.ServiceRequestItem.results.forEach((item: any) => {
        if (item.ServiceRequestItemAttachmentFolder?.results) {
          allAttachments = [...allAttachments, ...item.ServiceRequestItemAttachmentFolder.results];
        }
      });
    }

    console.log(`📎 Total adjuntos encontrados para ticket ${ticket}: ${allAttachments.length}`);
    if (allAttachments.length > 0) {
      console.log('Detalle de adjuntos:', allAttachments.map(a => ({ 
        Name: a.Name || a.Name_Text, 
        Type: a.MimeType || a.TypeCode,
        Category: a.CategoryCode
      })));
    }

    // 4. Buscar el PDF (preferiblemente que diga "Informe" o "Technical" o simplemente sea el primer PDF)
    const pdf = allAttachments.find((a: any) => 
      (a.MimeType && a.MimeType.includes('pdf')) || 
      (a.Name && a.Name.toLowerCase().endsWith('.pdf'))
    );

    if (!pdf) {
      return res.status(404).json({ message: 'El ticket existe pero no tiene un Informe Técnico (PDF) adjunto en SAP' });
    }

    console.log(`✅ PDF encontrado: ${pdf.Name}. Descargando...`);

    // 5. Proxy el PDF
    const pdfResponse = await axios.get(pdf.__metadata.media_src, {
      auth: { username: username || '', password: password || '' },
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.Name}"`);
    pdfResponse.data.pipe(res);

  } catch (error: any) {
    console.error('❌ Error en C4C OData:', error.response?.status, error.response?.data || error.message);
    const detail = error.response?.status === 401 ? 'Error de autenticación (usuario/password)' : 
                   error.response?.status === 404 ? 'Ticket no encontrado' :
                   error.message;
    res.status(500).json({ message: `Error al comunicarse con SAP C4C: ${detail}` });
  }
});

// --- Servir Frontend Estático ---
app.use(express.static(path.join(__dirname, 'dist')));

// Manejar rutas de React (SPA)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Servidor Devoluciones corriendo en http://localhost:${port}`);
});

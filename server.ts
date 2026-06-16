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
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();

// [SECURITY] Proxy de confianza para que express-rate-limit vea la IP real
app.set('trust proxy', 1);

// [SECURITY] CORS — múltiples orígenes desde env, con guard de producción
if (IS_PRODUCTION && !(process.env.ALLOWED_ORIGINS || '').trim()) {
  console.warn('WARNING: ALLOWED_ORIGINS no configurado en producción.');
}
app.use(cors({
  origin: (origin, callback) => {
    if (!IS_PRODUCTION) return callback(null, true);
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// [SECURITY] Cabeceras de seguridad via helmet (incluye CSP)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// [SECURITY] Rate limiting general (1000 req / 15 min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
});
app.use(limiter);

// [SECURITY] Rate limiting en auth (50 req / 1 hora)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera 1 hora.' },
});
app.use('/api/auth/login', authLimiter);

// [SECURITY] Limitar tamaño de body para prevenir DoS
app.use(express.json({ limit: '2mb' }));

const port = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no configurado. El servidor no puede iniciarse de forma segura.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET as string;

// Configuración Azure Blob Storage
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'stecnico';

let containerClient: any = null;
if (AZURE_CONNECTION_STRING) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER);
    console.log('✅ Azure Blob Storage configurado correctamente');
  } catch (err) {
    console.error('❌ Error al inicializar Azure Blob Storage:', err);
  }
} else {
  console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING no definida. Las subidas de imágenes no funcionarán.');
}

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
  requestTimeout: 30000,
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
const verifyToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

// Solo para endpoints GET de descarga de archivos (browser no puede enviar headers en window.location.href)
const verifyTokenForDownload = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1] || (req.query.token as string);
  if (!token) return res.status(401).json({ message: 'Token no proporcionado' });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

const APP_IDENTIFIER = 'DEV';

// --- Middleware de Permisos ---
const checkPermission = (requiredPermission: string) => {
  return (_req: any, res: any, next: any) => {
    const { perms } = _req.user;
    if (perms && (perms.includes(requiredPermission) || perms.includes('ADMIN'))) {
      return next();
    }
    return res.status(403).json({ message: 'No tiene permisos para realizar esta acción' });
  };
};


app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
  }
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

// --- Endpoint SSO: emite token fresco con campos app-específicos ---
app.get('/api/auth/me', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });

    const pool = await poolPromise;
    const userResult = await pool.request()
      .input('id', sql.UniqueIdentifier, userId)
      .input('app', sql.VarChar(10), APP_IDENTIFIER)
      .query(`
        SELECT u.Id, u.Username, u.FullName, r.Name as RoleName, u.RoleId
        FROM [EBM].[Users] u
        LEFT JOIN [EBM].[Roles] r ON u.RoleId = r.Id
        WHERE u.Id = @id AND u.IsActive = 1
          AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
      `);

    const user = userResult.recordset[0];
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const permsResult = await pool.request()
      .input('rid', sql.UniqueIdentifier, user.RoleId)
      .query("SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @rid");
    const perms = permsResult.recordset.map((p: any) => p.Permission);

    const freshToken = jwt.sign(
      { id: user.Id, username: user.Username, full_name: user.FullName, role: user.RoleName, perms, casId: null },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token: freshToken,
      user: {
        id: user.Id,
        username: user.Username,
        fullName: user.FullName,
        role: user.RoleName,
        permissions: perms
      }
    });
  } catch (error: any) {
    console.error('Error en /api/auth/me:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// --- Endpoints de Devoluciones ---

// Listado de devoluciones con paginación y búsqueda
app.get('/api/devoluciones', verifyToken, async (req, res) => {
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

    // 1. Obtener el total de registros para paginación
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM [dbo].[GAC_APP_TB_DEVOLUCION] d
      ${search ? 'LEFT JOIN [SIATC].[Dashboard_FSM] f ON d.Ticket = f.Ticket' : ''}
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
  } catch (error: any) {
    console.error('Error al obtener devoluciones:', error);
    res.status(500).json({ message: 'Error al obtener devoluciones', error: error.message });
  }
});

// Estadísticas del dashboard
app.get('/api/devoluciones/stats', verifyToken, async (_req, res) => {
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

// Búsqueda de equipo por ticket para validación previa
app.get('/api/equipos/lookup/:ticket', verifyToken, async (req, res) => {
  const { ticket } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ticket', sql.VarChar, ticket)
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
  } catch (error: any) {
    console.error('Error en lookup de equipo:', error);
    res.status(500).json({ message: 'Error interno al buscar el equipo' });
  }
});

// Búsqueda de datos SAP (Guía/Folio) por Ticket
app.get('/api/sap/lookup/:ticket', verifyToken, async (req, res) => {
  const { ticket } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ticket', sql.VarChar, ticket)
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
  } catch (error: any) {
    console.error('Error en lookup de SAP:', error);
    res.status(500).json({ message: 'Error interno al buscar en SAP' });
  }
});

// Listado de técnicos únicos para carga masiva
app.get('/api/lookups/technicians', verifyToken, async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT TRIM(NombreTecnico + ' ' + ApellidoTecnico) as Tecnico 
      FROM [SIATC].[Dashboard_FSM] 
      WHERE NombreTecnico IS NOT NULL AND NombreTecnico <> ''
      ORDER BY Tecnico
    `);
    res.json(result.recordset.map(r => r.Tecnico));
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener técnicos' });
  }
});

// Buscar tickets candidatos para carga masiva
app.get('/api/lookups/tickets-by-period', verifyToken, async (req, res) => {
  const { date, tech } = req.query;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('date', sql.Date, date)
      .input('tech', sql.VarChar, tech)
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
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar tickets' });
  }
});

// Registro masivo de devoluciones
app.post('/api/devoluciones/batch', verifyToken, async (req: any, res) => {
  const { tickets } = req.body;
  const username = req.user?.username || 'unknown';
  
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return res.status(400).json({ message: 'No se enviaron tickets' });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const dev of tickets) {
        await transaction.request()
          .input('Ticket', sql.VarChar, dev.Ticket)
          .input('Personal_ST', sql.VarChar, username)
          .input('Personal_Ope', sql.VarChar, username)
          .input('N_Guia', sql.VarChar, dev.N_Guia || '')
          .input('N_Serie', sql.VarChar, dev.N_Serie || '')
          .input('Comentario', sql.VarChar, dev.Comentario || 'Carga Masiva')
          .input('FechaRegistro', sql.DateTime, new Date())
          .query(`
            INSERT INTO [dbo].[GAC_APP_TB_DEVOLUCION] 
            (Ticket, Personal_ST, Personal_Ope, N_Guia, N_Serie, Creado_el, Comentario)
            VALUES (@Ticket, @Personal_ST, @Personal_Ope, @N_Guia, @N_Serie, @FechaRegistro, @Comentario)
          `);
      }
      await transaction.commit();
      res.status(201).json({ message: `${tickets.length} devoluciones registradas correctamente` });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error: any) {
    console.error('Error en registro masivo:', error);
    res.status(500).json({ message: 'Error al procesar el registro masivo' });
  }
});

// Registro de nueva devolución
app.post('/api/devoluciones', verifyToken, async (req: any, res) => {
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
      .input('Adjunto', sql.VarChar, data.Adjunto)
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

// Actualizar devolución existente
app.put('/api/devoluciones/:ticket', verifyToken, async (req: any, res) => {
  const { ticket } = req.params;
  const data = req.body;
  
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Ticket', sql.VarChar, ticket)
      .input('N_Guia', sql.VarChar, data.N_Guia)
      .input('N_Serie', sql.VarChar, data.N_Serie)
      .input('Sticker', sql.VarChar, data.Sticker)
      .input('Comentario', sql.VarChar, data.Comentario)
      .input('Adjunto', sql.VarChar, data.Adjunto)
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
    
    res.json({ message: 'Devolución actualizada correctamente' });
  } catch (error: any) {
    console.error('Error al actualizar devolución:', error);
    res.status(500).json({ message: 'Error al actualizar devolución', error: error.message });
  }
});

// Endpoint para subir imágenes a Azure Blob Storage
app.post('/api/upload', verifyToken, upload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha proporcionado ninguna imagen' });
    }

    if (!containerClient) {
      return res.status(503).json({ message: 'El servicio de almacenamiento de imágenes no está configurado en el servidor' });
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
  console.log(`🔍 [Public] Buscando historial para equipo: ${idEquipo}`);
  
  try {
    const pool = await poolPromise;
    
    // Paso 1: Obtener la información básica del equipo (IdCliente y CodigoExterno)
    // Buscamos por Ticket (Indexado), IdEquipo o CodigoExterno
    const infoResult = await pool.request()
      .input('id', sql.NVarChar, idEquipo)
      .query(`
        SELECT TOP 1 IdCliente, CodigoExternoEquipo
        FROM [SIATC].[Dashboard_FSM]
        WHERE Ticket = @id OR IdEquipo = @id OR CodigoExternoEquipo = @id
        ORDER BY CASE WHEN Ticket = @id THEN 0 ELSE 1 END
      `);

    if (infoResult.recordset.length === 0) {
      console.log(`⚠️ No se encontró información para el ID: ${idEquipo}`);
      return res.json([]);
    }

    const { IdCliente, CodigoExternoEquipo } = infoResult.recordset[0];
    console.log(`✅ Equipo identificado: Cliente=${IdCliente}, Codigo=${CodigoExternoEquipo}. Buscando historial...`);

    // Paso 2: Buscar el historial usando los identificadores encontrados
    const historyResult = await pool.request()
      .input('idc', sql.NVarChar, IdCliente)
      .input('cee', sql.NVarChar, CodigoExternoEquipo)
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
  } catch (error: any) {
    console.error(`❌ Error crítico en historial público (${idEquipo}):`, error.message);
    res.status(500).json({ 
      message: 'Error al cargar el historial del equipo', 
      error: error.message 
    });
  }
});

// --- Gestión de Usuarios, Roles y Permisos ---

// Listado de usuarios
app.get('/api/users', verifyToken, checkPermission('USERS_VIEW'), async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('app', sql.VarChar, APP_IDENTIFIER)
      .query(`
        SELECT u.Id, u.Username, u.Email, u.FullName, u.RoleId, u.ManagementId, u.IsActive, u.Apps, r.Name as RoleName, m.Name as ManagementName
        FROM [EBM].[Users] u
        LEFT JOIN [EBM].[Roles] r ON u.RoleId = r.Id
        LEFT JOIN [EBM].[Managements] m ON u.ManagementId = m.Id
        WHERE u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%'
        ORDER BY u.FullName ASC
      `);
    res.json(result.recordset);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
});

// Crear usuario
app.post('/api/users', verifyToken, checkPermission('USERS_EDIT'), async (req, res) => {
  const { username, email, fullName, password, roleId, managementId, apps } = req.body;
  try {
    const pool = await poolPromise;
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    await pool.request()
      .input('id', sql.UniqueIdentifier, userId)
      .input('u', sql.NVarChar, username)
      .input('e', sql.NVarChar, email)
      .input('fn', sql.NVarChar, fullName)
      .input('ph', sql.NVarChar, passwordHash)
      .input('rid', sql.UniqueIdentifier, roleId)
      .input('mid', sql.UniqueIdentifier, managementId)
      .input('apps', sql.NVarChar, apps || APP_IDENTIFIER)
      .query(`
        INSERT INTO [EBM].[Users] (Id, Username, Email, FullName, PasswordHash, RoleId, ManagementId, IsActive, Apps, CreatedAt)
        VALUES (@id, @u, @e, @fn, @ph, @rid, @mid, 1, @apps, GETDATE())
      `);
    res.status(201).json({ message: 'Usuario creado correctamente' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al crear usuario', error: error.message });
  }
});

// Actualizar usuario
app.put('/api/users/:id', verifyToken, checkPermission('USERS_EDIT'), async (req, res) => {
  const { id } = req.params;
  const { username, email, fullName, password, roleId, managementId, isActive, apps } = req.body;
  try {
    const pool = await poolPromise;
    let query = `
      UPDATE [EBM].[Users] 
      SET Username = @u, Email = @e, FullName = @fn, RoleId = @rid, ManagementId = @mid, IsActive = @active, Apps = @apps
    `;
    
    const request = pool.request()
      .input('id', sql.UniqueIdentifier, id)
      .input('u', sql.NVarChar, username)
      .input('e', sql.NVarChar, email)
      .input('fn', sql.NVarChar, fullName)
      .input('rid', sql.UniqueIdentifier, roleId)
      .input('mid', sql.UniqueIdentifier, managementId)
      .input('active', sql.Bit, isActive)
      .input('apps', sql.NVarChar, apps);

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += `, PasswordHash = @ph`;
      request.input('ph', sql.NVarChar, passwordHash);
    }

    query += ` WHERE Id = @id`;
    await request.query(query);
    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
  }
});

// Listado de roles
app.get('/api/roles', verifyToken, async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('app', sql.VarChar, APP_IDENTIFIER)
      .query(`
        SELECT * FROM [EBM].[Roles] 
        WHERE Apps LIKE '%' + @app + '%' OR Apps LIKE '%ADMIN%'
        ORDER BY Name ASC
      `);
    res.json(result.recordset);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener roles', error: error.message });
  }
});

// Obtener permisos de un rol
app.get('/api/roles/:id/permissions', verifyToken, checkPermission('ROLES_VIEW'), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('rid', sql.UniqueIdentifier, id)
      .query("SELECT Permission FROM [EBM].[RolePermissions] WHERE RoleId = @rid");
    res.json(result.recordset.map(p => p.Permission));
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener permisos', error: error.message });
  }
});

// Actualizar permisos de un rol
app.post('/api/roles/:id/permissions', verifyToken, checkPermission('ROLES_EDIT'), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await transaction.request()
        .input('rid', sql.UniqueIdentifier, id)
        .query("DELETE FROM [EBM].[RolePermissions] WHERE RoleId = @rid");

      for (const perm of permissions) {
        await transaction.request()
          .input('rid', sql.UniqueIdentifier, id)
          .input('p', sql.NVarChar, perm)
          .query("INSERT INTO [EBM].[RolePermissions] (RoleId, Permission) VALUES (@rid, @p)");
      }
      await transaction.commit();
      res.json({ message: 'Permisos actualizados correctamente' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ message: 'Error al actualizar permisos', error: error.message });
  }
});

// Listado de gerencias
app.get('/api/managements', verifyToken, async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM [EBM].[Managements] ORDER BY Name ASC");
    res.json(result.recordset);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener gerencias', error: error.message });
  }
});


// --- Integración SAP C4C (OData para PDF) ---
app.get('/api/c4c/pdf/:ticket', verifyTokenForDownload, async (req, res) => {
  const { ticket } = req.params;
  const username = process.env.C4C_USER;
  const password = process.env.C4C_PASSWORD;
  const baseUrl = process.env.C4C_BASE_URL;

  try {
    const pool = await poolPromise;
    const dbTicket = await pool.request()
      .input('ticket', sql.VarChar, ticket)
      .query('SELECT TOP 1 LlamadaFSM FROM [SIATC].[Dashboard_FSM] WHERE Ticket = @ticket');
    
    const llamadaFSM = dbTicket.recordset[0]?.LlamadaFSM;
    const normalizedTicket = ticket.padStart(10, '0');
    
    console.log(`📡 [C4C] Iniciando búsqueda para Ticket: ${ticket}, FSM: ${llamadaFSM}`);

    // Paso 1: Buscar el ticket para obtener su ObjectID único en SAP
    let filterParts = [`ID eq '${ticket}'`, `ID eq '${normalizedTicket}'` ];
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
    const pdf = attachments.find((a: any) => {
      const name = (a.Name || '').toLowerCase();
      const mime = (a.MimeType || '').toLowerCase();
      return (mime.includes('pdf') || name.endsWith('.pdf')) && 
             (name.includes('informe') || name.includes('technical') || name.includes('fsm'));
    }) || attachments.find((a: any) => {
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

  } catch (error: any) {
    console.error(`❌ [C4C] Error crítico:`, error.message);
    res.status(500).json({ 
      message: `Error de integración con SAP C4C`, 
      error: error.message 
    });
  }
});


// --- APPLICATIONS (AppSwitcher dinámico) ---
app.get('/api/applications', verifyToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const activeOnly = req.query.activeOnly === 'true';
    let query = `
      SELECT 
        a.Id as id, 
        a.Code as code, 
        a.Label as label, 
        a.Url as url, 
        a.LogoUrl as logo_url, 
        CAST(a.IsActive AS BIT) as is_active, 
        a.DisplayOrder as display_order, 
        a.CreatedAt as created_at,
        b.FontTitle as font_title,
        b.FontSubtitle as font_subtitle,
        b.FontHeader as font_header,
        b.FontSidebar as font_sidebar,
        b.FontTableData as font_table_data,
        b.BaseFontSize as base_font_size,
        b.SidebarWidth as sidebar_width,
        b.HeaderHeight as header_height,
        b.TableRowHeight as table_row_height,
        b.TransitionDuration as transition_duration,
        b.RadiusChip as radius_chip,
        b.RadiusButton as radius_button,
        b.RadiusInput as radius_input,
        b.RadiusCard as radius_card,
        b.RadiusModal as radius_modal,
        b.LightPrimary as light_primary,
        b.LightPrimaryForeground as light_primary_foreground,
        b.LightBg as light_bg,
        b.LightCard as light_card,
        b.LightBorder as light_border,
        b.LightTextPrimary as light_text_primary,
        b.LightTextSecondary as light_text_secondary,
        b.DarkPrimary as dark_primary,
        b.DarkPrimaryForeground as dark_primary_foreground,
        b.DarkBg as dark_bg,
        b.DarkCard as dark_card,
        b.DarkBorder as dark_border,
        b.DarkTextPrimary as dark_text_primary,
        b.DarkTextSecondary as dark_text_secondary,
        b.ShadowLevel1 as shadow_level_1,
        b.ShadowLevel2 as shadow_level_2,
        b.ShadowLevel3 as shadow_level_3,
        b.MobileFontScale as mobile_font_scale,
        b.MobileRadiusCard as mobile_radius_card,
        b.MobileRadiusButton as mobile_radius_button,
        b.MobilePaddingScale as mobile_padding_scale
      FROM [dbo].[GAC_APP_TB_CONSOLE_APPLICATIONS] a
      LEFT JOIN [dbo].[GAC_APP_TB_CONSOLE_APP_BRANDING] b ON a.Id = b.ApplicationId
    `;
    if (activeOnly) {
      query += ' WHERE a.IsActive = 1';
    }
    query += ' ORDER BY a.DisplayOrder ASC';

    const result = await pool.request().query(query);
    
    const apps = result.recordset.map(row => ({
      id: row.id,
      code: row.code,
      label: row.label,
      url: row.url,
      logo_url: row.logo_url,
      is_active: row.is_active,
      display_order: row.display_order,
      created_at: row.created_at,
      theme_config: row.font_title ? {
        typography: {
          fontTitle: row.font_title,
          fontSubtitle: row.font_subtitle,
          fontHeader: row.font_header,
          fontSidebar: row.font_sidebar,
          fontTableData: row.font_table_data,
          baseFontSize: row.base_font_size,
        },
        border: {
          radiusChip: row.radius_chip,
          radiusButton: row.radius_button,
          radiusCard: row.radius_card,
          radiusModal: row.radius_modal,
          radiusInput: row.radius_input,
        },
        light: {
          primary: row.light_primary,
          primaryForeground: row.light_primary_foreground,
          background: row.light_bg,
          card: row.light_card,
          border: row.light_border,
          textPrimary: row.light_text_primary,
          textSecondary: row.light_text_secondary,
        },
        dark: {
          primary: row.dark_primary,
          primaryForeground: row.dark_primary_foreground,
          background: row.dark_bg,
          card: row.dark_card,
          border: row.dark_border,
          textPrimary: row.dark_text_primary,
          textSecondary: row.dark_text_secondary,
        },
        layout: {
          sidebarWidth: row.sidebar_width,
          headerHeight: row.header_height,
          tableRowHeight: row.table_row_height,
          transitionDuration: row.transition_duration,
        },
        shadows: {
          level1: row.shadow_level_1,
          level2: row.shadow_level_2,
          level3: row.shadow_level_3,
        },
        responsive: {
          mobileFontScale: row.mobile_font_scale,
          mobileRadiusCard: row.mobile_radius_card,
          mobileRadiusButton: row.mobile_radius_button,
          mobilePaddingScale: row.mobile_padding_scale,
        }
      } : null
    }));
    
    res.json(apps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

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
          f.NombreCliente,
          f.NombreEquipo,
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

// Búsqueda de equipo por ticket para validación previa
app.get('/api/equipos/lookup/:ticket', authenticateToken, async (req, res) => {
  const { ticket } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ticket', sql.VarChar, ticket)
      .query(`
        SELECT TOP 1 
          f.IdEquipo, 
          f.CodigoExternoEquipo,
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
        N_Guia: equipo.N_Guia || ''
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
app.get('/api/sap/lookup/:ticket', authenticateToken, async (req, res) => {
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
app.get('/api/lookups/technicians', authenticateToken, async (_req, res) => {
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
app.get('/api/lookups/tickets-by-period', authenticateToken, async (req, res) => {
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
app.post('/api/devoluciones/batch', authenticateToken, async (req: any, res) => {
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
app.put('/api/devoluciones/:ticket', authenticateToken, async (req: any, res) => {
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
app.post('/api/upload', authenticateToken, upload.single('image'), async (req: any, res) => {
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
  console.log(`🔍 Buscando historial para equipo: ${idEquipo}`);
  try {
    const pool = await poolPromise;
    console.log(`🔍 Buscando historial para equipo: ${idEquipo}...`);
    const result = await pool.request()
      .input('id', sql.NVarChar, idEquipo)
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
        WHERE (f.IdEquipo = @id OR f.CodigoExternoEquipo = @id) 
        AND f.Estado = 'Closed'
        ORDER BY f.FechaVisita DESC
      `);
    
    console.log(`✅ Se encontraron ${result.recordset.length} registros para ${idEquipo}`);
    res.json(result.recordset);
  } catch (error: any) {
    console.error(`❌ Error crítico al obtener historial para equipo ${idEquipo}:`, error.message);
    res.status(500).json({ message: `Error interno del servidor: ${error.message}` });
  }
});

// --- Gestión de Usuarios, Roles y Permisos ---

// Listado de usuarios
app.get('/api/users', authenticateToken, checkPermission('USERS_VIEW'), async (_req, res) => {
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
app.post('/api/users', authenticateToken, checkPermission('USERS_EDIT'), async (req, res) => {
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
app.put('/api/users/:id', authenticateToken, checkPermission('USERS_EDIT'), async (req, res) => {
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
app.get('/api/roles', authenticateToken, async (_req, res) => {
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
app.get('/api/roles/:id/permissions', authenticateToken, checkPermission('ROLES_VIEW'), async (req, res) => {
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
app.post('/api/roles/:id/permissions', authenticateToken, checkPermission('ROLES_EDIT'), async (req, res) => {
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
app.get('/api/managements', authenticateToken, async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM [EBM].[Managements] ORDER BY Name ASC");
    res.json(result.recordset);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener gerencias', error: error.message });
  }
});


// --- Integración SAP C4C (OData para PDF) ---
app.get('/api/c4c/pdf/:ticket', async (req, res) => {
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


// --- Servir Frontend Estático ---

app.use(express.static(path.join(__dirname, 'dist')));

// Manejar rutas de React (SPA)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Servidor Devoluciones corriendo en http://localhost:${port}`);
});

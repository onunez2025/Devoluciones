import sql from 'mssql';

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

// Etapa 6 -- pool admin, reservado para operaciones DDL/migraciones que ni siatc_reader ni
// siatc_writer pueden ejecutar (ninguno tiene permiso de modificar esquema).
export const poolPromise = new sql.ConnectionPool(sqlConfig)
  .connect()
  .then(pool => {
    console.log('✅ Conectado a SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error de conexión SQL Server:', err);
    process.exit(1);
  });
void poolPromise; // Se conecta al arrancar (fail-fast) y queda reservado para DDL futuro -- ningún endpoint actual lo usa.

// Etapa 6 -- usuarios de BD de privilegio minimo (siatc_reader/siatc_writer). Si las env
// vars DB_USER_READ/DB_USER_WRITE todavia no estan configuradas en Dokploy, caen de vuelta
// al usuario admin original -- permite desplegar este codigo antes de agregar esas env vars,
// y revertir a admin-only con solo quitarlas, sin tocar codigo.
const readSqlConfig = {
  ...sqlConfig,
  user: process.env.DB_USER_READ || process.env.DB_USER,
  password: process.env.DB_PASS_READ || process.env.DB_PASSWORD,
};
const writeSqlConfig = {
  ...sqlConfig,
  user: process.env.DB_USER_WRITE || process.env.DB_USER,
  password: process.env.DB_PASS_WRITE || process.env.DB_PASSWORD,
};

// Endpoints GET -- solo lectura, usa siatc_reader (privilegio minimo).
export const readPoolPromise = new sql.ConnectionPool(readSqlConfig)
  .connect()
  .catch(err => {
    console.error('❌ Error de conexión SQL Server (read pool):', err);
    process.exit(1);
  });

// Endpoints POST/PUT/DELETE/PATCH -- usa siatc_writer (lectura + escritura en dbo/EBM).
export const writePoolPromise = new sql.ConnectionPool(writeSqlConfig)
  .connect()
  .catch(err => {
    console.error('❌ Error de conexión SQL Server (write pool):', err);
    process.exit(1);
  });

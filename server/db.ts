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

// Etapa 6 -- aqui habia un tercer pool que se conectaba al arrancar con el usuario
// administrador original "por si hiciera falta para DDL". No lo usaba ningun endpoint, pero
// mantenia abierta una sesion de administrador contra la base durante toda la vida del proceso.
// Retirado: ninguna app debe conectarse con las credenciales antiguas. Las migraciones que
// necesiten DDL se ejecutan como scripts sueltos, no desde el servidor web.
//
// El arranque sigue siendo fail-fast: los dos pools de abajo hacen process.exit(1) si no
// conectan.

// Etapa 6 -- usuarios de BD de privilegio minimo (siatc_reader/siatc_writer).
//
// Aqui habia un respaldo `|| process.env.DB_USER` para poder desplegar este codigo antes de
// tener las variables en Dokploy. Ya estan en las once apps, y mantenerlo solo dejaba una
// puerta abierta: un despliegue al que se le olvidara una variable volveria al usuario
// administrador antiguo sin avisar de nada, funcionando igual de bien. Retirado.
//
// Ahora la ausencia de cualquiera de las cuatro se detecta al arrancar, en lib/env.ts, con un
// mensaje que dice cual falta.
const readSqlConfig = {
  ...sqlConfig,
  user: process.env.DB_USER_READ,
  password: process.env.DB_PASS_READ,
};
const writeSqlConfig = {
  ...sqlConfig,
  user: process.env.DB_USER_WRITE,
  password: process.env.DB_PASS_WRITE,
};

// Endpoints GET -- solo lectura, usa siatc_reader (privilegio minimo).
export const readPoolPromise = new sql.ConnectionPool(readSqlConfig)
  .connect()
  .then(pool => {
    console.log('✅ Conectado a SQL Server');
    return pool;
  })
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

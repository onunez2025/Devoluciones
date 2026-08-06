import sql from 'mssql';

export interface CasUser {
    casId: string | null;
}

/**
 * Agrega filtro AND ID_cas = @casId al request SQL para usuarios CAS.
 * Retorna el sufijo WHERE listo para concatenar, o '' si el usuario es Sole.
 *
 * Fase D (evaluado 2026-06-15): Devoluciones es herramienta interna de Sole.
 * GAC_APP_TB_DEVOLUCION no tiene columna ID_cas → RLS por empresa no aplica.
 * Esta función queda como punto de extensión si en el futuro se requiere.
 */
export function applyCasIdFilter(
    req: sql.Request,
    user: CasUser,
): string {
    if (!user.casId) return '';
    req.input('casId', sql.VarChar(50), user.casId);
    return ' AND ID_cas = @casId';
}

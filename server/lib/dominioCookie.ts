import type { Request } from 'express';

/**
 * Dominio con el que el servidor escribe la cookie de sesión SSO, derivado del **host de la
 * petición**.
 *
 * ## Por qué no solo la variable de entorno
 *
 * `process.env.COOKIE_DOMAIN` sí se lee en ejecución —a diferencia de las `VITE_*` del frontend, que
 * se incrustan al compilar— así que se conserva como **anulación manual** y tiene prioridad. Pero
 * depender solo de ella significa que basta con olvidarla en un despliegue para que QA vuelva a
 * escribir la cookie en el dominio de producción, en silencio y sin error. Eso es justo lo que
 * pasó.
 *
 * Derivarlo del host hace que el comportamiento correcto sea el de por defecto y la variable, la
 * excepción.
 *
 * ## El orden de las comprobaciones importa
 *
 * `flow.qa.siatc.cloud` **también** termina en `.siatc.cloud`. Preguntar primero por producción da
 * verdadero en QA y no separa nada. **QA se comprueba primero, siempre.**
 */
export function dominioCookie(req: Request): string | undefined {
    // Anulación explícita: si alguien la configura, manda.
    if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN;

    // `host` puede traer puerto ("localhost:3000"); detrás del proxy de Dokploy llega el host real.
    const host = (req.headers['x-forwarded-host'] as string | undefined)
        ?? req.headers.host
        ?? '';
    const nombre = host.split(':')[0].toLowerCase();

    if (nombre.endsWith('.qa.siatc.cloud')) return '.qa.siatc.cloud';
    if (nombre.endsWith('.siatc.cloud')) return '.siatc.cloud';

    // Local: cookie de host, sin `domain`. Devolver undefined hace que Express lo omita.
    return undefined;
}

/** `true` en cualquier despliegue real (QA o producción); `false` en local. */
export const esDespliegueReal = (req: Request): boolean => dominioCookie(req) !== undefined;

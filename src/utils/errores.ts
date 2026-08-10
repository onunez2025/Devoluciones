/**
 * Ayudantes para leer un error capturado sin recurrir a `any`.
 *
 * En un `catch` el valor es `unknown`: puede ser un Error, una cadena o cualquier cosa. Tiparlo
 * como `any` hacia que `error.message` compilara siempre, incluso cuando el error no era un Error
 * y la propiedad valia `undefined`.
 */

/** Mensaje legible de cualquier error capturado. */
export function mensajeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Forma de un error de axios con respuesta del servidor. */
interface ErrorConRespuesta {
    response?: { data?: { message?: string; error?: string } };
}

/** Mensaje que devuelve la API si lo hay; si no, el que se pase por defecto. */
export function mensajeApi(err: unknown, porDefecto: string): string {
    const r = (err as ErrorConRespuesta)?.response;
    return r?.data?.message || r?.data?.error || porDefecto;
}

import { Devolucion } from '../types';

/**
 * Servicio para generar comandos CPCL (Compaq Printer Control Language)
 * Basado en el diseño analizado en app_imprimir_zebra (MainActivity.kt)
 * y el diseño visual de la plataforma Devoluciones.
 */
export const generateZPL = (devolucion: Devolucion): string => {
  const publicUrl = `https://gac-sole-devoluciones.jppsfv.easypanel.host/public/equipment/${devolucion.IdEquipo}`;
  
  // PRUEBA DE TEXTO PLANO (Modo Línea / ESC-POS)
  // Muchas impresoras móviles de esta gama funcionan mejor así por defecto
  return `DEVOLUCION REGISTRADA\r\n` +
         `--------------------------\r\n` +
         `ID: ${devolucion.IdEquipo || 'S/ID'}\r\n` +
         `Ticket: ${devolucion.Ticket || 'S/T'}\r\n` +
         `Serie: ${devolucion.N_Serie || 'S/S'}\r\n` +
         `--------------------------\r\n` +
         `Historial:\r\n` +
         `${publicUrl}\r\n` +
         `--------------------------\r\n` +
         `Sole - MT Industrial\r\n` +
         `\r\n\r\n\r\n`; // Saltos finales para permitir el corte
};

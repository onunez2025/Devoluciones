import { Devolucion } from '../types';

/**
 * Servicio para generar comandos CPCL (Compaq Printer Control Language)
 * Basado en el diseño analizado en app_imprimir_zebra (MainActivity.kt)
 * y el diseño visual de la plataforma Devoluciones.
 */
export const generateZPL = (devolucion: Devolucion): string => {
  const publicUrl = `https://gac-sole-devoluciones.jppsfv.easypanel.host/public/equipment/${devolucion.IdEquipo}`;
  
  const id = (devolucion.IdEquipo || 'S/ID').substring(0, 20);
  const serie = (devolucion.N_Serie || 'S/N').substring(0, 30);
  const ticket = String(devolucion.Ticket || '');

  // Comandos CPCL para Zebra ZQ220 Plus
  return `
! 0 200 200 450 1
CENTER
TEXT 4 0 0 20 DEVOLUCION REGISTRADA
LEFT
BARCODE QR 30 80 M 2 U 8
${publicUrl}
ENDQR
TEXT 7 0 320 80 ID:
TEXT 7 1 320 110 ${id}
TEXT 7 0 320 160 SERIE:
TEXT 7 0 320 190 ${serie}
TEXT 7 0 320 240 TICKET:
TEXT 7 1 320 270 #${ticket}
CENTER
TEXT 7 0 0 360 Sole - MT Industrial
TEXT 5 0 0 390 ESCANEA PARA VER HISTORIAL
FORM
PRINT
`.trim();
};

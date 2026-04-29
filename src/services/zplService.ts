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

  // Comandos CPCL refinados para Zebra ZQ220 Plus
  return `
! 0 200 200 450 1
PAGE-WIDTH 580
BARCODE-TEXT OFF
CENTER
T 4 1 0 20 DEVOLUCION REGISTRADA
LEFT
BARCODE QR 30 80 M 2 U 7 ${publicUrl}
T 7 0 310 80 ID:
T 5 0 310 110 ${id}
T 7 0 310 160 SERIE:
T 5 0 310 190 ${serie}
T 7 0 310 240 TICKET:
T 5 0 310 270 #${ticket}
CENTER
T 7 0 0 360 Sole - MT Industrial
T 5 0 0 390 ESCANEA PARA VER HISTORIAL
PRINT
`.trim();
};

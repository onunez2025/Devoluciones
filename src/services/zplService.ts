import { Devolucion } from '../types';

/**
 * Servicio para generar comandos ZPL (Zebra Programming Language)
 * Basado en el diseño analizado en app_imprimir_zebra (MainActivity.kt)
 * y el diseño visual de la plataforma Devoluciones.
 */
export const generateZPL = (devolucion: Devolucion): string => {
  const publicUrl = `https://${window.location.host}/public/equipment/${devolucion.IdEquipo}`;
  
  // Limpiar datos para evitar errores en ZPL
  const id = (devolucion.IdEquipo || 'S/ID').substring(0, 20);
  const serie = (devolucion.N_Serie || 'S/N').substring(0, 30);
  const ticket = devolucion.Ticket || '';

  return `
^XA
^CI28
^PW609
^LL406

^FO20,20^GB569,366,4^FS

^FO60,60^BQN,2,8^FDQA,${publicUrl}^FS

^FO320,80^A0N,50,50^FD#${id}^FS
^FO320,140^A0N,25,25^FDSERIE:^FS
^FO320,170^A0N,25,25^FD${serie}^FS
^FO320,230^A0N,24,24^FDSole - MT Industrial^FS
^FO320,270^A0N,20,20^FDHISTORIAL ONLINE^FS
^FO320,310^A0N,18,18^FDTICKET: ${ticket}^FS

^XZ
  `.trim();
};

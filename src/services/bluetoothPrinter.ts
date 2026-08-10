import { mensajeError } from '../utils/errores';
import { Capacitor } from '@capacitor/core';
import { CapacitorZebraBluetooth } from 'capacitor-zebra-bluetooth';
const ZebraBluetooth = CapacitorZebraBluetooth;

export const ZebraPrinterUUIDs = {
// ... [Existing UUIDs kept for Web fallback]
  // Zebra Official
  service: '38510000-204c-4735-9103-24c13a20d402',
  characteristic: '38510001-204c-4735-9103-24c13a20d402',
  // Zebra Generic/Other
  service2: '000018f0-0000-1000-8000-00805f9b34fb',
  // Microchip/ISSC (common in ZQ220)
  service3: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  char3: '49535343-1e4d-4bd9-ba61-07c6435a7e56',
  char3_alt: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  // Generic BLE Print Service
  service4: '0000ff00-0000-1000-8000-00805f9b34fb',
  char4: '0000ff01-0000-1000-8000-00805f9b34fb',
  // ZQ220 specific (ST Micro)
  service5: '0000fee7-0000-1000-8000-00805f9b34fb',
  char5: '0000fec7-0000-1000-8000-00805f9b34fb',
  // Standard Information
  deviceInfo: '0000180a-0000-1000-8000-00805f9b34fb',
  // Generic Services for stability
  genericAccess: '00001800-0000-1000-8000-00805f9b34fb',
  genericAttribute: '00001801-0000-1000-8000-00805f9b34fb'
};

/**
 * Tipos minimos de Web Bluetooth. La API no esta en la libreria estandar de TypeScript, asi que
 * se declara aqui solo lo que este servicio usa, en vez de recurrir a `any`.
 */
interface GattServer {
    connected: boolean;
    connect(): Promise<GattServer>;
    disconnect(): void;
    getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BleCaracteristica> }>;
}
interface BleDispositivo {
    name?: string;
    gatt?: GattServer;
}
interface BleCaracteristica {
    properties: { write?: boolean; writeWithoutResponse?: boolean };
    writeValue(v: BufferSource): Promise<void>;
    writeValueWithoutResponse(v: BufferSource): Promise<void>;
}
/** Impresora que devuelve el plugin nativo (Capacitor). */
interface ImpresoraNativa { friendlyName: string }
/**
 * `device` guarda DOS cosas segun el transporte: una impresora del plugin nativo (Capacitor) o un
 * dispositivo Web Bluetooth. Solo el segundo tiene `gatt`, y el codigo lo accedia sin distinguir.
 * Tipado como `any` eso compilaba siempre; con el tipo union hay que preguntar antes.
 */
type DispositivoImpresora = BleDispositivo | ImpresoraNativa;

/** Devuelve el servidor GATT solo si el dispositivo es de Web Bluetooth. */
function gattDe(d: DispositivoImpresora | null): GattServer | undefined {
    return d && 'gatt' in d ? d.gatt : undefined;
}

/** `navigator.bluetooth` tampoco esta tipado en la lib estandar. */
interface NavegadorConBluetooth {
    bluetooth?: { requestDevice(opts: unknown): Promise<BleDispositivo> };
}

class BluetoothPrinterService {
  private device: DispositivoImpresora | null = null;
  private characteristic: BleCaracteristica | null = null;
  async connect() {
    if (Capacitor.isNativePlatform()) {
      return this.connectNative();
    }
    return this.connectWeb();
  }

  private async connectNative() {
    try {
      if (!ZebraBluetooth) {
        throw new Error('El plugin ZebraBluetooth no está disponible.');
      }

      alert('Buscando impresoras Zebra...');
      console.log('Buscando impresoras Zebra...');
      const result = await ZebraBluetooth.discoverPrinters();
      
      // DEPURACIÓN: Mostrar qué encontró exactamente
      if (result && result.printers) {
        console.log('Impresoras encontradas:', result.printers);
      } else {
        alert('El plugin no devolvió ninguna lista de impresoras.');
      }

      const printers = result.printers || [];
      
      if (printers.length === 0) {
        throw new Error('No se encontraron impresoras Zebra vinculadas. Por favor, verifica que el dispositivo XXZ esté emparejado en el sistema.');
      }
      
      const target = printers.find((p: ImpresoraNativa) => 
        p.friendlyName.toUpperCase().includes('ZEBRA') || 
        p.friendlyName.toUpperCase().startsWith('ZQ') || 
        p.friendlyName.toUpperCase().startsWith('ZR') ||
        p.friendlyName.toUpperCase().startsWith('XXZ')
      ) || printers[0];
      
      alert(`Conectando a ${target.friendlyName}...`);
      console.log(`Conectando a impresora nativa: ${target.friendlyName}...`);
      
      await ZebraBluetooth.connectToPrinter({ friendlyName: target.friendlyName });
      
      // Aumentamos a 2 segundos para asegurar que el canal esté abierto
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.device = target;
      
      return true;
    } catch (error: unknown) {
      console.error('Error en conexión nativa:', error);
      throw new Error(`Error Bluetooth Nativo: ${mensajeError(error) || 'Fallo de conexión'}`);
    }
  }

  private async connectWeb() {
    try {
      console.log('Solicitando dispositivo Bluetooth (Web)...');
      this.device = await (navigator as unknown as NavegadorConBluetooth).bluetooth!.requestDevice({
        filters: [
          { name: 'XXZSV231200858' },
          { namePrefix: 'XXZSV' },
          { namePrefix: 'ZQ' },
          { namePrefix: 'ZR' },
          { namePrefix: 'Zebra' }
        ],
        optionalServices: [
          ZebraPrinterUUIDs.service,
          ZebraPrinterUUIDs.service2,
          ZebraPrinterUUIDs.service3,
          ZebraPrinterUUIDs.service4,
          ZebraPrinterUUIDs.service5,
          ZebraPrinterUUIDs.deviceInfo,
          ZebraPrinterUUIDs.genericAccess,
          ZebraPrinterUUIDs.genericAttribute
        ]
      });

      console.log('Conectando al servidor GATT...');
      let server;
      try {
        if (gattDe(this.device)?.connected) {
          await gattDe(this.device)?.disconnect();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        server = await gattDe(this.device)?.connect();
      } catch (e: unknown) {
        console.warn('Primer intento fallido, reintentando...', e);
        await new Promise(resolve => setTimeout(resolve, 1500));
        server = await gattDe(this.device)?.connect();
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));

      let service;
      try {
        service = await server?.getPrimaryService(ZebraPrinterUUIDs.service);
        this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.characteristic)) || null;
      } catch {
        try {
          service = await server?.getPrimaryService(ZebraPrinterUUIDs.service2);
          this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.characteristic)) || null;
        } catch {
          try {
            service = await server?.getPrimaryService(ZebraPrinterUUIDs.service3);
            try {
              this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.char3)) || null;
            } catch {
              this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.char3_alt)) || null;
            }
          } catch {
            try {
              service = await server?.getPrimaryService(ZebraPrinterUUIDs.service4);
              this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.char4)) || null;
            } catch {
              try {
                service = await server?.getPrimaryService(ZebraPrinterUUIDs.service5);
                this.characteristic = await service?.getCharacteristic(ZebraPrinterUUIDs.char5) ?? null;
              } catch {
                throw new Error('No se encontró canal de impresión BLE compatible.');
              }
            }
          }
        }
      }
      
      if (!this.characteristic) throw new Error('No se encontró característica de escritura válida.');

      console.log('Impresora Web conectada');
      return true;
    } catch (error: unknown) {
      console.error('Error al conectar Web Bluetooth:', error);
      throw error;
    }
  }

  async print(zpl: string) {
    if (!this.device) {
      await this.connect();
    }
    if (Capacitor.isNativePlatform()) {
      return this.printNative(zpl);
    }
    return this.printWeb(zpl);
  }

  private async printNative(zpl: string) {
    try {
      alert('Enviando etiqueta...');
      // Añadimos \r\n al inicio y al final para asegurar que el buffer se limpie y ejecute
      const formattedZpl = "\r\n" + zpl.trim() + "\r\n";
      console.log('Enviando impresión via CPCL (CRLF)...');
      await ZebraBluetooth.sendZPL({ zpl: formattedZpl });
      alert('¡Impresión enviada!');
      return true;
    } catch (error: unknown) {
      console.error('Error en impresión nativa:', error);
      throw new Error(`Fallo en impresión nativa: ${mensajeError(error)}`);
    }
  }

  private async printWeb(zpl: string) {
    const isConnected = gattDe(this.device)?.connected && this.characteristic;
    
    if (!isConnected) {
      const connected = await this.connectWeb();
      if (!connected) throw new Error('No se pudo conectar a la impresora');
    }

    try {
      const encoder = new TextEncoder();
      const sanitizedZpl = zpl.replace(/[^\x00-\x7F]/g, "");  // eslint-disable-line no-control-regex
      const data = encoder.encode(sanitizedZpl);
      const chunkSize = 10; 
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (!gattDe(this.device)?.connected) throw new Error('Conexión perdida');

        if (!this.characteristic) throw new Error('Canal de impresion no disponible');
            if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return true;
    } catch (error: unknown) {
      this.characteristic = null; 
      try { await gattDe(this.device)?.disconnect(); } catch { /* el gatt ya podia estar desconectado; da igual */ }
      throw error;
    }
  }

  isSupported() {
    if (Capacitor.isNativePlatform()) return true;
    return !!(navigator as unknown as NavegadorConBluetooth).bluetooth?.requestDevice;
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

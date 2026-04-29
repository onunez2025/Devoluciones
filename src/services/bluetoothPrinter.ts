import { Capacitor } from '@capacitor/core';
// @ts-ignore
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

class BluetoothPrinterService {
  private device: any = null;
  private characteristic: any = null;

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
      // @ts-ignore
      const result = await ZebraBluetooth.discoverPrinters();
      const printers = result.printers;
      
      if (!printers || printers.length === 0) {
        throw new Error('No se encontraron impresoras Zebra vinculadas.');
      }
      
      const target = printers.find((p: any) => 
        p.friendlyName.toUpperCase().includes('ZEBRA') || 
        p.friendlyName.toUpperCase().startsWith('ZQ') || 
        p.friendlyName.toUpperCase().startsWith('ZR')
      ) || printers[0];
      
      alert(`Conectando a ${target.friendlyName}...`);
      console.log(`Conectando a impresora nativa: ${target.friendlyName}...`);
      
      // @ts-ignore
      await ZebraBluetooth.connectToPrinter({ friendlyName: target.friendlyName });
      this.device = target;
      
      // Esperar estabilidad
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error: any) {
      console.error('Error en conexión nativa:', error);
      throw new Error(`Error Bluetooth Nativo: ${error.message || 'Fallo de conexión'}`);
    }
  }

  private async connectWeb() {
    try {
      console.log('Solicitando dispositivo Bluetooth (Web)...');
      this.device = await (navigator as any).bluetooth.requestDevice({
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
        if (this.device.gatt?.connected) {
          await this.device.gatt.disconnect();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        server = await this.device.gatt?.connect();
      } catch (e: any) {
        console.warn('Primer intento fallido, reintentando...', e);
        await new Promise(resolve => setTimeout(resolve, 1500));
        server = await this.device.gatt?.connect();
      }
      
      await new Promise(resolve => setTimeout(resolve, 800));

      let service;
      try {
        service = await server?.getPrimaryService(ZebraPrinterUUIDs.service);
        this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.characteristic)) || null;
      } catch (e) {
        try {
          service = await server?.getPrimaryService(ZebraPrinterUUIDs.service2);
          this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.characteristic)) || null;
        } catch (e2) {
          try {
            service = await server?.getPrimaryService(ZebraPrinterUUIDs.service3);
            try {
              this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.char3)) || null;
            } catch (e3a) {
              this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.char3_alt)) || null;
            }
          } catch (e3) {
            try {
              service = await server?.getPrimaryService(ZebraPrinterUUIDs.service4);
              this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.char4)) || null;
            } catch (e4: any) {
              try {
                service = await server?.getPrimaryService(ZebraPrinterUUIDs.service5);
                this.characteristic = await service?.getCharacteristic(ZebraPrinterUUIDs.char5);
              } catch (e5) {
                throw new Error('No se encontró canal de impresión BLE compatible.');
              }
            }
          }
        }
      }
      
      if (!this.characteristic) throw new Error('No se encontró característica de escritura válida.');

      console.log('Impresora Web conectada');
      return true;
    } catch (error: any) {
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
      const formattedZpl = zpl.trim() + "\n";
      console.log('Enviando impresión via CPCL...');
      // @ts-ignore
      await ZebraBluetooth.sendZPL({ zpl: formattedZpl });
      alert('¡Impresión enviada!');
      return true;
    } catch (error: any) {
      console.error('Error en impresión nativa:', error);
      throw new Error(`Fallo en impresión nativa: ${error.message}`);
    }
  }

  private async printWeb(zpl: string) {
    const isConnected = this.device?.gatt?.connected && this.characteristic;
    
    if (!isConnected) {
      const connected = await this.connectWeb();
      if (!connected) throw new Error('No se pudo conectar a la impresora');
    }

    try {
      const encoder = new TextEncoder();
      const sanitizedZpl = zpl.replace(/[^\x00-\x7F]/g, "");
      const data = encoder.encode(sanitizedZpl);
      const chunkSize = 10; 
      
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (!this.device?.gatt?.connected) throw new Error('Conexión perdida');

        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return true;
    } catch (error: any) {
      this.characteristic = null; 
      try { await this.device?.gatt?.disconnect(); } catch(e) {}
      throw error;
    }
  }

  isSupported() {
    if (Capacitor.isNativePlatform()) return true;
    return !!((navigator as any).bluetooth && (navigator as any).bluetooth.requestDevice);
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

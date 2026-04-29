
export const ZebraPrinterUUIDs = {
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
    try {
      console.log('Solicitando dispositivo Bluetooth...');
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
          ZebraPrinterUUIDs.deviceInfo,
          ZebraPrinterUUIDs.genericAccess,
          ZebraPrinterUUIDs.genericAttribute
        ]
      });

      console.log('Conectando al servidor GATT...');
      let server;
      try {
        // Forzar desconexión previa por si acaso
        if (this.device.gatt?.connected) {
          await this.device.gatt.disconnect();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        server = await this.device.gatt?.connect();
      } catch (e: any) {
        console.warn('Primer intento fallido, reintentando...', e);
        // Reintento tras 1 segundo
        await new Promise(resolve => setTimeout(resolve, 1500));
        try {
          server = await this.device.gatt?.connect();
        } catch (e2: any) {
          throw new Error(`Fallo al conectar (GATT) tras reintento: ${e2.message}`);
        }
      }
      
      // Pequeña pausa para estabilidad en Android
      await new Promise(resolve => setTimeout(resolve, 800));

      // Intento de "Keep-Alive" leyendo el nombre del dispositivo si es posible
      try {
        const genericService = await server?.getPrimaryService(ZebraPrinterUUIDs.genericAccess);
        await genericService?.getCharacteristic('00002a00-0000-1000-8000-00805f9b34fb');
      } catch (e) {
        console.log('No se pudo leer nombre del dispositivo, continuando...');
      }

      console.log('Obteniendo servicio primario...');
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
              throw new Error(`No se encontró canal de impresión. Intentados: Zebra, ISSC, Generic. Error final: ${e4.message}`);
            }
          }
        }
      }
      
      if (!this.characteristic) throw new Error('No se encontró una característica de escritura válida');

      // Verificar propiedades para depuración
      const props = this.characteristic.properties;
      console.log('Propiedades de la característica:', {
        write: props.write,
        writeWithoutResponse: props.writeWithoutResponse,
        notify: props.notify,
        indicate: props.indicate
      });

      console.log('Impresora conectada correctamente');
      return true;
    } catch (error: any) {
      console.error('Error al conectar con la impresora:', error);
      throw error;
    }
  }

  async print(zpl: string) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error('No se pudo conectar a la impresora');
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(zpl);
      
      // Enviamos en bloques si el ZPL es largo (MTU usualmente es ~20-512 bytes)
      const chunkSize = 20; 
      
      // Intentar usar writeValueWithoutResponse si está disponible para mayor velocidad y menor probabilidad de errores GATT concurrentes
      const writeMethod = this.characteristic.writeValueWithoutResponse ? 'writeValueWithoutResponse' : 'writeValue';
      
      console.log(`Iniciando envío de ${data.length} bytes usando ${writeMethod}...`);

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (writeMethod === 'writeValueWithoutResponse') {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        
        // Pequeño retardo entre bloques para evitar saturar el búfer de la impresora/Bluetooth
        // 20ms es suficiente para que el stack de Bluetooth procese el paquete anterior
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      
      console.log('ZPL enviado correctamente');
    } catch (error) {
      console.error('Error al imprimir:', error);
      this.characteristic = null; // Reset characteristic on error
      throw error;
    }
  }

  isSupported() {
    return !!((navigator as any).bluetooth && (navigator as any).bluetooth.requestDevice);
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

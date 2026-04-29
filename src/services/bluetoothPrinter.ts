
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
          ZebraPrinterUUIDs.service5,
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
      
      if (!this.characteristic) {
        try {
          console.log('Intentando con servicio ZQ220 (fee7)...');
          service = await server?.getPrimaryService(ZebraPrinterUUIDs.service5);
          this.characteristic = await service?.getCharacteristic(ZebraPrinterUUIDs.char5);
        } catch (e) {
          console.log('Servicio ZQ220 no encontrado');
        }
      }

      if (!this.characteristic) throw new Error('No se encontró una característica de escritura válida. Verifique que la impresora esté en modo ZPL.');

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
    // Verificar si el dispositivo sigue conectado antes de intentar escribir
    const isConnected = this.device?.gatt?.connected && this.characteristic;
    
    if (!isConnected) {
      console.log('Dispositivo desconectado o sin característica, reconectando...');
      const connected = await this.connect();
      if (!connected) throw new Error('No se pudo conectar a la impresora');
    }

    try {
      const encoder = new TextEncoder();
      // Aseguramos que el ZPL sea ASCII limpio para evitar problemas de bytes inesperados
      const sanitizedZpl = zpl.replace(/[^\x00-\x7F]/g, "");
      const data = encoder.encode(sanitizedZpl);
      
      // Enviamos en bloques extremadamente pequeños. 
      // 10 bytes es muy conservador pero ayuda en impresoras económicas (ZQ220).
      const chunkSize = 10; 
      
      const props = this.characteristic.properties;
      const canWriteWithoutResponse = props.writeWithoutResponse;
      
      console.log(`Iniciando envío de ${data.length} bytes. Modo: ${canWriteWithoutResponse ? 'Sin respuesta' : 'Con respuesta'}`);

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        if (!this.device?.gatt?.connected) {
          throw new Error('Conexión perdida durante el envío de datos');
        }

        if (canWriteWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }
        
        // Aumentamos el retardo a 100ms. Es lento pero es la única forma de asegurar 
        // que el buffer de una ZQ220 no se desborde vía BLE.
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('ZPL enviado correctamente');
    } catch (error: any) {
      console.error('Error al imprimir:', error);
      this.characteristic = null; 
      // Si falló por operación GATT, intentamos desconectar para limpiar el estado
      try { await this.device?.gatt?.disconnect(); } catch(e) {}
      throw error;
    }
  }

  isSupported() {
    return !!((navigator as any).bluetooth && (navigator as any).bluetooth.requestDevice);
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();


export const ZebraPrinterUUIDs = {
  service: '38510000-204c-4735-9103-24c13a20d402',
  characteristic: '38510001-204c-4735-9103-24c13a20d402'
};

class BluetoothPrinterService {
  private device: any = null;
  private characteristic: any = null;

  async connect() {
    try {
      console.log('Solicitando dispositivo Bluetooth...');
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [ZebraPrinterUUIDs.service]
      });

      console.log('Conectando al servidor GATT...');
      const server = await this.device.gatt?.connect();
      
      console.log('Obteniendo servicio primario...');
      const service = await server?.getPrimaryService(ZebraPrinterUUIDs.service);
      
      console.log('Obteniendo característica...');
      this.characteristic = (await service?.getCharacteristic(ZebraPrinterUUIDs.characteristic)) || null;

      console.log('Impresora conectada correctamente');
      return true;
    } catch (error) {
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
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.characteristic?.writeValue(chunk);
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

import express from 'express';
import multer from 'multer';
import { BlobServiceClient } from '@azure/storage-blob';

// Configuración Azure Blob Storage
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'stecnico';

export let containerClient: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
if (AZURE_CONNECTION_STRING) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER);
    console.log('✅ Azure Blob Storage configurado correctamente');
  } catch (err) {
    console.error('❌ Error al inicializar Azure Blob Storage:', err);
  }
} else {
  console.warn('⚠️ AZURE_STORAGE_CONNECTION_STRING no definida. Las subidas de imágenes no funcionarán.');
}

const IMAGE_MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
};

export function validateImageMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const sigs = IMAGE_MAGIC_BYTES[declaredMime];
  if (!sigs) return false;
  return sigs.some(sig => sig.every((byte, i) => buffer[i] === byte));
}

function imageFileFilter(_req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (Object.keys(IMAGE_MAGIC_BYTES).includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan imágenes (JPEG, PNG, WEBP, GIF).`));
  }
}

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

import { Router } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { upload, validateImageMagicBytes, containerClient } from '../lib/upload';
import { safeError, sanitizeLog } from '../lib/security';

const router = Router();

// Endpoint para subir imágenes a Azure Blob Storage
router.post('/', upload.single('image'), async (req: any, res: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha proporcionado ninguna imagen' });
    }

    if (!validateImageMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ message: 'El archivo no es una imagen válida.' });
    }

    if (!containerClient) {
      return res.status(503).json({ message: 'El servicio de almacenamiento de imágenes no está configurado en el servidor' });
    }

    // Generar un nombre único para el archivo
    const blobName = `${uuidv4()}${path.extname(req.file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    console.log(`📤 Subiendo a Azure: ${sanitizeLog(blobName)}...`);

    // Subir el buffer directamente
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    console.log(`✅ Imagen subida con éxito: ${blockBlobClient.url}`);

    res.json({
      imageUrl: blockBlobClient.url,
      blobName: blobName
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('❌ Error al subir a Azure:', error);
    res.status(500).json({
      message: 'Error al procesar la subida a Azure',
      error: safeError(error)
    });
  }
});

export default router;

import apiClient from '../services/apiClient';

/**
 * Descarga un archivo protegido vía apiClient (el token viaja por header
 * Authorization, nunca en la URL) y lo abre en una pestaña nueva como blob.
 */
export async function openAuthenticatedFile(path: string): Promise<void> {
    const response = await apiClient.get(path, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data as Blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

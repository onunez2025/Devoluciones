/**
 * Etiqueta física de 3x2 pulgadas con código QR, para pegar en el equipo devuelto.
 *
 * ── Por que este fichero existe ──────────────────────────────────────────────────────────────
 * El mismo bloque estaba copiado literalmente en `DashboardPage` y en `PublicEquipmentPage`.
 *
 * ── Por que aqui SI hay colores en crudo ─────────────────────────────────────────────────────
 * Esto no se ve en pantalla: se IMPRIME. `#000` y `#444` son tinta sobre papel, y no pueden
 * depender del modo oscuro — con un token, una etiqueta impresa desde el tema oscuro saldria en
 * blanco sobre blanco, es decir, en blanco.
 *
 * Por eso este fichero esta en la lista de excepciones de `no-restricted-syntax`, igual que
 * `siatc-theme.ts` y `LogosProveedores.tsx`.
 */
import React from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

export interface DatosEtiqueta {
    id: string | number;
    url: string;
    nSerie?: string | null;
}

export const EtiquetaImpresion: React.FC<{ datos: DatosEtiqueta }> = ({ datos }) => (
    <div id="print-label" style={{ display: 'none' }}>
        <div style={{ marginRight: '6mm' }}>
            <QRCodeSVG value={datos.url} size={140} level="H" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', borderBottom: '2px solid black', marginBottom: '6px', paddingBottom: '2px' }}>
                #{datos.id}
            </div>
            {datos.nSerie && (
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                    SERIE: {datos.nSerie}
                </div>
            )}
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', marginTop: '4px', textTransform: 'uppercase' }}>
                Sole - MT Industrial
            </div>
            <div style={{ fontSize: '8px', color: '#444', marginTop: '2px', fontWeight: 'bold' }}>
                HISTORIAL TÉCNICO ONLINE
            </div>
        </div>
    </div>
);

/**
 * La misma etiqueta, en grande y fuera de pantalla, para convertirla en IMAGEN descargable.
 *
 * Vive a -9999px porque hay que renderizarla de verdad para poder capturarla: no basta con
 * describirla. Y por eso lleva `background: white` y `color: black` fijos — el resultado es un
 * fichero de imagen que alguien abrira fuera de la aplicacion, donde nuestro tema no existe.
 */
export const LienzoEtiqueta: React.FC<{ datos: DatosEtiqueta }> = ({ datos }) => (
    <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <div
            id="capture-area"
            style={{
                width: '600px', height: '400px', background: 'white',
                display: 'flex', alignItems: 'center', padding: '40px', color: 'black',
            }}
        >
            <QRCodeCanvas id="qr-canvas" value={datos.url} size={320} level="H" includeMargin={true} />
            <div style={{ marginLeft: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: 'Arial' }}>
                <div style={{ fontSize: '60px', fontWeight: 'bold', borderBottom: '5px solid black', marginBottom: '20px' }}>
                    #{datos.id}
                </div>
                {datos.nSerie && (
                    <div style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '10px' }}>
                        SERIE: {datos.nSerie}
                    </div>
                )}
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Sole - MT Industrial</div>
                <div style={{ fontSize: '20px', color: '#666' }}>HISTORIAL ONLINE</div>
            </div>
        </div>
    </div>
);

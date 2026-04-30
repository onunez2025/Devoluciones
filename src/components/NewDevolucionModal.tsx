import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Upload, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Printer,
  Loader2,
  Package,
  ArrowRight,
  ClipboardList,
  Camera,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '../services/apiClient';
import { bluetoothPrinter } from '../services/bluetoothPrinter';

import { Devolucion } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  devolucion?: Devolucion | null;
}

const NewDevolucionModal = ({ onClose, onSuccess, devolucion }: Props) => {
  const isEditing = !!devolucion;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    Ticket: devolucion?.Ticket || '',
    N_Guia: devolucion?.N_Guia || '',
    N_Serie: devolucion?.N_Serie || '',
    Sticker: devolucion?.Sticker || '',
    Comentario: devolucion?.Comentario || '',
    IdEquipo: devolucion?.IdEquipo || '',
    Adjunto: devolucion?.Adjunto || ''
  });

  const [idEquipoFound, setIdEquipoFound] = useState(isEditing);

  const lookupEquipment = async () => {
    if (!formData.Ticket) return;
    setLoading(true);
    setError('');
    try {
      // Buscar equipo en FSM y datos de SAP integrados
      const response = await apiClient.get(`/equipos/lookup/${formData.Ticket}`);
      
      setFormData(prev => ({ 
        ...prev, 
        IdEquipo: response.data.IdEquipo,
        N_Guia: response.data.N_Guia || prev.N_Guia,
        N_Serie: response.data.N_Serie || prev.N_Serie // Mantener el anterior si viene vacío
      }));
      
      setIdEquipoFound(true);
    } catch (err: any) {
      setError('No se pudo encontrar el equipo o el ticket. Verifique el número.');
      setIdEquipoFound(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Máximo 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    
    const uploadData = new FormData();
    uploadData.append('image', file);

    try {
      const response = await apiClient.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFormData(prev => ({ ...prev, Adjunto: response.data.imageUrl }));
      console.log('✅ Imagen subida a Azure:', response.data.imageUrl);
    } catch (err: any) {
      console.error('Error al subir imagen:', err);
      setError('No se pudo subir la imagen a Azure. Intente nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!idEquipoFound) {
      setError('Debe identificar un equipo válido antes de registrar.');
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await apiClient.put(`/devoluciones/${formData.Ticket}`, formData);
      } else {
        await apiClient.post('/devoluciones', formData);
      }
      setStep(2);
      onSuccess();
    } catch (err) {
      setError(`Error al ${isEditing ? 'actualizar' : 'registrar'} la devolución.`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const zpl = `^XA^FO50,50^BQN,2,10^FDQA,https://${window.location.host}/public/equipment/${formData.IdEquipo}^FS^FO250,70^A0N,30,30^FDTicket: ${formData.Ticket}^FS^FO250,110^A0N,25,25^FDEquipo: ${formData.IdEquipo}^FS^XZ`;
    
    if (bluetoothPrinter.isSupported()) {
      try {
        await bluetoothPrinter.print(zpl);
      } catch (error) {
        console.error('Error al imprimir por Bluetooth:', error);
        copyToClipboardFallback(zpl);
      }
    } else {
      copyToClipboardFallback(zpl);
    }
  };

  const copyToClipboardFallback = (zpl: string) => {
    navigator.clipboard.writeText(zpl).then(() => {
      alert('Bluetooth no disponible.\n\nZPL copiado al portapapeles.');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border-white/10"
      >
        {/* Modal Header */}
        <div className="glass-card-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-inner">
              {step === 1 ? <Package className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-foreground">
                {step === 1 
                  ? (isEditing ? 'Editar Devolución' : 'Registrar Nueva Devolución') 
                  : '¡Acción Completada!'}
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground/60">
                {step === 1 
                  ? 'Sistema de Control de Equipos Retornados' 
                  : `El registro se ha ${isEditing ? 'actualizado' : 'sincronizado'} correctamente`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all duration-300 group"
          >
            <X className="w-5 h-5 opacity-40 group-hover:opacity-100" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* Buscador de Ticket */}
              {!isEditing && (
                <div className="relative group">
                  <label className="form-label">Identificación de Ticket (FSM)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${loading ? 'text-primary animate-pulse' : 'text-muted-foreground/40'}`} />
                      <input 
                        type="text"
                        className="glass-input w-full pl-11 h-11 text-xs"
                        placeholder="Ingrese número de ticket sap..."
                        disabled={idEquipoFound || loading}
                        value={formData.Ticket}
                        onChange={(e) => setFormData({...formData, Ticket: e.target.value.replace(/\D/g, '')})}
                        onKeyDown={(e) => e.key === 'Enter' && lookupEquipment()}
                      />
                    </div>
                    
                    {!idEquipoFound ? (
                      <button 
                        onClick={lookupEquipment}
                        disabled={loading || !formData.Ticket}
                        className="px-6 h-11 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Validar
                      </button>
                    ) : (
                      <button 
                        onClick={() => setIdEquipoFound(false)}
                        className="px-4 h-11 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center justify-center"
                        title="Cambiar Ticket"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {idEquipoFound && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, height: 0 }} 
                    animate={{ opacity: 1, scale: 1, height: 'auto' }}
                    exit={{ opacity: 0, scale: 0.95, height: 0 }}
                    className="p-4 bg-primary/[0.03] border border-primary/20 rounded-2xl flex items-center gap-4 shadow-inner pointer-events-none overflow-hidden"
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/10 shadow-sm">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[9px] text-primary/70 font-black uppercase tracking-widest">
                            {isEditing ? `Ticket #${formData.Ticket}` : 'Equipo Identificado'}
                          </p>
                          <p className="text-sm font-black text-foreground">ID: {formData.IdEquipo}</p>
                        </div>
                        <div className="bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase border border-emerald-500/10">
                          {isEditing ? 'Registro Existente' : 'Operativo en SAP'}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Formulario Secundario */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="form-label flex items-center gap-1.5">
                    <ClipboardList className="w-3 h-3 text-primary/60" /> Guía de Remisión
                  </label>
                  <input 
                    type="text" 
                    className="glass-input w-full h-10"
                    placeholder="N° Guía..."
                    value={formData.N_Guia}
                    onChange={(e) => setFormData({...formData, N_Guia: e.target.value})}
                  />
                  <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest mt-1">
                    {formData.N_Guia ? '✓ Sugerido por SAP (Validar con guía física)' : 'Ingrese el folio manualmente'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="form-label flex items-center gap-1.5">
                    <QrCode className="w-3 h-3 text-primary/60" /> Número de Serie
                  </label>
                  <input 
                    type="text" 
                    className="glass-input w-full h-10"
                    placeholder="S/N del equipo..."
                    value={formData.N_Serie}
                    onChange={(e) => setFormData({...formData, N_Serie: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="form-label flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3 text-primary/60" /> Diagnóstico Preliminar / Observaciones
                </label>
                <textarea 
                  className="glass-input w-full min-h-[80px] py-3 resize-none leading-relaxed"
                  placeholder="Describa el estado funcional del equipo..."
                  value={formData.Comentario}
                  onChange={(e) => setFormData({...formData, Comentario: e.target.value})}
                />
              </div>

              {/* Upload Zone */}
              <div className="space-y-2">
                <label className="form-label flex items-center gap-1.5">
                  <Camera className="w-3 h-3 text-primary/60" /> Evidencia Fotográfica
                </label>
                
                <div className="relative group">
                  {/* Hidden Inputs */}
                  <input 
                    id="camera-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <input 
                    id="gallery-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  
                  {formData.Adjunto ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-emerald-500/30 bg-emerald-500/5 group/preview">
                      <img 
                        src={formData.Adjunto} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <label 
                          htmlFor="camera-upload"
                          className="p-3 bg-white text-black rounded-full cursor-pointer hover:scale-110 transition-transform"
                        >
                          <Camera className="w-5 h-5" />
                        </label>
                        <button 
                          onClick={() => setFormData(prev => ({ ...prev, Adjunto: '' }))}
                          className="p-3 bg-white text-destructive rounded-full hover:scale-110 transition-transform"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 p-2 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest text-center shadow-lg">
                        Evidencia Cargada Correctamente
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <label 
                        htmlFor="camera-upload"
                        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                          uploading 
                            ? 'border-primary/20 bg-primary/5 cursor-wait' 
                            : 'border-primary/20 hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Usar Cámara</p>
                          <p className="text-[8px] text-muted-foreground/60 font-bold mt-1">Tomar foto ahora</p>
                        </div>
                      </label>

                      <label 
                        htmlFor="gallery-upload"
                        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                          uploading 
                            ? 'border-primary/20 bg-primary/5 cursor-wait' 
                            : 'border-primary/20 hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Abrir Galería</p>
                          <p className="text-[8px] text-muted-foreground/60 font-bold mt-1">Elegir archivo</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-[11px] font-bold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-6 py-6 animate-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 animate-pulse relative z-10">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full translate-y-2 opacity-50" />
              </div>
              
              <div>
                <h4 className="text-lg font-black uppercase text-foreground leading-none">Ingreso Exitoso</h4>
                <p className="text-[11px] font-bold text-muted-foreground mt-2 max-w-[300px]">
                  El equipo ha sido registrado en la base de datos de devoluciones corporativas.
                </p>
              </div>

              {/* QR Ticket Style Card */}
              <div className="relative group p-6 bg-white rounded-[2.5rem] shadow-2xl border-4 border-muted/5 transition-transform hover:scale-[1.02] duration-500">
                <QRCodeSVG 
                  value={`https://${window.location.host}/public/equipment/${formData.IdEquipo}`}
                  size={140}
                  level="H"
                  includeMargin={true}
                />
                <div className="absolute -bottom-2 -left-2 -right-2 h-4 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="flex flex-col gap-2 w-full max-w-[340px]">
                <button 
                  onClick={handlePrint}
                  className="group relative flex items-center justify-center gap-2 h-11 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20"
                >
                  <Printer className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Imprimir Etiqueta Zebra
                </button>
                <button 
                  onClick={onClose}
                  className="h-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  Finalizar sesión
                </button>
              </div>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="p-5 bg-muted/20 border-t border-border flex justify-end gap-2.5">
            <button 
              onClick={onClose} 
              className="px-6 h-10 text-[10px] font-black uppercase text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={loading || !idEquipoFound}
              className="px-8 h-10 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 flex items-center gap-2"
            >
              {isEditing ? 'Actualizar Cambios' : 'Confirmar Registro'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default NewDevolucionModal;

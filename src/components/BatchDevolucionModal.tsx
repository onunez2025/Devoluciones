import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Calendar,
  User,
  Search,
  CheckCircle2,
  Loader2,
  Package,
  ClipboardList,
  AlertCircle,
  DownloadCloud
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useTranslation } from 'react-i18next';
import apiClient from '../services/apiClient';
import { SIATC_THEME } from '../utils/siatc-theme';
import { cn } from '../utils/cn';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const BatchDevolucionModal = ({ onClose, onSuccess }: Props) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    tech: ''
  });

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const response = await apiClient.get('/lookups/technicians');
      setTechnicians(response.data);
    } catch (err) {
      console.error('Error fetching technicians');
    }
  };

  const searchTickets = async () => {
    if (!filters.date || !filters.tech) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/lookups/tickets-by-period?date=${filters.date}&tech=${filters.tech}`);
      setTickets(response.data);
      setSelectedTicketIds(new Set());
      if (response.data.length === 0) {
        setError(t('batch.errors.noTickets'));
      }
    } catch (err) {
      setError(t('batch.errors.searchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleTicket = (id: string) => {
    const newSelected = new Set(selectedTicketIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTicketIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedTicketIds.size === tickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(tickets.map(t => String(t.Ticket))));
    }
  };

  const exportToExcel = async (selectedData: any[]) => {
    const exportData = selectedData.map(dev => ({
      'Ticket': dev.Ticket,
      'ID_Equipo': dev.IdEquipo,
      'Cliente': dev.NombreCliente || 'N/A',
      'Producto': dev.NombreEquipo || 'N/A',
      'Serie': dev.N_Serie || 'N/A',
      'Guia': dev.N_Guia || 'N/A',
      'URL_Historial': `https://${window.location.host}/public/equipment/${dev.Ticket}`
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ZLabel');
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      worksheet.addRow(headers);
      exportData.forEach(row => worksheet.addRow(headers.map(h => (row as Record<string, unknown>)[h])));
    }
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZLabel_Batch_${filters.tech}_${filters.date}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchSubmit = async () => {
    if (selectedTicketIds.size === 0) return;

    setLoading(true);
    const selectedData = tickets.filter(t => selectedTicketIds.has(String(t.Ticket)));

    try {
      await apiClient.post('/devoluciones/batch', { tickets: selectedData });

      await exportToExcel(selectedData);

      setStep(2);
      onSuccess();
    } catch (err) {
      setError(t('batch.errors.batchFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          "bg-card text-cb-text-primary border border-cb-border shadow-cb-level-3 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col",
          SIATC_THEME.TOKENS.RADIUS.MODAL
        )}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-cb-border bg-cb-bg/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 bg-primary/10 text-primary shadow-inner", SIATC_THEME.TOKENS.RADIUS.BUTTON)}>
              {step === 1 ? <ClipboardList className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tighter text-foreground">
                {step === 1 ? t('batch.title') : t('batch.successTitle')}
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground/60">
                {step === 1 ? t('batch.subtitle') : t('batch.successSubtitle')}
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
            <div className="space-y-6">
              {/* Filtros de Búsqueda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 ml-1 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-primary/60" /> {t('batch.dateLabel')}
                  </label>
                  <input
                    type="date"
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={filters.date}
                    onChange={(e) => setFilters({...filters, date: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 ml-1 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-primary/60" /> {t('batch.techLabel')}
                  </label>
                  <select
                    className={SIATC_THEME.COMPONENTS.INPUT}
                    value={filters.tech}
                    onChange={(e) => setFilters({...filters, tech: e.target.value})}
                  >
                    <option value="">{t('batch.techPlaceholder')}</option>
                    {technicians.map(tech => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={searchTickets}
                disabled={loading || !filters.tech || !filters.date}
                className={cn(
                  "w-full h-11 bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center justify-center gap-2",
                  SIATC_THEME.TOKENS.RADIUS.BUTTON
                )}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t('batch.searchButton')}
              </button>

              {/* Lista de Tickets Resultantes */}
              {tickets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTicketIds.size === tickets.length}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                        {t('batch.selectAll', { count: tickets.length })}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-primary">
                      {t('batch.selectedCount', { count: selectedTicketIds.size })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.Ticket}
                        onClick={() => toggleTicket(String(ticket.Ticket))}
                        className={cn(
                          "p-3 border transition-all cursor-pointer flex items-center gap-3",
                          selectedTicketIds.has(String(ticket.Ticket))
                            ? 'bg-primary/10 border-primary/30 shadow-inner'
                            : 'bg-muted/10 border-cb-border hover:bg-muted/20',
                          SIATC_THEME.TOKENS.RADIUS.CARD
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTicketIds.has(String(ticket.Ticket))}
                          onChange={() => {}} // Handled by div click
                          className="w-4 h-4 rounded border-gray-300 text-primary"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="text-xs font-black">Ticket #{ticket.Ticket}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{ticket.N_Guia || t('common.noGuide')}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{ticket.IdEquipo} • {ticket.N_Serie || 'S/N'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-[11px] font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-6 py-6 animate-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="absolute -right-1 -bottom-1 w-8 h-8 bg-primary border-4 border-background rounded-full flex items-center justify-center text-white shadow-lg">
                  <DownloadCloud className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h4 className="text-lg font-black uppercase text-foreground">{t('batch.successMain')}</h4>
                <p className="text-[11px] font-bold text-muted-foreground mt-2 max-w-[300px]">
                  {t('batch.successSub', { count: selectedTicketIds.size })}
                </p>
              </div>
              <div className={cn("p-4 bg-primary/5 border border-primary/10 flex items-center gap-3 max-w-[400px]", SIATC_THEME.TOKENS.RADIUS.CARD)}>
                <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                <p className="text-[10px] text-left font-bold text-muted-foreground/80 leading-relaxed">
                  {t('batch.zlabelNote')}
                </p>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  "w-full max-w-[200px] h-11 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all",
                  SIATC_THEME.TOKENS.RADIUS.BUTTON
                )}
              >
                {t('batch.closeWindow')}
              </button>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="p-5 bg-muted/20 border-t border-border flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-6 h-10 text-[10px] font-black uppercase text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleBatchSubmit}
              disabled={loading || selectedTicketIds.size === 0}
              className={cn(
                "px-8 h-10 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 flex items-center gap-2",
                SIATC_THEME.TOKENS.RADIUS.BUTTON
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {t('batch.registerSelected', { count: selectedTicketIds.size })}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default BatchDevolucionModal;

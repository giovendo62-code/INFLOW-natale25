
import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download, AlertCircle, Check, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../features/auth/AuthContext';
import { api } from '../../../services/api';

interface GoogleSheetsSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSyncSuccess: () => void;
    initialTab?: 'import' | 'export';
}

export function GoogleSheetsSyncModal({ isOpen, onClose, onSyncSuccess, initialTab = 'import' }: GoogleSheetsSyncModalProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);

    // Joint State
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Select File, 2: Select Sheet, 3: Map/Confirm, 4: Processing
    const [isLoading, setIsLoading] = useState(false);
    const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);

    // Import-specific State
    const [mapping, setMapping] = useState({
        full_name: '',
        surname: '',
        email: '',
        phone: '',
        notes: '',
        fiscal_code: '',
        address: '',
        city: '',

        zip_code: '',
        preferred_styles: ''
    });
    const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

    // Export-specific State
    const [exportStats, setExportStats] = useState({ total: 0 });

    // Config State
    const [isDefault, setIsDefault] = useState(false);
    const [studioConfig, setStudioConfig] = useState<any>(null);

    // Fetch Studio Config on Mount
    useEffect(() => {
        if (user?.studio_id) {
            api.settings.getStudio(user.studio_id).then(studio => {
                if (studio) setStudioConfig(studio);
            });
        }
    }, [user?.studio_id]);

    // Reset when opening or switching tabs
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setMapping({
                full_name: '', surname: '', email: '', phone: '', notes: '',
                fiscal_code: '', address: '', city: '', zip_code: '', preferred_styles: ''
            });
            fetchSpreadsheets();
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const fetchSpreadsheets = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'list_spreadsheets' }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setSpreadsheets(data || []);
        } catch (err: any) {
            console.error('Error fetching spreadsheets:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = async (fileId: string) => {
        setSelectedFile(fileId);
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'get_sheets_metadata', spreadsheetId: fileId }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setSheets(data || []);
            setStep(2);
        } catch (err) {
            console.error(err);
            alert('Impossibile ottenere i fogli.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSheetSelect = async (sheetName: string) => {
        setSelectedSheet(sheetName);

        if (activeTab === 'import') {
            // Fetch headers for mapping
            setIsLoading(true);
            try {
                const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                    body: { action: 'get_sheet_data', spreadsheetId: selectedFile!, sheetName: sheetName }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                if (data && data.length > 0) {
                    setHeaders(data[0]);
                    setStep(3);
                } else {
                    alert('Il foglio sembra vuoto. Aggiungi almeno le intestazioni.');
                }
            } catch (err) {
                console.error(err);
                alert('Errore nel lettura del foglio.');
            } finally {
                setIsLoading(false);
            }
        } else {
            // Export mode: just go to confirmation
            setStep(3);
        }
    };

    const handleImport = async () => {
        setIsLoading(true);
        setStep(4);
        try {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'get_sheet_data', spreadsheetId: selectedFile!, sheetName: selectedSheet! }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            const rows = data.slice(1); // skip header
            let successCount = 0;
            let failCount = 0;

            for (const row of rows) {
                try {
                    // Mapping logic... reuse existing logic
                    const clientData: any = {
                        studio_id: user?.studio_id,
                        created_at: new Date().toISOString()
                    };

                    const getVal = (field: string) => {
                        const colName = (mapping as any)[field];
                        if (!colName) return '';
                        const idx = headers.indexOf(colName);
                        return idx !== -1 ? (row[idx] || '') : '';
                    };

                    let namePart = getVal('full_name');
                    let surnamePart = getVal('surname');
                    clientData.full_name = (namePart + ' ' + surnamePart).trim();
                    clientData.email = getVal('email');
                    clientData.phone = getVal('phone');
                    clientData.notes = getVal('notes');
                    clientData.fiscal_code = getVal('fiscal_code');
                    clientData.address = getVal('address');
                    clientData.city = getVal('city');
                    clientData.zip_code = getVal('zip_code');

                    const stylesRaw = getVal('preferred_styles');
                    if (stylesRaw) {
                        clientData.preferred_styles = stylesRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                    }

                    if (!clientData.full_name) {
                        failCount++;
                        continue;
                    }

                    const { error: insertError } = await supabase.from('clients').insert(clientData);
                    if (insertError) throw insertError;
                    successCount++;
                } catch (e) {
                    console.error('Row import failed', e);
                    failCount++;
                }
            }
            setImportStats({ total: rows.length, success: successCount, failed: failCount });
        } catch (err) {
            console.error(err);
            alert('Errore durante l\'importazione.');
            setStep(3); // Go back
        } finally {
            setIsLoading(false);
        }
    };

    // Configuration State
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // Header -> CRM Field

    // Load saved mapping
    useEffect(() => {
        if (studioConfig?.google_sheets_config?.mapping) {
            setColumnMapping(studioConfig.google_sheets_config.mapping);
            if (activeTab === 'export') {
                setIsDefault(true); // Assume if mapping exists, we want to use it
            }
        }
    }, [studioConfig, activeTab]);

    const fetchSheetHeaders = async () => {
        if (!selectedFile || !selectedSheet) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'get_sheet_data', spreadsheetId: selectedFile!, sheetName: selectedSheet! }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data && data.length > 0) {
                const headers = data[0];
                setSheetHeaders(headers); // First row is headers

                // Auto-map if possible (simple loose match)
                const newMapping: Record<string, string> = { ...columnMapping };
                headers.forEach((header: string) => {
                    const h = header.toLowerCase();
                    if (!newMapping[header]) {
                        if (h.includes('nome')) newMapping[header] = 'first_name';
                        if (h.includes('cognome')) newMapping[header] = 'last_name';
                        if (h.includes('email')) newMapping[header] = 'email';
                        if (h.includes('tel') || h.includes('cell')) newMapping[header] = 'phone';
                        if (h.includes('fisc')) newMapping[header] = 'fiscal_code';
                        if (h.includes('indirizzo')) newMapping[header] = 'address';
                        if (h.includes('citt') || h.includes('city')) newMapping[header] = 'city';
                        if (h.includes('cap')) newMapping[header] = 'zip_code';
                        if (h.includes('hot') || h.includes('not')) newMapping[header] = 'notes';
                        if (h.includes('stil') || h.includes('style') || h.includes('tatuagg')) newMapping[header] = 'preferred_styles';
                        if (h.includes('data') || h.includes('creat')) newMapping[header] = 'created_at';
                    }
                });
                setColumnMapping(newMapping);
            }
        } catch (error) {
            console.error(error);
            alert("Errore nel recupero delle intestazioni. Assicurati che il foglio non sia vuoto.");
        } finally {
            setIsLoading(false);
        }
    };

    const saveMapping = async () => {
        try {
            setIsLoading(true);
            await api.settings.updateStudio(user!.studio_id!, {
                google_sheets_config: {
                    ...studioConfig?.google_sheets_config,
                    mapping: columnMapping,
                    spreadsheet_id: selectedFile!,
                    sheet_name: selectedSheet!,
                    auto_sync_enabled: true
                }
            });
            setIsConfiguring(false);
            alert("Mappatura salvata! La sincronizzazione automatica userà questa configurazione.");
        } catch (error) {
            console.error(error);
            alert("Errore nel salvataggio.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        setIsLoading(true);
        setStep(4);
        try {
            // 1. Fetch all clients
            const { data: clients, error: dpError } = await supabase
                .from('clients')
                .select('*')
                .eq('studio_id', user?.studio_id);

            if (dpError) throw dpError;

            // 2. Format Data based on Mapping
            const hasMapping = Object.keys(columnMapping).length > 0;
            let headersToExport: string[] = [];
            let fieldsToExport: string[] = [];

            if (hasMapping) {
                // Use defined mapping order
                headersToExport = Object.keys(columnMapping);
                fieldsToExport = Object.values(columnMapping);
            } else {
                // Default fallback
                headersToExport = ['Nome', 'Cognome', 'Email', 'Telefono', 'Codice Fiscale', 'Indirizzo', 'Città', 'CAP', 'Stili', 'Note', 'Registrato Il'];
                fieldsToExport = ['first_name', 'last_name', 'email', 'phone', 'fiscal_code', 'address', 'city', 'zip_code', 'preferred_styles', 'notes', 'created_at'];
            }

            const rows = clients.map((c: any) => {
                return fieldsToExport.map(field => {
                    if (field === 'first_name') return (c.full_name || '').split(' ')[0] || '';
                    if (field === 'last_name') {
                        const parts = (c.full_name || '').split(' ');
                        return parts.length > 1 ? parts.slice(1).join(' ') : '';
                    }
                    if (field === 'created_at') return c.created_at ? new Date(c.created_at).toLocaleDateString() : '';
                    if (field === 'preferred_styles') return Array.isArray(c.preferred_styles) ? c.preferred_styles.join(', ') : '';
                    return (c as any)[field] || '';
                });
            });

            const values = [headersToExport, ...rows];

            // 3. Call Edge Function
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: {
                    action: 'export_data',
                    spreadsheetId: selectedFile!,
                    sheetName: selectedSheet!,
                    values: values
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            // 4. Save as default if requested or if we are using the mapping
            if (isDefault || hasMapping) {
                await api.settings.updateStudio(user!.studio_id!, {
                    google_sheets_config: {
                        spreadsheet_id: selectedFile!,
                        sheet_name: selectedSheet!,
                        auto_sync_enabled: true,
                        mapping: columnMapping
                    }
                });
            }

            setExportStats({ total: rows.length });

        } catch (err: any) {
            console.error(err);
            alert(`Errore nell'esportazione: ${err.message}`);
            setStep(3);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-green-600" />
                            Google Sheets Sync
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-fit">
                        <button
                            onClick={() => setActiveTab('import')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'import' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                        >
                            Importa (da Sheets)
                        </button>
                        <button
                            onClick={() => setActiveTab('export')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'export' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                        >
                            Esporta (verso Sheets)
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-gray-500">Elaborazione in corso...</p>
                        </div>
                    )}

                    {!isLoading && step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {activeTab === 'import'
                                    ? "Seleziona il file da importare:"
                                    : "Seleziona il file di destinazione (verrà sovrascritto):"}
                            </p>
                            <div className="grid gap-2">
                                {spreadsheets.map((file) => (
                                    <button
                                        key={file.id}
                                        onClick={() => handleFileSelect(file.id)}
                                        className="flex items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 hover:ring-1 hover:ring-green-500 transition-all group text-left"
                                    >
                                        <FileSpreadsheet className="w-8 h-8 text-green-600 mr-4 opacity-70 group-hover:opacity-100" />
                                        <span className="font-medium text-gray-900 dark:text-white">{file.name}</span>
                                    </button>
                                ))}
                                {spreadsheets.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">Nessun foglio trovato. Assicurati di aver collegato l'account nelle Impostazioni.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {!isLoading && step === 2 && (
                        <div className="space-y-4">
                            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-900 mb-2">← Indietro</button>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Seleziona il foglio (tab) specifico:</p>
                            <div className="grid gap-2">
                                {sheets.map((sheet, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSheetSelect(sheet)}
                                        className="flex items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                    >
                                        <span className="font-medium text-gray-900 dark:text-white">{sheet}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Different for Import/Export */}

                    {!isLoading && step === 3 && activeTab === 'import' && (
                        <div className="space-y-6">
                            <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-900">← Indietro</button>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                    Mappa le colonne del file Excel/Sheets con i campi di InkFlow.
                                </div>
                            </div>

                            <div className="space-y-4 grid grid-cols-2 gap-4">
                                {[
                                    { key: 'full_name', label: 'Nome (o Nome Completo)' },
                                    { key: 'surname', label: 'Cognome' },
                                    { key: 'email', label: 'Email' },
                                    { key: 'phone', label: 'Telefono' },
                                    { key: 'fiscal_code', label: 'Codice Fiscale' },
                                    { key: 'address', label: 'Indirizzo' },
                                    { key: 'city', label: 'Città' },
                                    { key: 'zip_code', label: 'CAP' },
                                    { key: 'zip_code', label: 'CAP' },
                                    { key: 'preferred_styles', label: 'Stili Preferiti (separati da virgola)' },
                                    { key: 'notes', label: 'Note' }
                                ].map((field) => (
                                    <div key={field.key}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            {field.label}
                                        </label>
                                        <select
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                            value={(mapping as any)[field.key]}
                                            onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                        >
                                            <option value="">Seleziona...</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isLoading && step === 3 && activeTab === 'export' && (
                        <div className="space-y-6 text-center py-8 relative">
                            <button onClick={() => setStep(2)} className="absolute top-0 left-0 text-sm text-gray-500 hover:text-gray-900">← Indietro</button>

                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600">
                                <AlertCircle size={32} />
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Conferma Esportazione</h3>
                            <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mt-2">
                                Stai per esportare tutti i clienti nel foglio <b>{selectedSheet}</b>. <br />
                                <span className="text-red-500 font-bold text-xs mt-2 block">ATTENZIONE: Il contenuto verrà sovrascritto.</span>
                            </p>

                            {/* Mapping Configuration UI */}
                            <div className="mt-6 text-left max-w-md mx-auto">
                                <button
                                    onClick={() => { setIsConfiguring(!isConfiguring); if (!isConfiguring && sheetHeaders.length === 0) fetchSheetHeaders(); }}
                                    className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center gap-2 mx-auto mb-2"
                                >
                                    {isConfiguring ? 'Chiudi Configurazione' : 'Opzioni Avanzate: Configura Colonne'}
                                </button>

                                {isConfiguring && (
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-sm">Mappatura Colonne</h4>
                                            {sheetHeaders.length === 0 && (
                                                <button onClick={fetchSheetHeaders} disabled={isLoading} className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                                                    Leggi Intestazioni
                                                </button>
                                            )}
                                        </div>

                                        {sheetHeaders.length > 0 ? (
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                {sheetHeaders.map(header => (
                                                    <div key={header} className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="truncate w-1/3 text-gray-600 dark:text-gray-400" title={header}>{header}</span>
                                                        <span className="text-gray-400">→</span>
                                                        <select
                                                            className="flex-1 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                                            value={columnMapping[header] || ''}
                                                            onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                                                        >
                                                            <option value="">-- Ignora --</option>
                                                            <option value="first_name">Nome</option>
                                                            <option value="last_name">Cognome</option>
                                                            <option value="email">Email</option>
                                                            <option value="phone">Telefono</option>
                                                            <option value="fiscal_code">Codice Fiscale</option>
                                                            <option value="address">Indirizzo</option>
                                                            <option value="city">Città</option>
                                                            <option value="zip_code">CAP</option>
                                                            <option value="zip_code">CAP</option>
                                                            <option value="preferred_styles">Stili Preferiti</option>
                                                            <option value="notes">Note</option>
                                                            <option value="created_at">Data Reg.</option>
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-center text-gray-500 py-4">Clicca "Leggi Intestazioni" per caricare le colonne dal tuo foglio.</p>
                                        )}

                                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={saveMapping}
                                                disabled={isLoading}
                                                className="w-full py-2 bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 rounded font-bold text-xs transition-colors"
                                            >
                                                Salva come Predefinito
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center gap-4 mt-8">
                                <button
                                    onClick={() => handleExport()}
                                    className="px-8 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover transition-transform active:scale-95 shadow-lg shadow-accent/20 flex items-center gap-2"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Conferma e Sovrascrivi'}
                                </button>
                            </div>

                            <div className="mt-6 flex justify-center">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 select-none bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={isDefault}
                                        onChange={(e) => setIsDefault(e.target.checked)}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span>Usa come foglio predefinito per il salvataggio automatico</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {!isLoading && step === 4 && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {activeTab === 'import' ? 'Importazione Completata!' : 'Esportazione Completata!'}
                            </h3>

                            {activeTab === 'import' ? (
                                <div className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg inline-block text-left text-sm">
                                    <p>Totale: <b>{importStats.total}</b></p>
                                    <p className="text-green-600">Successo: <b>{importStats.success}</b></p>
                                    <p className="text-red-500">Errori: <b>{importStats.failed}</b></p>
                                </div>
                            ) : (
                                <div className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg inline-block text-center text-sm">
                                    <p>Clienti esportati:</p>
                                    <p className="text-2xl font-bold text-green-600">{exportStats.total}</p>
                                </div>
                            )}

                            <div className="mt-8">
                                <button onClick={() => { onSyncSuccess(); onClose(); }} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover">
                                    Chiudi
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions (Step 3 Import only) */}
                {!isLoading && step === 3 && activeTab === 'import' && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">Annulla</button>
                        <button
                            onClick={handleImport}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Avvia Importazione
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

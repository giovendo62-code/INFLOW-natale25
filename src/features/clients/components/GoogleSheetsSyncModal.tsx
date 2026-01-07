
import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download, AlertCircle, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../features/auth/AuthContext';

interface GoogleSheetsSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSyncSuccess: () => void;
}

export function GoogleSheetsSyncModal({ isOpen, onClose, onSyncSuccess }: GoogleSheetsSyncModalProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

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
        zip_code: ''
    });
    const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

    // Export-specific State
    const [exportStats, setExportStats] = useState({ total: 0 });

    // Reset when opening or switching tabs
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setMapping({
                full_name: '', surname: '', email: '', phone: '', notes: '',
                fiscal_code: '', address: '', city: '', zip_code: ''
            });
            fetchSpreadsheets();
        }
    }, [isOpen, activeTab]);

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
                    body: { action: 'get_sheet_data', spreadsheetId: selectedFile, sheetName: sheetName }
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
                body: { action: 'get_sheet_data', spreadsheetId: selectedFile, sheetName: selectedSheet }
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

            // 2. Format Data
            const exportHeaders = ['Nome', 'Email', 'Telefono', 'Codice Fiscale', 'Indirizzo', 'Città', 'CAP', 'Note', 'Registrato Il'];
            const rows = clients.map((c: any) => [
                c.full_name || '',
                c.email || '',
                c.phone || '',
                c.fiscal_code || '',
                c.address || '',
                c.city || '',
                c.zip_code || '',
                c.notes || '',
                c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
            ]);

            const values = [exportHeaders, ...rows];

            // 3. Call Edge Function
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: {
                    action: 'export_data',
                    spreadsheetId: selectedFile,
                    sheetName: selectedSheet,
                    values: values
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

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
                                {['full_name', 'email', 'phone', 'notes', 'fiscal_code', 'address', 'city', 'zip_code'].map(field => (
                                    <div key={field}>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">{field.replace('_', ' ')}</label>
                                        <select
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                            value={(mapping as any)[field]}
                                            onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
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
                                Stai per esportare tutti i clienti. <br />
                                <span className="font-bold text-red-500">ATTENZIONE: Il contenuto del foglio "{selectedSheet}" verrà sovrascritto.</span>
                            </p>

                            <div className="flex justify-center gap-4 mt-8">
                                <button onClick={() => handleExport()} className="px-8 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover transition-transform active:scale-95 shadow-lg shadow-accent/20">
                                    Conferma e Sovrascrivi
                                </button>
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


import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download, AlertCircle, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../features/auth/AuthContext';

interface ImportClientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: () => void;
}

export function ImportClientsModal({ isOpen, onClose, onImportSuccess }: ImportClientsModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Select File, 2: Select Sheet, 3: Map Columns, 4: Importing
    const [isLoading, setIsLoading] = useState(false);
    const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);

    // Mapping state
    const [mapping, setMapping] = useState({
        full_name: '',
        surname: '', // Added surname
        email: '',
        phone: '',
        notes: '',
        fiscal_code: '',
        address: '',
        city: '',
        zip_code: ''
    });

    const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });

    // Step 1: Fetch Spreadsheets
    useEffect(() => {
        if (isOpen && step === 1) {
            fetchSpreadsheets();
        }
    }, [isOpen]);

    const fetchSpreadsheets = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'list_spreadsheets' }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error); // Handle logic errors from backend
            setSpreadsheets(data || []);
        } catch (err: any) {
            console.error('Error fetching spreadsheets:', err);
            alert(`Errore nel caricamento dei fogli: ${err.message || err}`);
            // Handle error (e.g., token expired, need to reconnect)
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Fetch Sheets metadata
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
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Fetch Headers
    const handleSheetSelect = async (sheetName: string) => {
        setSelectedSheet(sheetName);
        setIsLoading(true);
        try {
            // Fetch just the first row to get headers
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'get_sheet_data', spreadsheetId: selectedFile, sheetName: sheetName }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data && data.length > 0) {
                setHeaders(data[0]); // First row is header
                setStep(3);
            } else {
                alert('Sheet appears to be empty');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 4: Import Data
    const handleImport = async () => {
        setIsLoading(true);
        setStep(4);
        try {
            // Fetch ALL data
            const { data, error } = await supabase.functions.invoke('fetch-google-sheets', {
                body: { action: 'get_sheet_data', spreadsheetId: selectedFile, sheetName: selectedSheet }
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            const rows = data.slice(1); // Skip header
            let successCount = 0;
            let failCount = 0;

            for (const row of rows) {
                try {
                    const clientData: any = {
                        studio_id: user?.studio_id, // Assuming context has this or fetch logic
                        created_at: new Date().toISOString()
                    };

                    // Map fields based on index
                    let namePart = '';
                    if (mapping.full_name) namePart = row[headers.indexOf(mapping.full_name)] || '';

                    let surnamePart = '';
                    if (mapping.surname) surnamePart = row[headers.indexOf(mapping.surname)] || '';

                    // Combine Name + Surname if surname exists, otherwise just use Name column as full_name
                    clientData.full_name = (namePart + ' ' + surnamePart).trim();

                    if (mapping.email) clientData.email = row[headers.indexOf(mapping.email)];
                    if (mapping.phone) clientData.phone = row[headers.indexOf(mapping.phone)];
                    if (mapping.notes) clientData.notes = row[headers.indexOf(mapping.notes)];
                    if (mapping.fiscal_code) clientData.fiscal_code = row[headers.indexOf(mapping.fiscal_code)];
                    if (mapping.address) clientData.address = row[headers.indexOf(mapping.address)];
                    if (mapping.city) clientData.city = row[headers.indexOf(mapping.city)];
                    if (mapping.zip_code) clientData.zip_code = row[headers.indexOf(mapping.zip_code)];

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
            // Don't close immediately, show stats

        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-card w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-green-600" />
                            Importa Clienti da Google Sheets
                        </h2>
                        <p className="text-xs text-gray-500">Passo {step} di 3</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-gray-500">Caricamento in corso...</p>
                        </div>
                    )}

                    {!isLoading && step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Seleziona il file Google Sheet da cui importare:</p>
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
                                    <div className="text-center py-8 text-gray-500">Nessun foglio trovato. Assicurati di aver collegato l'account.</div>
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

                    {!isLoading && step === 3 && (
                        <div className="space-y-6">
                            <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-900">← Indietro</button>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                    Associa le colonne del tuo file ai campi di InkFlow.
                                    I dati della prima riga verranno usati come intestazioni.
                                </div>
                            </div>

                            <div className="space-y-4 grid grid-cols-2 gap-4">
                                {/* Name Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome (o Nome Completo) *</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.full_name}
                                        onChange={(e) => setMapping({ ...mapping, full_name: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Surname Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cognome (Opzionale)</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.surname}
                                        onChange={(e) => setMapping({ ...mapping, surname: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Email Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.email}
                                        onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Phone Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefono</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.phone}
                                        onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Fiscal Code Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Codice Fiscale</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.fiscal_code}
                                        onChange={(e) => setMapping({ ...mapping, fiscal_code: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Address Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indirizzo</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.address}
                                        onChange={(e) => setMapping({ ...mapping, address: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* City Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Città</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.city}
                                        onChange={(e) => setMapping({ ...mapping, city: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* ZIP Code Mapping */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CAP</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.zip_code}
                                        onChange={(e) => setMapping({ ...mapping, zip_code: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                {/* Notes Mapping */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
                                    <select
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        value={mapping.notes}
                                        onChange={(e) => setMapping({ ...mapping, notes: e.target.value })}
                                    >
                                        <option value="">Seleziona colonna...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isLoading && step === 4 && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Importazione Completata!</h3>
                            <div className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg inline-block text-left text-sm">
                                <p>Totale righe: <b>{importStats.total}</b></p>
                                <p className="text-green-600">Importati con successo: <b>{importStats.success}</b></p>
                                <p className="text-red-500">Falliti / Saltati: <b>{importStats.failed}</b></p>
                            </div>
                            <div className="mt-8">
                                <button onClick={() => { onImportSuccess(); onClose(); }} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover">
                                    Chiudi
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                {!isLoading && step === 3 && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">Annulla</button>
                        <button
                            onClick={() => {
                                if (!mapping.full_name) {
                                    alert("Per favore seleziona almeno la colonna 'Nome Completo' per proseguire.");
                                    return;
                                }
                                handleImport();
                            }}
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

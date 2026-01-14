
import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../../services/api';

interface ImportStats {
    total: number;
    success: number;
    failed: number;
}

interface UseGoogleSheetsSyncReturn {
    isSyncing: boolean;
    error: string | null;
    stats: ImportStats | null;
    syncClients: () => Promise<void>;
    hasConfig: boolean;
}

export const useGoogleSheetsSync = (): UseGoogleSheetsSyncReturn => {
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<ImportStats | null>(null);
    const [hasConfig, setHasConfig] = useState(false);

    // Initial check for config
    const checkConfig = useCallback(async () => {
        if (!user?.studio_id) return false;
        try {
            const studio = await api.settings.getStudio(user.studio_id);
            const config = studio?.google_sheets_config;
            const valid = !!(config?.spreadsheet_id && config?.sheet_name && config?.mapping);
            setHasConfig(valid);
            return valid;
        } catch (err) {
            console.error('Error checking studio config:', err);
            return false;
        }
    }, [user?.studio_id]);

    // We can run checkConfig on mount if we want "hasConfig" to be ready immediately,
    // but typically we might just check before sync or rely on the UI to call it.
    // For now, let's expose it as a state that updates when sync is attempted or we can add an effect.
    // Adding an effect to check immediately.
    useState(() => {
        checkConfig();
    });

    const syncClients = async () => {
        if (!user?.studio_id) return;

        setIsSyncing(true);
        setError(null);
        setStats(null);

        try {
            // 1. Get Studio Config
            const studio = await api.settings.getStudio(user.studio_id);
            const config = studio?.google_sheets_config;

            if (!config?.spreadsheet_id || !config?.sheet_name || !config?.mapping) {
                throw new Error("Configurazione Google Sheets mancante o incompleta. Configura l'importazione dalle impostazioni o dal tasto 'Importa'.");
            }

            const { spreadsheet_id, sheet_name, mapping } = config;

            // 2. Fetch Data from Google Sheets
            const { data, error: funcError } = await supabase.functions.invoke('fetch-google-sheets', {
                body: {
                    action: 'get_sheet_data',
                    spreadsheetId: spreadsheet_id,
                    sheetName: sheet_name
                }
            });

            if (funcError) throw funcError;
            if (data?.error) throw new Error(data.error);
            if (!data || data.length === 0) throw new Error("Il foglio selezionato è vuoto.");

            const headers = data[0]; // First row
            const rows = data.slice(1); // Data rows

            let successCount = 0;
            let failCount = 0;

            // 3. Process Rows
            for (const row of rows) {
                try {
                    const clientData: any = {
                        studio_id: user.studio_id,
                        created_at: new Date().toISOString()
                    };

                    // Helper to get value from row based on column name
                    // mapping is { "ColumnName": "db_field" }

                    let firstName = '';
                    let lastName = '';

                    Object.entries(mapping).forEach(([headerName, dbField]) => {
                        const headerIdx = headers.indexOf(headerName);
                        if (headerIdx === -1) return;

                        const val = row[headerIdx];
                        if (!val) return;

                        if (dbField === 'first_name') firstName = val;
                        else if (dbField === 'last_name') lastName = val;
                        else if (dbField === 'preferred_styles') {
                            clientData.preferred_styles = val.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                        }
                        else {
                            // Direct map for others
                            clientData[dbField as string] = val;
                        }
                    });

                    // Construct full_name if not mapped directly
                    if (firstName || lastName) {
                        clientData.full_name = `${firstName} ${lastName}`.trim();
                    }

                    // Fallback: if user mapped "full_name" directly (legacy or simple map)
                    // The mapping UI in Modal allows selecting "first_name"/"last_name" OR custom?
                    // The modal select options are hardcoded to 'first_name', 'last_name', etc.
                    // So we shouldn't worry about 'full_name' mapping unless we add it to the select.
                    // But wait, the modal's `handleImport` logic uses `full_name` KEY for internal state, not mapping value.

                    // Validation
                    if (!clientData.full_name) {
                        // Skip if no name
                        failCount++;
                        continue;
                    }

                    // Insert
                    const { error: insertError } = await supabase.from('clients').insert(clientData);
                    if (insertError) throw insertError;

                    successCount++;

                } catch (e) {
                    console.error('Row sync failed', e);
                    failCount++;
                }
            }

            setStats({ total: rows.length, success: successCount, failed: failCount });

        } catch (err: any) {
            console.error('Sync error:', err);
            setError(err.message || "Errore sconosciuto durante la sincronizzazione");
        } finally {
            setIsSyncing(false);
        }
    };

    return { isSyncing, error, stats, syncClients, hasConfig };
};

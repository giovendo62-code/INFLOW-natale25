import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Play, AlertTriangle } from 'lucide-react';

export const WaitlistOptimizer: React.FC = () => {
    const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'MIGRATING' | 'COMPLETED' | 'ERROR'>('IDLE');
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

    const startMigration = async () => {
        try {
            setStatus('SCANNING');
            addLog("Inizio scansione database...");

            // 1. Fetch entries with potential Base64 images
            // We select only ID and images to minimize load, but even images can be huge.
            // We might need to page this if it's truly massive.
            const { data: entries, error } = await supabase
                .from('waitlist_entries')
                .select('id, images')
                .not('images', 'is', null);

            if (error) throw error;
            if (!entries) {
                addLog("Nessuna voce trovata.");
                setStatus('COMPLETED');
                return;
            }

            const entriesToMigrate = entries.filter((e: any) => {
                if (!e.images || !Array.isArray(e.images)) return false;
                return e.images.some((img: string) => img.startsWith('data:image'));
            });

            setTotal(entriesToMigrate.length);
            addLog(`Trovate ${entriesToMigrate.length} voci con immagini vecchie da convertire.`);

            if (entriesToMigrate.length === 0) {
                setStatus('COMPLETED');
                return;
            }

            setStatus('MIGRATING');

            // 2. Process each entry
            let processed = 0;
            for (const entry of entriesToMigrate) {
                addLog(`Elaborazione ID: ${entry.id.slice(0, 8)}...`);

                const newImages: string[] = [];
                let hasChanges = false;

                for (const imgStr of entry.images) {
                    if (imgStr.startsWith('data:image')) {
                        try {
                            // Convert Base64 to Blob
                            const res = await fetch(imgStr);
                            const blob = await res.blob();
                            const file = new File([blob], `migrated_${Date.now()}.jpg`, { type: blob.type });

                            // Upload to Supabase Storage
                            const path = `migration/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                            const { error: uploadError } = await supabase.storage
                                .from('waitlist')
                                .upload(path, file);

                            if (uploadError) throw uploadError;

                            // Get Public URL
                            const { data: { publicUrl } } = supabase.storage
                                .from('waitlist')
                                .getPublicUrl(path);

                            newImages.push(publicUrl);
                            hasChanges = true;
                            addLog(` -> Immagine convertita e caricata.`);
                        } catch (err: any) {
                            console.error("Failed to migrate image", err);
                            addLog(` -> ERRORE conversione immagine: ${err.message}`);
                            newImages.push(imgStr); // Keep original if fail
                        }
                    } else {
                        newImages.push(imgStr); // Already a URL
                    }
                }

                if (hasChanges) {
                    // Update Database
                    const { error: updateError } = await supabase
                        .from('waitlist_entries')
                        .update({ images: newImages })
                        .eq('id', entry.id);

                    if (updateError) {
                        addLog(` -> ERRORE salvataggio DB: ${updateError.message}`);
                    } else {
                        addLog(` -> Aggiornato con successo.`);
                    }
                }

                processed++;
                setProgress(processed);
            }

            setStatus('COMPLETED');
            addLog("Migrazione completata!");

        } catch (err: any) {
            console.error(err);
            setStatus('ERROR');
            addLog(`ERRORE CRITICO: ${err.message}`);
        }
    };

    if (status === 'IDLE') {
        return (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6">
                <h3 className="text-yellow-500 font-bold flex items-center gap-2 mb-2">
                    <AlertTriangle size={20} />
                    Ottimizzazione Necessaria
                </h3>
                <p className="text-sm text-text-muted mb-4">
                    Il database contiene immagini "pesanti" che rallentano l'app.
                    Esegui questo strumento per convertirle e velocizzare il caricamento senza perdere dati.
                </p>
                <button
                    onClick={startMigration}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                    <Play size={16} />
                    Avvia Ottimizzazione Immagini
                </button>
            </div>
        );
    }

    return (
        <div className="bg-bg-secondary border border-border p-4 rounded-lg mb-6">
            <h3 className="text-text-primary font-bold mb-4 flex items-center justify-between">
                Stato Ottimizzazione
                {status === 'MIGRATING' && <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">{progress} / {total}</span>}
                {status === 'COMPLETED' && <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded">Completato</span>}
            </h3>

            <div className="w-full bg-bg-tertiary h-2 rounded-full mb-4 overflow-hidden">
                <div
                    className="bg-accent h-full transition-all duration-300"
                    style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                />
            </div>

            <div className="bg-black/50 p-4 rounded-lg h-40 overflow-y-auto font-mono text-xs text-text-muted space-y-1">
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>

            {status === 'COMPLETED' && (
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 w-full bg-green-500 text-white py-2 rounded-lg font-bold"
                >
                    Ricarica Pagina
                </button>
            )}
        </div>
    );
};

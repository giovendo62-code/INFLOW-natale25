
import { useEffect, useState } from 'react';
import { MessageCircle, Star, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

interface ReviewRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    clientPhone?: string;
    studioId?: string;
}

export function ReviewRequestModal({ isOpen, onClose, clientName, clientPhone, studioId }: ReviewRequestModalProps) {
    const [reviewUrl, setReviewUrl] = useState<string | null>(null);
    const [studioName, setStudioName] = useState<string>('InkFlow Studio');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [phone, setPhone] = useState(clientPhone || '');

    useEffect(() => {
        setPhone(clientPhone || '');
    }, [clientPhone, isOpen]);

    useEffect(() => {
        if (isOpen && studioId) {
            setLoading(true);
            setError(null);
            api.settings.getStudio(studioId)
                .then(studio => {
                    console.log('[ReviewModal] Fetched studio:', studio);
                    if (studio) {
                        setStudioName(studio.name || 'InkFlow Studio');
                        if (studio.google_review_url) {
                            console.log('[ReviewModal] Found Google Review URL:', studio.google_review_url);
                            setReviewUrl(studio.google_review_url);
                        } else {
                            console.warn('[ReviewModal] google_review_url is missing in studio data');
                            setReviewUrl(null);
                            setError('Link recensione Google non configurato nelle Impostazioni Studio');
                        }
                    } else {
                        console.error('[ReviewModal] Studio data is null');
                        setError('Dati studio non trovati');
                    }
                })
                .catch(err => {
                    console.error('[ReviewModal] Failed to fetch studio settings', err);
                    setError('Errore nel recupero delle impostazioni dello studio');
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, studioId]);

    if (!isOpen) return null;

    const message = `Gentile ${clientName},

è stato un piacere averti con noi in studio. Speriamo che tu sia entusiasta del tuo nuovo tatuaggio!

La nostra crescita dipende dalla soddisfazione dei nostri clienti. Per questo, abbiamo deciso di premiarti: lascia una recensione sul tuo feedback al link qui sotto e riceverai un coupon del 10% di sconto sul tuo prossimo tatuaggio e una crema specifica per la cura in omaggio.

Ti basterà mostrarci la recensione pubblicata al link: ${reviewUrl || '[LINK RECENSIONE]'}

Grazie per aver scelto il ${studioName} e per il tuo supporto!`;

    const handleSendWhatsapp = () => {
        if (!reviewUrl) {
            console.error('[ReviewModal] Review URL is missing, cannot send.');
            return;
        }

        console.log('[ReviewModal] Sending WhatsApp. Client:', clientName, 'Phone:', phone, 'URL:', reviewUrl);

        const encodedMessage = encodeURIComponent(message);

        let url = `https://api.whatsapp.com/send?text=${encodedMessage}`;

        if (phone) {
            // 1. Remove everything except digits
            let cleanPhone = phone.replace(/\D/g, '');

            // 2. Handle Italian prefix (Special Case)
            // If it's 10 digits (e.g. 3331234567), assume IT mobile and prepend 39.
            // If it's already 12 digits starting with 39 (e.g. 393331234567), leave it.
            if (cleanPhone.length === 10) {
                cleanPhone = '39' + cleanPhone;
                console.log('[ReviewModal] Prepended 39 prefix:', cleanPhone);
            }

            // 3. Construct URL using robust API
            if (cleanPhone.length >= 8) {
                // Using api.whatsapp.com/send is more consistent than wa.me often
                url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
            } else {
                console.warn('[ReviewModal] Phone number too short after cleaning:', cleanPhone);
                // Fallback to generic link
            }
        } else {
            console.log('[ReviewModal] No phone provided, using generic link.');
        }

        console.log('[ReviewModal] Opening URL:', url);

        // Use a try-catch for window.open just in case, though unlikely to throw synchronously
        try {
            const newWindow = window.open(url, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
                // Popup blocked?
                console.warn('[ReviewModal] Window might have been blocked.');
            }
        } catch (e) {
            console.error('[ReviewModal] Failed to open window:', e);
            alert('Impossibile aprire il link di WhatsApp. Controlla le impostazioni del browser.');
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white text-center">
                    <div className="bg-white/20 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                        <Star className="w-8 h-8 text-white fill-current" />
                    </div>
                    <h2 className="text-2xl font-bold">Richiedi una Recensione!</h2>
                    <p className="text-white/90 text-sm mt-1">L'appuntamento è completato.</p>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-gray-600 dark:text-gray-300 text-center">
                        Vuoi inviare un messaggio WhatsApp a <b>{clientName}</b> per chiedere una recensione su Google?
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            WhatsApp Telefono
                        </label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Es. 333 1234567"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Modifica se necessario (aggiungiamo +39 auto se 10 cifre)
                        </p>
                    </div>

                    {loading ? (
                        <div className="text-center text-sm text-gray-500">Caricamento link...</div>
                    ) : error ? (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-xs text-gray-500 dark:text-gray-400 italic border border-gray-100 dark:border-gray-700 max-h-40 overflow-y-auto whitespace-pre-line">
                            {message}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Più tardi
                        </button>
                        <button
                            onClick={handleSendWhatsapp}
                            disabled={!reviewUrl || loading}
                            className={`flex-1 py-3 px-4 text-white rounded-xl font-bold transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg ${!reviewUrl || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#20bd5a] shadow-green-500/20'}`}
                        >
                            <MessageCircle className="w-5 h-5" />
                            Invia su WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

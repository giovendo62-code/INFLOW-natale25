
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

    useEffect(() => {
        if (isOpen && studioId) {
            setLoading(true);
            setError(null);
            api.settings.getStudio(studioId)
                .then(studio => {
                    if (studio) {
                        setStudioName(studio.name || 'InkFlow Studio');
                        if (studio.google_review_url) {
                            setReviewUrl(studio.google_review_url);
                        } else {
                            setReviewUrl(null);
                            setError('Link recensione Google non configurato nelle Impostazioni Studio');
                        }
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch studio settings', err);
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
        if (!reviewUrl) return;

        const encodedMessage = encodeURIComponent(message);
        // If phone is provided, target it, otherwise generic link (user picks contact)
        // Ideally we should use the client's phone number if available. 
        // Assuming clientPhone format is clean or needs sanitization.
        // For simplicity, we'll try to use the phone if valid, else just open wa.me to pick contact? 
        // Actually wa.me/number?text=... requires a number. 

        let url = `https://wa.me/?text=${encodedMessage}`;
        if (clientPhone) {
            const cleanPhone = clientPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
                url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
            }
        }

        window.open(url, '_blank');
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

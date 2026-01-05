import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { goal, tone, length, customContext, apiKey: userApiKey, studioName, studioAddress, studioPhone } = await req.json()

        // Use user-supplied key or environment key
        const apiKey = userApiKey || Deno.env.get('GEMINI_API_KEY');

        if (!apiKey) {
            throw new Error('API Key mancante. Inseriscila nel campo "Configurazione AI" o configura GEMINI_API_KEY nel server.');
        }

        const signature = [`A presto, ${studioName || 'lo Studio'}`, studioAddress, studioPhone ? `Tel: ${studioPhone}` : ''].filter(Boolean).join(', ');

        const systemPrompt = `Sei un esperto copywriter di marketing per studi di tatuaggi.
Scrivi 3 varianti di un messaggio promozionale breve ed efficace.
Obiettivo: ${goal}
Tono: ${tone}
Lunghezza: ${length}
Contesto extra: ${customContext || 'Nessuno'}

IMPORTANTE: 
1. Ogni messaggio DEVE terminare con la firma completa: "${signature}".
2. Usa spaziature e vai a capo tra una frase e l'altra per rendere il testo leggibile e non un blocco unico.
3. Se devi citare il nome del cliente usa SEMPRE il segnaposto {{nome}}.

Formatta la risposta ESCLUSIVAMENTE come un JSON array di stringhe, esempio: ["Ciao {{nome}}, ecco l'offerta...", "Ehi {{nome}}, non perdere..."].
Nessun altro testo prima o dopo.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: systemPrompt
                        }]
                    }]
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Errore nella chiamata a Gemini API');
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            throw new Error('Nessuna risposta generata.');
        }

        // Try to parse JSON array from text
        let options = [];
        try {
            // Clean markdown code blocks if present
            const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            options = JSON.parse(jsonStr);
        } catch (e) {
            console.warn('Failed to parse JSON, returning raw text split', e);
            // Fallback: simply return the raw text as one option or split by newlines
            options = [rawText];
        }

        return new Response(
            JSON.stringify(options),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
})

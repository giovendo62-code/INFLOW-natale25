import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Client, ConsentTemplate, ClientConsent, Studio } from '../services/types';

export const generateConsentPDF = async (
    client: Client,
    template: ConsentTemplate,
    consent: ClientConsent,
    studio?: Studio | null
) => {
    // Create a temporary container for the PDF content
    const container = document.createElement('div');
    container.style.position = 'fixed'; // Avoid visible rendering
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // A4 width
    container.style.minHeight = '297mm'; // A4 height
    container.style.padding = '20mm';
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12px';
    container.style.lineHeight = '1.5';
    document.body.appendChild(container);

    // 1. Populate Template Variables
    let contentHtml = template.content
        .replace('{{nome}}', client.full_name) // Simple replacement
        .replace('{{cognome}}', '') // If full_name has spaces, simplistic
        .replace('{{studio_nome}}', studio?.name || 'InkFlow Studio')
        .replace('{{data_nascita}}', '---')
        .replace('{{codice_fiscale}}', client.fiscal_code || '---');

    // 2. Build HTML Structure
    container.innerHTML = `
        <div class="pdf-content">
            <div style="margin-bottom: 20px; text-align: center;">
                <h1 style="font-size: 24px; font-weight: bold;">${studio?.company_name || studio?.name || 'InkFlow Studio'}</h1>
                <p style="font-size: 10px; color: #666;">
                    ${studio?.address || ''} ${studio?.city ? `- ${studio.city}` : ''}
                    ${studio?.phone ? `<br/>Tel: ${studio.phone}` : ''}
                    ${studio?.vat_number ? `<br/>P.IVA: ${studio.vat_number}` : ''}
                    ${studio?.fiscal_code ? ` - CF: ${studio.fiscal_code}` : ''}
                </p>
                <hr style="border: 0; border-bottom: 1px solid #ccc; margin: 20px 0;" />
            </div>

            <div style="margin-bottom: 30px;">
                ${contentHtml}
            </div>

            <div style="margin-top: 50px; break-inside: avoid;">
                <p style="font-weight: bold; margin-bottom: 10px;">Firma del Cliente:</p>
                ${consent.signature_url ? `<img src="${consent.signature_url}" style="max-height: 80px; max-width: 200px; border-bottom: 1px solid #000;" />` : '<p>[Firma Mancante]</p>'}
                <p style="font-size: 10px; margin-top: 5px;">Firmato digitalmente il: ${new Date(consent.signed_at).toLocaleString()}</p>
                 <p style="font-size: 10px; color: #999;">ID Consenso: ${consent.id}</p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                ${studio?.company_name || studio?.name || 'InkFlow Studio'} 
                ${studio?.vat_number ? `- P.IVA: ${studio.vat_number}` : ''}
            </div>
        </div>
    `;

    try {
        // 3. Convert to Canvas
        const canvas = await html2canvas(container, {
            scale: 2, // Retire higher quality
            useCORS: true,
            logging: false
        });

        // 4. Create PDF
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Simple single page handling for now, or multi-page if needed
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        // Save
        const filename = `Consenso_${client.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);

    } catch (err) {
        console.error("PDF Generation Error:", err);
        throw err;
    } finally {
        // Cleanup
        document.body.removeChild(container);
    }
};

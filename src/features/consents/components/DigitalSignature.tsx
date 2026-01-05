import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check } from 'lucide-react';

interface DigitalSignatureProps {
    onSave: (data: string) => void;
    onClear: () => void;
}

export const DigitalSignature: React.FC<DigitalSignatureProps> = ({ onSave, onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasContent, setHasContent] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas styling
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // High DPI scaling
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        // Clear background to white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);

    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const { x, y } = getCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasContent(true);
    };

    const endDrawing = () => {
        setIsDrawing(false);
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);

        setHasContent(false);
        onClear();
    };

    const handleSave = () => {
        if (!hasContent) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        onSave(canvas.toDataURL());
    };

    return (
        <div className="bg-white rounded-lg p-4 shadow-lg flex flex-col gap-4 w-full md:w-[600px]">
            <div className="border-2 border-dashed border-gray-300 rounded-lg touch-none bg-white overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="w-full h-64 bg-white cursor-crosshair block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                />
            </div>
            <div className="flex justify-between items-center text-sm">
                <p className="text-gray-500">Sign above using your mouse or finger.</p>
                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Eraser size={18} />
                        Clear
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasContent}
                        className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-bold shadow-lg shadow-accent/20"
                    >
                        <Check size={18} />
                        Confirm Signature
                    </button>
                </div>
            </div>
        </div>
    );
};

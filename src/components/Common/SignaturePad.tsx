import React, { useRef, useState, useEffect } from 'react';
import { FiDelete, FiCheck } from 'react-icons/fi';

interface SignaturePadProps {
    onSave: (signatureDataUrl: string) => void;
    onClear?: () => void;
    height?: number;
    placeholder?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ 
    onSave, 
    onClear, 
    height = 150,
    placeholder = "Sign here to witness delivery..." 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        ctx.strokeStyle = '#6366f1'; // Indigo (Premium)
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawingRef.current = true;
        setIsDrawing(true);
        setIsEmpty(false);
        draw(e);
    };

    const stopDrawing = () => {
        isDrawingRef.current = false;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            onSave(canvas.toDataURL('image/png'));
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        if (e.type === 'mousedown' || e.type === 'touchstart') {
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setIsEmpty(true);
            if (onClear) onClear();
            onSave(''); // Clear the saved signature
        }
    };

    return (
        <div className="signature-pad-container">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Digital Witness Handshake</span>
                <button 
                    type="button" 
                    onClick={clear}
                    className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors uppercase"
                >
                    <FiDelete size={12} /> Clear
                </button>
            </div>
            
            <div className="relative border-2 border-slate-200 rounded-xl bg-white overflow-hidden group hover:border-indigo-300 transition-all">
                <canvas
                    ref={canvasRef}
                    height={height}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm italic">
                        {placeholder}
                    </div>
                )}
                
                {!isEmpty && !isDrawing && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-bold border border-emerald-100 animate-in fade-in">
                        <FiCheck size={10} /> Captured
                    </div>
                )}
            </div>
            <p className="mt-2 text-[9px] text-slate-400 leading-tight">
                By signing, you confirm that the measured ATG volume matches or has been reconciled against the provided Bill of Lading.
            </p>
        </div>
    );
};

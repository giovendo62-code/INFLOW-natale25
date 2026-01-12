import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import clsx from 'clsx';

interface DragDropUploadProps {
    onUpload: (file: File) => void;
    className?: string;
    label?: string;
    sublabel?: string;
    accept?: string;
}

export const DragDropUpload: React.FC<DragDropUploadProps> = ({
    onUpload,
    className,
    label = "Clicca o trascina qui un file",
    sublabel = "Tutti i formati supportati",
    accept
}) => {
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onUpload(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    return (
        <div
            className={clsx(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                dragActive ? "border-accent bg-accent/10" : "border-border hover:border-accent hover:bg-bg-tertiary",
                className
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleChange}
                accept={accept}
            />
            <Upload className="mx-auto mb-4 text-text-muted" size={32} />
            <p className="text-white font-medium mb-1">{label}</p>
            <p className="text-sm text-text-muted">{sublabel}</p>
        </div>
    );
};

import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import './DocViewer.css';

interface DocViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DocViewer: React.FC<DocViewerProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';

            // Disable right-click within the whole document when viewer is open
            const handleContextMenu = (e: MouseEvent) => {
                e.preventDefault();
            };

            // Disable key combinations like Ctrl+S, Ctrl+P, Ctrl+U
            const handleKeyDown = (e: KeyboardEvent) => {
                if (
                    (e.ctrlKey && (e.key === 's' || e.key === 'p' || e.key === 'u' || e.key === 'a' || e.key === 'c')) ||
                    e.key === 'PrintScreen' ||
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
                ) {
                    e.preventDefault();
                    return false;
                }
            };

            window.addEventListener('contextmenu', handleContextMenu);
            window.addEventListener('keydown', handleKeyDown);

            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('contextmenu', handleContextMenu);
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="doc-viewer-overlay" onClick={onClose}>
            <div className="doc-viewer-container" onClick={(e) => e.stopPropagation()}>
                <div className="doc-viewer-header">
                    <span className="doc-viewer-title">IoTank Project Documentation</span>
                    <button className="doc-viewer-close" onClick={onClose} aria-label="Close viewer">
                        <FiX />
                    </button>
                </div>
                <div className="doc-viewer-content">
                    {/* The protection layer prevents interaction but iframe might need more complex handling */}
                    {/* Note: #toolbar=0&navpanes=0&scrollbar=0 is a common trick for PDF embeds */}
                    <iframe
                        src="/document-viewer-core.pdf#toolbar=0&navpanes=0&scrollbar=0"
                        className="doc-viewer-iframe"
                        title="Protected Document Viewer"
                        onContextMenu={(e) => e.preventDefault()}
                    />
                    <div className="doc-viewer-protection-layer" onContextMenu={(e) => e.preventDefault()}></div>
                    <div className="watermark">IOTANK CONFIDENTIAL</div>
                </div>
            </div>
        </div>
    );
};

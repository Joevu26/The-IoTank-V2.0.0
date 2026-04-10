import React from 'react';
import { FiCamera, FiX } from 'react-icons/fi';
import './PhotoNudgeBanner.css';

interface PhotoNudgeBannerProps {
    onUploadClick: () => void;
    onDismiss: () => void;
}

export const PhotoNudgeBanner: React.FC<PhotoNudgeBannerProps> = ({ onUploadClick, onDismiss }) => {
    return (
        <div className="photo-nudge-banner animate-slide-down">
            <div className="banner-content">
                <div className="banner-icon-wrapper">
                    <FiCamera />
                </div>
                <div className="banner-text">
                    <p className="banner-title">Enhance Operational Accountability</p>
                    <p className="banner-description">Add a profile photo for easier identification in logs and cluster views.</p>
                </div>
                <div className="banner-actions">
                    <button className="btn-upload" onClick={onUploadClick}>Upload Now</button>
                    <button className="btn-later" onClick={onDismiss}>Later</button>
                </div>
            </div>
            <button className="banner-close" onClick={onDismiss} aria-label="Dismiss">
                <FiX />
            </button>
        </div>
    );
};

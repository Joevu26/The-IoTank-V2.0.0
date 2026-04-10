import React from 'react';
import { FiChevronRight } from 'react-icons/fi';
import './DesignSystemCards.css';

// Type 1: Feature & Content Card
interface FeatureCardProps {
    image?: string;
    icon?: React.ReactNode;
    title: string;
    description: string;
    ctaText: string;
    onClick?: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ image, icon, title, description, ctaText, onClick }) => {
    return (
        <div className="ds-card ds-card-feature" onClick={onClick}>
            <div className="ds-card-visual">
                {image ? (
                    <img src={image} alt={title} className="ds-card-image" />
                ) : (
                    <div className="ds-card-icon-placeholder">{icon}</div>
                )}
            </div>
            <div className="ds-card-content">
                <h3 className="ds-card-title">{title}</h3>
                <p className="ds-card-body">{description}</p>
                <div className="ds-card-cta">
                    {ctaText} <FiChevronRight />
                </div>
            </div>
        </div>
    );
};

// Type 2: Service & Highlight Card (Icon + Text)
interface ServiceCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ icon, title, description }) => {
    return (
        <div className="ds-card ds-card-service">
            <div className="ds-service-icon">
                {icon}
            </div>
            <div className="ds-service-content">
                <h3 className="ds-service-title">{title}</h3>
                <p className="ds-service-body">{description}</p>
            </div>
        </div>
    );
};

// Type 3: Process Card (Numbered Steps)
interface ProcessCardProps {
    stepNumber: string | number;
    title: string;
    description: string;
    linkText?: string;
    onClick?: () => void;
}

export const ProcessCard: React.FC<ProcessCardProps> = ({ stepNumber, title, description, linkText, onClick }) => {
    return (
        <div className="ds-card ds-card-process">
            <div className="ds-process-number">{stepNumber}</div>
            <div className="ds-process-content">
                <h3 className="ds-process-title">{title}</h3>
                <p className="ds-process-body">{description}</p>
                {linkText && (
                    <button className="ds-process-link" onClick={onClick}>
                        {linkText}
                    </button>
                )}
            </div>
        </div>
    );
};

// Type 4: Promo Card (Card-in-Card / 3D Graphic Style)
interface PromoCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    ctaText?: string;
    onClick?: () => void;
}

export const PromoCard: React.FC<PromoCardProps> = ({ icon, title, description, ctaText, onClick }) => {
    return (
        <div className="ds-card ds-card-promo">
            <div className="ds-promo-frame">
                <div className="ds-promo-icon-3d">
                    {icon}
                </div>
            </div>
            <div className="ds-promo-content">
                <h3 className="ds-promo-title">{title}</h3>
                <p className="ds-promo-body">{description}</p>
                {ctaText && (
                    <div className="ds-promo-cta" onClick={onClick}>
                        {ctaText} <FiChevronRight />
                    </div>
                )}
            </div>
        </div>
    );
};

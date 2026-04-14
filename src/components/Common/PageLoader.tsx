import React from 'react';
import { SkeletonLoader } from './SkeletonLoader';
import './SkeletonLoader.css';

export const PageLoader: React.FC = () => (
    <div className="skeleton-page-overlay">
        <div className="skeleton-page-content">
            <SkeletonLoader type="dashboard" />
        </div>
    </div>
);

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'text',
  animation = 'pulse'
}) => {
  const baseClasses = 'skeleton';
  const variantClasses = {
    text: 'skeleton-text',
    rectangular: 'skeleton-rectangular',
    circular: 'skeleton-circular'
  };
  
  const animationClasses = {
    pulse: 'skeleton-pulse',
    wave: 'skeleton-wave',
    none: ''
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : '40px'),
    height: height || (variant === 'text' ? '1em' : '40px'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

// Skeleton components for specific use cases
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = '' 
}) => (
  <div className={`skeleton-text-container ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        variant="text"
        width={index === lines - 1 ? '60%' : '100%'}
        className="mb-2"
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card skeleton-card ${className}`}>
    <div className="skeleton-card-header">
      <Skeleton variant="circular" width={40} height={40} className="me-3" />
      <div className="flex-grow-1">
        <Skeleton variant="text" width="60%" height={20} className="mb-2" />
        <Skeleton variant="text" width="40%" height={16} />
      </div>
    </div>
    <div className="skeleton-card-body">
      <SkeletonText lines={3} />
    </div>
  </div>
);

export const SkeletonTankCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card skeleton-tank-card ${className}`}>
    <div className="skeleton-tank-header">
      <Skeleton variant="text" width="40%" height={24} className="mb-2" />
      <Skeleton variant="text" width="30%" height={16} />
    </div>
    <div className="skeleton-tank-visual">
      <Skeleton variant="rectangular" width="100%" height={120} className="mb-3" />
    </div>
    <div className="skeleton-tank-metrics">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Skeleton variant="text" width="80%" height={14} className="mb-1" />
          <Skeleton variant="text" width="60%" height={20} />
        </div>
        <div>
          <Skeleton variant="text" width="80%" height={14} className="mb-1" />
          <Skeleton variant="text" width="60%" height={20} />
        </div>
      </div>
    </div>
    <div className="skeleton-tank-footer">
      <Skeleton variant="rectangular" width="100%" height={32} className="mt-3" />
    </div>
  </div>
);

export const SkeletonDashboard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-dashboard ${className}`}>
    {/* Header */}
    <div className="skeleton-dashboard-header mb-4">
      <Skeleton variant="text" width="30%" height={32} className="mb-2" />
      <Skeleton variant="text" width="50%" height={20} />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="card">
          <div className="p-4">
            <Skeleton variant="text" width="60%" height={16} className="mb-2" />
            <Skeleton variant="text" width="40%" height={28} />
          </div>
        </div>
      ))}
    </div>

    {/* Tank Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonTankCard key={index} />
      ))}
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 4,
  className = ''
}) => (
  <div className={`skeleton-table ${className}`}>
    {/* Table Header */}
    <div className="skeleton-table-header mb-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} variant="text" height={20} />
        ))}
      </div>
    </div>

    {/* Table Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="skeleton-table-row mb-2">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" height={16} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonChart: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card skeleton-chart ${className}`}>
    <div className="skeleton-chart-header mb-4">
      <Skeleton variant="text" width="40%" height={24} />
    </div>
    <div className="skeleton-chart-body">
      <Skeleton variant="rectangular" width="100%" height={300} />
    </div>
  </div>
);

// Page skeleton components
export const SkeletonPage: React.FC<{ type?: 'dashboard' | 'analytics' | 'settings'; className?: string }> = ({
  type = 'dashboard',
  className = ''
}) => {
  switch (type) {
    case 'dashboard':
      return <SkeletonDashboard className={className} />;
    case 'analytics':
      return (
        <div className={`skeleton-analytics ${className}`}>
          <div className="mb-6">
            <Skeleton variant="text" width="30%" height={32} className="mb-4" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonChart />
              <SkeletonChart />
            </div>
          </div>
          <SkeletonTable rows={8} columns={5} />
        </div>
      );
    case 'settings':
      return (
        <div className={`skeleton-settings ${className}`}>
          <div className="mb-6">
            <Skeleton variant="text" width="25%" height={32} className="mb-4" />
            <div className="card">
              <div className="p-6">
                <SkeletonText lines={6} />
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return <SkeletonDashboard className={className} />;
  }
};

export const SkeletonLoader = SkeletonPage;
export default Skeleton;

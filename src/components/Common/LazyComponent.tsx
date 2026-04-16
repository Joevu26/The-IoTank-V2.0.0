import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import React, { Suspense, useLayoutEffect } from 'react';

interface LazyComponentProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    minHeight?: string;
}

export const LazyComponent: React.FC<LazyComponentProps> = ({ 
    children, 
    fallback, 
    minHeight = '300px' 
}) => {
    const { elementRef, hasIntersected } = useIntersectionObserver();

    useLayoutEffect(() => {
        if (elementRef.current) {
            elementRef.current.style.minHeight = hasIntersected ? 'auto' : minHeight;
        }
    }, [hasIntersected, minHeight]);

    return (
        <div ref={elementRef as any}>
            {hasIntersected ? (
                <Suspense fallback={fallback || <div className="animate-pulse bg-slate-50 rounded-xl w-full h-full" />}>
                    {children}
                </Suspense>
            ) : (
                fallback || <div className="animate-pulse bg-slate-50 rounded-xl w-full h-full" />
            )}
        </div>
    );
};

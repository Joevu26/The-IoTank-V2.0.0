import { useState, useEffect, useRef } from 'react';

export function useIntersectionObserver(options = {}) {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const [hasIntersected, setHasIntersected] = useState(false);
    const elementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            const isElementIntersecting = entry.isIntersecting;
            setIsIntersecting(isElementIntersecting);
            
            // Once it intersects, we keep it true forever so lazy components stay rendered
            if (isElementIntersecting && !hasIntersected) {
                setHasIntersected(true);
            }
        }, {
            root: null,
            rootMargin: '100px', // Fetch slightly before it enters the viewport
            threshold: 0,
            ...options
        });

        observer.observe(element);

        return () => {
            if (element) {
                observer.unobserve(element);
            }
            observer.disconnect();
        };
    }, [hasIntersected, options]);

    return { elementRef, isIntersecting, hasIntersected };
}

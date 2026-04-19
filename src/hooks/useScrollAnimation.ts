/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * useScrollAnimation — Fires once when element enters viewport.
 * @param threshold  IntersectionObserver threshold (0–1)
 * @param rootMargin Optional root margin (e.g. "-80px 0px")
 */
export const useScrollAnimation = (threshold = 0.12, rootMargin = '0px') => {
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            },
            { threshold, rootMargin }
        );

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => {
            if (elementRef.current) {
                observer.unobserve(elementRef.current);
            }
        };
    }, [threshold, rootMargin]);

    return { elementRef, isVisible };
};

/**
 * useScrollProgress — Returns 0→1 scroll progress for an element
 * Useful for parallax and scrub-on-scroll effects.
 */
export const useScrollProgress = () => {
    const [progress, setProgress] = useState(0);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (!elementRef.current) return;
            const rect = elementRef.current.getBoundingClientRect();
            const windowH = window.innerHeight;
            // progress: 0 when element top hits viewport bottom, 1 when element bottom hits viewport top
            const raw = 1 - (rect.bottom / (windowH + rect.height));
            setProgress(Math.min(1, Math.max(0, raw)));
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return { elementRef, progress };
};

/**
 * useParallax — Returns a translateY value based on scroll position
 * @param speed  Parallax multiplier (0 = fixed, 1 = scroll with page)
 */
export const useParallax = (speed = 0.3) => {
    const [offsetY, setOffsetY] = useState(0);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let rafId: number | null = null;

        const handleScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                if (!elementRef.current) { rafId = null; return; }
                const rect = elementRef.current.getBoundingClientRect();
                const center = rect.top + rect.height / 2 - window.innerHeight / 2;
                setOffsetY(center * speed);
                rafId = null;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [speed]);

    return { elementRef, offsetY };
};

/**
 * useCounterAnimation — Animates a number from 0 to target when visible.
 * @param target   The end number
 * @param duration Duration in ms
 */
export const useCounterAnimation = (target: number, duration = 1800) => {
    const [count, setCount] = useState(0);
    const [started, setStarted] = useState(false);
    const elementRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !started) {
                    setStarted(true);
                    observer.unobserve(entry.target);
                }
            },
            { threshold: 0.3 }
        );
        if (elementRef.current) observer.observe(elementRef.current);
        return () => observer.disconnect();
    }, [started]);

    useEffect(() => {
        if (!started) return;
        let startTime: number | null = null;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [started, target, duration]);

    return { elementRef, count };
};

/**
 * useGlobalScrollProgress — Returns 0→1 for entire page scroll
 */
export const useGlobalScrollProgress = () => {
    const [progress, setProgress] = useState(0);

    const update = useCallback(() => {
        const scrollTop = window.scrollY;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    }, []);

    useEffect(() => {
        let rafId: number | null = null;
        const onScroll = () => {
            if (!rafId) rafId = requestAnimationFrame(() => { update(); rafId = null; });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        update();
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [update]);

    return progress;
};

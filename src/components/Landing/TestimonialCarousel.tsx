/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiStar, FiChevronLeft, FiChevronRight, FiShield, FiMapPin } from 'react-icons/fi';
import './TestimonialCarousel.css';

interface Testimonial {
    id: number;
    quote: string;
    shortQuote: string;
    author: string;
    role: string;
    location: string;
    savingsAmount: string;
    savingsLabel: string;
    stars: number;
    verified: boolean;
    avatarInitials: string;
    avatarColor: string;
    avatarUrl?: string;
    monthsActive: number;
}

const TESTIMONIALS: Testimonial[] = [
    {
        id: 1,
        quote: "First week: IoTank caught a 400-litre micro-leak I had no idea about. Over six months it saved me Ksh 1.8 million in avoidable losses. I genuinely cannot believe I ran a station without it.",
        shortQuote: "First week: caught a 400L leak. Six months: Ksh 1.8M saved.",
        author: "John K.",
        role: "Station Owner",
        location: "Kiambu, Kenya",
        savingsAmount: "Ksh 1.8M",
        savingsLabel: "Saved in 6 months",
        stars: 5,
        verified: true,
        avatarInitials: "JK",
        avatarColor: "#7C3AED",
        avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
        monthsActive: 18,
    },
    {
        id: 2,
        quote: "The AI told me to buy fuel on a Monday — before the EPRA hike hit on Thursday. My competitor paid Ksh 12.50 more per litre. On 15,000 litres, that's Ksh 187,500 straight into my pocket. The system pays for itself in days.",
        shortQuote: "AI told me to buy before the EPRA hike. Saved Ksh 187,500 in one decision.",
        author: "Grace W.",
        role: "Station Manager",
        location: "Nakuru, Kenya",
        savingsAmount: "Ksh 187K",
        savingsLabel: "In one procurement call",
        stars: 5,
        verified: true,
        avatarInitials: "GW",
        avatarColor: "#059669",
        avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg",
        monthsActive: 11,
    },
    {
        id: 3,
        quote: "I caught my best attendant — a man I trusted for four years — stealing 50 litres a week. IoTank flagged the discrepancy on day one. I sleep better now knowing everything is watched, automatically.",
        shortQuote: "Flagged attendant theft on day one. Four years of loss — stopped immediately.",
        author: "Samuel T.",
        role: "Station Owner",
        location: "Eldoret, Kenya",
        savingsAmount: "Ksh 228K",
        savingsLabel: "Annual theft stopped",
        stars: 5,
        verified: true,
        avatarInitials: "ST",
        avatarColor: "#DC2626",
        avatarUrl: "https://randomuser.me/api/portraits/men/46.jpg",
        monthsActive: 8,
    },
    {
        id: 4,
        quote: "EPRA walked in and asked for 90 days of records. I handed them a link to my IoTank reports — temperature-corrected, timestamped, exportable. The inspector said it was the cleanest audit he'd seen this year. No fine.",
        shortQuote: "Cleanest EPRA audit of the year. No fine. All reports auto-generated.",
        author: "Mary N.",
        role: "Station Operator",
        location: "Kisumu, Kenya",
        savingsAmount: "Ksh 800K",
        savingsLabel: "Fine avoided",
        stars: 5,
        verified: true,
        avatarInitials: "MN",
        avatarColor: "#D97706",
        avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg",
        monthsActive: 14,
    },
    {
        id: 5,
        quote: "We were attributing Ksh 120,000/month in losses to 'normal variance.' IoTank's temperature correction showed us we were being shorted on every delivery. We renegotiated our supplier contract and recovered it all.",
        shortQuote: "Temperature variance was costing Ksh 120K/month. Detected and recovered.",
        author: "David M.",
        role: "Station Owner",
        location: "Thika, Kenya",
        savingsAmount: "Ksh 120K",
        savingsLabel: "Monthly losses recovered",
        stars: 5,
        verified: true,
        avatarInitials: "DM",
        avatarColor: "#2563EB",
        avatarUrl: "https://randomuser.me/api/portraits/men/60.jpg",
        monthsActive: 22,
    },
];

const StarRating: React.FC<{ count: number }> = ({ count }) => (
    <div className="tc2-stars" aria-label={`${count} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
            <FiStar key={i} className={i < count ? 'tc2-star filled' : 'tc2-star'} />
        ))}
    </div>
);

const TestimonialCarousel: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [direction, setDirection] = useState<'next' | 'prev'>('next');
    const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const goTo = useCallback((index: number, dir: 'next' | 'prev') => {
        if (isAnimating) return;
        setDirection(dir);
        setIsAnimating(true);
        setTimeout(() => {
            setActiveIndex((index + TESTIMONIALS.length) % TESTIMONIALS.length);
            setIsAnimating(false);
        }, 400);
    }, [isAnimating]);

    const next = useCallback(() => goTo(activeIndex + 1, 'next'), [activeIndex, goTo]);
    const prev = useCallback(() => goTo(activeIndex - 1, 'prev'), [activeIndex, goTo]);

    useEffect(() => {
        autoPlayRef.current = setTimeout(next, 6000);
        return () => { if (autoPlayRef.current) clearTimeout(autoPlayRef.current); };
    }, [activeIndex, next]);

    const t = TESTIMONIALS[activeIndex];
    const animClass = isAnimating ? `tc2-slide-out-${direction}` : 'tc2-slide-in';

    return (
        <section className="tc2-section" id="testimonials" aria-label="Customer Testimonials">
            <div className="tc2-container">
                {/* Header */}
                <div className="tc2-header">
                    <div className="tc2-pill">CUSTOMER RESULTS</div>
                    <h2 className="tc2-title">
                        Real Stations. <span className="tc2-title-accent">Real Savings.</span>
                    </h2>
                    <p className="tc2-subtitle">
                        Verified results from IoTank owners across Kenya.
                    </p>
                </div>

                {/* Main Card */}
                <div className="tc2-stage">
                    {/* Navigation Arrows */}
                    <button
                        className="tc2-arrow tc2-arrow-left"
                        onClick={prev}
                        aria-label="Previous testimonial"
                        disabled={isAnimating}
                    >
                        <FiChevronLeft />
                    </button>

                    <div className={`tc2-card ${animClass}`} key={t.id}>
                        {/* Left: Person Info */}
                        <div className="tc2-person-panel">
                            <div className="tc2-avatar-wrapper">
                                <div
                                    className="tc2-avatar"
                                    style={{ background: t.avatarUrl ? 'transparent' : `linear-gradient(135deg, ${t.avatarColor}, ${t.avatarColor}99)` }}
                                    aria-hidden="true"
                                >
                                    {t.avatarUrl ? (
                                        <img src={t.avatarUrl} alt={t.author} className="tc2-avatar-image" />
                                    ) : (
                                        <span className="tc2-avatar-initials">{t.avatarInitials}</span>
                                    )}
                                </div>
                                {t.verified && (
                                    <div className="tc2-verified-badge" title="Verified Installation">
                                        <FiShield size={10} />
                                    </div>
                                )}
                            </div>
                            <div className="tc2-person-info">
                                <p className="tc2-author-name">{t.author}</p>
                                <p className="tc2-author-role">{t.role}</p>
                                <div className="tc2-location">
                                    <FiMapPin size={11} />
                                    <span>{t.location}</span>
                                </div>
                            </div>
                            <div className="tc2-rating-row">
                                <StarRating count={t.stars} />
                            </div>
                            
                            <div className="tc2-compact-tags">
                                {t.verified && (
                                    <div className="tc2-verified-tag">
                                        <FiShield size={12} />
                                        <span>VERIFIED INSTALLATION</span>
                                    </div>
                                )}
                                <div className="tc2-months-badge">
                                    ACTIVE {t.monthsActive} MONTHS
                                </div>
                            </div>
                        </div>

                        {/* Right: Quote & Result */}
                        <div className="tc2-content-panel">
                            <div className="tc2-quote-mark" aria-hidden="true">"</div>
                            <blockquote className="tc2-quote">{t.quote}</blockquote>

                            {/* Savings Highlight */}
                            <div className="tc2-savings-card">
                                <div className="tc2-savings-value" style={{ color: t.avatarColor }}>
                                    {t.savingsAmount}
                                </div>
                                <div className="tc2-savings-label">{t.savingsLabel}</div>
                            </div>
                        </div>
                    </div>

                    <button
                        className="tc2-arrow tc2-arrow-right"
                        onClick={next}
                        aria-label="Next testimonial"
                        disabled={isAnimating}
                    >
                        <FiChevronRight />
                    </button>
                </div>

                {/* Dot Navigation + Progress */}
                <div className="tc2-nav-row">
                    <div className="tc2-dots" role="tablist" aria-label="Testimonial navigation">
                        {TESTIMONIALS.map((item, i) => (
                            <button
                                key={item.id}
                                role="tab"
                                aria-selected={i === activeIndex}
                                className={`tc2-dot ${i === activeIndex ? 'tc2-dot-active' : ''}`}
                                onClick={() => goTo(i, i > activeIndex ? 'next' : 'prev')}
                                aria-label={`Go to testimonial ${i + 1}: ${item.author}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};


export default TestimonialCarousel;

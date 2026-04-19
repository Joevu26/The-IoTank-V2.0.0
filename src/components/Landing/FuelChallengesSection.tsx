/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect, useRef } from 'react';
import {
    FiClock, FiDroplet, FiDatabase,
    FiUserX, FiThermometer, FiFileText,
    FiCheckCircle, FiXCircle, FiMessageSquare,
    FiX, FiBarChart2
} from 'react-icons/fi';
import './FuelChallengesSection.css';

// ─── Testimonials ────────────────────────────────────────────────────────────
const TESTIMONIALS = [
    {
        quote: `"I thought we had 4 days of fuel left. The dipstick said 8,000 liters yesterday. This morning, we ran dry at 10 AM — peak hours. We turned away 50 customers. Our competitor down the road made Ksh 180,000 while we sat there with pumps off, scrambling to get an emergency delivery that cost us Ksh 15,000 extra in rush fees."`,
        author: "James M., Independent Station Owner, Nairobi"
    },
    {
        quote: `"I saw the EPRA announcement at 9 PM on Tuesday. My tank was at 18%. I couldn't reach my supplier until Wednesday morning. By the time the truck arrived Thursday, the price had already changed. I paid Ksh 191/L instead of Ksh 178.50. Do you know what it feels like to watch Ksh 187,500 disappear because you were 48 hours too slow?"`,
        author: "Grace W., Station Manager, Nakuru"
    },
    {
        quote: `"We kept blaming evaporation. 'It's normal,' my manager said. Then NEMA showed up because a neighbor's well tested positive for petroleum contamination. The leak had been going for 8 months. The fine: Ksh 4.2 million. The cleanup: Ksh 1.8 million. We almost lost the license. All because we trusted a dipstick and assumed 'shrinkage' was just part of the business."`,
        author: "Peter K., Station Owner, Mombasa"
    },
    {
        quote: `"I trusted him for 4 years. He was my best attendant. Then one day, a customer mentioned he'd been buying 'cheap fuel' from someone at my station after hours. I installed a camera. Caught him red-handed — 200 liters in jerry cans in his pickup truck. When I confronted him, he said, 'Everyone does it. You never notice anyway.' He was right. I had no idea. How much did he take over 4 years? I'll never know."`,
        author: "Samuel T., Station Owner, Eldoret"
    },
    {
        quote: `"They walked in at 11 AM on a Thursday. 'We need to see your last 90 days of inventory records.' I pulled out the logbook. Half the entries were in pencil. Some pages were coffee-stained. Two weeks in August were blank. The inspector didn't say much. Just took photos. The fine notice came 3 weeks later: Ksh 800,000 for 'inadequate recordkeeping.' What hurt more was his parting comment: 'The station across the street has automated systems. We never fine them.'"`,
        author: "Mary N., Station Operator, Kisumu"
    },
    {
        quote: `"I always wondered why my reconciliation was off by 2–3%. My accountant said it was 'normal variance.' Then I started checking delivery temperatures. Last month, a 15,000L delivery arrived at 32°C. At 15°C standard, that's 14,820 liters. I paid for 15,000L. They shorted me 180 liters — Ksh 34,200. The supplier said, 'It's not our problem if you don't have temperature correction.' They were right. It's my problem. And it's costing me Ksh 120,000/month."`,
        author: "David M., Station Owner, Thika"
    },
    {
        quote: `"I asked him how business was. He said, 'I installed IoTank 18 months ago. First month, it caught a 400-liter leak I didn't know existed. Second month, it told me to buy before an EPRA price hike — saved me Ksh 200,000. Third month, it flagged an attendant stealing 50 liters a week. After a year, IoTank saved me Ksh 2.8 million. I'm not smarter than you. I just stopped flying blind.' That's when I realized: I wasn't competing with him. I was competing with his system."`,
        author: "John K., Station Owner, Kiambu"
    }
];

// ─── Loss Calculator Modal ────────────────────────────────────────────────────
const LOSS_BREAKDOWN = [
    {
        category: "The Inventory Black Hole",
        loss: "Ksh 130,000 / mo",
        math: "±10mm error on 20,000L tank = ±700L uncertainty. 700L * Ksh 185/L avg revenue loss.",
        risk: "CRITICAL",
        impact: "Severe operational blindness. High risk of peak-hour stockouts."
    },
    {
        category: "The Procurement Trap",
        loss: "Ksh 187,500 / event",
        math: "15,000L delivery * Ksh 12.50/L price jump (EPRA). Missed window = direct margin loss.",
        risk: "HIGH",
        impact: "Direct profit erosion. Competitors gain Ksh 12.50/L margin advantage."
    },
    {
        category: "The Silent Thief (Leaks)",
        loss: "Ksh 96,000 / mo",
        math: "0.7 L/hr seepage * 24 hrs * 30 days = 504L. 504L * Ksh 191/L pump price.",
        risk: "CATASTROPHIC",
        impact: "NEMA fines (up to Ksh 5M), license loss, and environmental cleanup costs."
    },
    {
        category: "The Inside Job (Theft)",
        loss: "Ksh 228,000 / mo",
        math: "30L phantom dispense/day + 50L night siphoning/week. Undetected cumulative theft.",
        risk: "SEVERE",
        impact: "Permanent margin leaks. Staff collusion thrives on lack of visibility."
    },
    {
        category: "The Temperature Trap",
        loss: "Ksh 122,000 / mo",
        math: "10,000L at 28°C vs 20°C standard = 80L delta. 4 deliveries/mo * 80L * Ksh 191.",
        risk: "HIGH",
        impact: "Paying for fuel that doesn't exist in standard volume."
    },
    {
        category: "EPRA Audit Nightmare",
        loss: "Ksh 800,000 (Avg Fine)",
        math: "Regulatory fines for inadequate recordkeeping + mandatory 3rd party audit fees.",
        risk: "LEGAL RISK",
        impact: "Business closure risk. Manual logs are no longer compliant in 2026."
    },
];

export const LossCalculatorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="lc-overlay" onClick={onClose}>
        <div className="lc-modal" onClick={e => e.stopPropagation()}>
            <button className="lc-close" onClick={onClose}><FiX /></button>
            <div className="lc-header">
                <FiBarChart2 size={32} color="var(--cyber-emerald)" />
                <h2>Financial Leakage Audit</h2>
                <p>Detailed math breakdown of invisible losses for a Kenyan station (Avg 150k - 300k Liters/mo).</p>
            </div>
            <div className="lc-table-wrap">
                <table className="lc-report-table">
                    <thead>
                        <tr>
                            <th>Loss Category</th>
                            <th>Math Breakdown (The Logic)</th>
                            <th>Risk Level</th>
                            <th>Monthly Exposure</th>
                        </tr>
                    </thead>
                    <tbody>
                        {LOSS_BREAKDOWN.map((row, i) => (
                            <tr key={i} className={`lc-row-${row.risk.toLowerCase().replace(' ', '-')}`}>
                                <td className="lc-category-cell">
                                    <strong>{row.category}</strong>
                                    <span className="lc-impact-hint">{row.impact}</span>
                                </td>
                                <td className="lc-math-cell">{row.math}</td>
                                <td className="lc-risk-cell">
                                    <span className={`risk-badge ${row.risk.toLowerCase().replace(' ', '-')}`}>
                                        {row.risk}
                                    </span>
                                </td>
                                <td className="lc-exposure-cell">{row.loss}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="lc-total-summary">
                            <td colSpan={3}>TOTAL MONTHLY REVENUE LEAKAGE</td>
                            <td className="lc-total-val">Ksh 465,000+</td>
                        </tr>
                        <tr className="lc-annual-summary">
                            <td colSpan={3}>ESTIMATED ANNUAL IMPACT</td>
                            <td className="lc-total-val-annual">Ksh 5.58 Million</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="lc-conversion-card">
                <div className="lc-conversion-content">
                    <h3>Stop the bleeding in 24 hours.</h3>
                    <p>
                        IoTank hardware costs <strong>Ksh 35,000</strong>.
                        Based on these calculations, the system pays for itself in just <strong>2.3 days</strong>.
                    </p>
                </div>
                <button className="lc-action-btn" onClick={() => window.location.href = 'mailto:iotank.com@gmail.com'}>
                    SECURE MY STATION
                </button>
            </div>

            <p className="lc-disclaimer">
                * Based on industry standard ASTM D1250 and EPRA enforcement data. Calculations for demonstration only.
            </p>
        </div>
    </div>
);

// ─── Testimonial Carousel ─────────────────────────────────────────────────────
export const TestimonialCarousel: React.FC = () => {
    const [active, setActive] = useState(0);
    const [fading, setFading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const advance = (next: number) => {
        setFading(true);
        setTimeout(() => {
            setActive(next);
            setFading(false);
        }, 400);
    };

    useEffect(() => {
        timerRef.current = setTimeout(() => {
            advance((active + 1) % TESTIMONIALS.length);
        }, 5000);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [active]);

    const t = TESTIMONIALS[active];

    return (
        <div className="tc-wrap">
            <div className={`tc-card ${fading ? 'tc-fade-out' : 'tc-fade-in'}`}>
                <p className="tc-quote">{t.quote}</p>
                <span className="tc-author">— {t.author}</span>
            </div>
            <div className="tc-dots">
                {TESTIMONIALS.map((_, i) => (
                    <button
                        key={i}
                        className={`tc-dot ${i === active ? 'tc-dot-active' : ''}`}
                        onClick={() => advance(i)}
                    />
                ))}
            </div>
        </div>
    );
};

interface ProfitKillerCardProps {
    id: string;
    icon: React.ReactNode;
    title: string;
    hook: string;
    details: string[];
    className: string;
    expandColor?: string;
}

export const ProfitKillerCard: React.FC<ProfitKillerCardProps> = ({
    icon, title, hook, details, className, expandColor = '#3b82f6'
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={`profit-card ${className}`}>
            <div className="card-icon-wrapper">{icon}</div>
            <h3 className="card-title">{title}</h3>
            <p className="card-hook">{hook}</p>

            <button
                className="expand-details-btn"
                style={{ color: expandColor }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded ? <>Hide Details ↑</> : <>Expand Details ↓</>}
            </button>

            {isExpanded && (
                <div className="details-content">
                    <ul className="details-list">
                        {details.map((detail, index) => (
                            <li key={index}>{detail}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export const SocialProofBar: React.FC = () => (
    <div className="stats-bar-modern">
        <div className="challenges-container">
            <div className="stats-grid-modern">
                <div className="stat-item-modern">
                    <span className="stat-value-modern">127+</span>
                    <span className="stat-label-modern">Stations Protected</span>
                </div>
                <div className="stat-item-modern">
                    <span className="stat-value-modern">Ksh 847M</span>
                    <span className="stat-label-modern">Total Savings</span>
                </div>
                <div className="stat-item-modern">
                    <span className="stat-value-modern">Zero</span>
                    <span className="stat-label-modern">EPRA Fines</span>
                </div>
                <div className="stat-item-modern">
                    <span className="stat-value-modern">0.7L/hr</span>
                    <span className="stat-label-modern">Leak Detection</span>
                </div>
                <div className="stat-item-modern">
                    <span className="stat-value-modern">4.8/5</span>
                    <span className="stat-label-modern">Owner Rating</span>
                </div>
            </div>
        </div>
    </div>
);

// --- NEW MODULAR EXPORTS ---

export const CrisisIntro: React.FC<{ onShowCalculator: () => void }> = ({ onShowCalculator }) => (
    <div className="crisis-intro">
        <h2 className="headline-large">
            The Hidden Ksh 5.1M Annual Risk
        </h2>
        <p className="subheadline-medium">
            Most fuel stations lose money quietly — through shrinkage, leaks, pricing delays, temperature variance, and internal theft.
            <br /><br />
            You don’t see it. But your margin does.
        </p>

        <div className="problem-stats-grid">
            <div className="problem-stat-card">
                <span className="problem-stat-number">90%</span>
                <span className="problem-stat-label">stations operate blind</span>
            </div>
            <div className="problem-stat-card">
                <span className="problem-stat-number">428k</span>
                <span className="problem-stat-label">Ksh loss / month</span>
            </div>
            <div className="problem-stat-card">
                <span className="problem-stat-number">5.1M</span>
                <span className="problem-stat-label">Ksh annual loss</span>
            </div>
            <div className="problem-stat-card">
                <span className="problem-stat-number">±700L</span>
                <span className="problem-stat-label">daily uncertainty</span>
            </div>
        </div>

        <div className="problem-testimonial">
            <blockquote className="problem-testimonial-quote">
                &ldquo;First week: caught a 400L leak. After 6 months: saved Ksh 1.8M.&rdquo;
            </blockquote>
            <footer className="problem-testimonial-author">— Station Owner, Nairobi</footer>
        </div>

        <div className="loss-cta-btn-wrap" style={{ marginTop: '1rem' }}>
            <button className="btn-loss-calc" onClick={onShowCalculator}>
                <FiBarChart2 />
                Use free loss calculator
            </button>
        </div>
    </div>
);

export const ProfitKillers: React.FC = () => (
    <div className="profit-killers-section">
        <div className="profit-killers-pill">RISK ASSESSMENT</div>
        <h2 className="section-title">The Six Silent <span className="accent-orange">Profit Risks</span></h2>
        <div className="profit-killers-grid">
            <ProfitKillerCard
                id="inventory"
                icon={<FiDatabase />}
                title="Inventory Uncertainty"
                hook="Your dipstick says 8,000 liters. Reality? Could be 7,300L or 8,700L. ±10mm error = ±700 liters of uncertainty."
                details={[
                    "Manual dipsticks can't account for tank tilt (±15mm error)",
                    "Temperature changes expand/contract fuel (1% per 10°C)",
                    "Human reading errors (parallax, rushed measurements)",
                    "No compensation for vapor pressure or density shifts"
                ]}
                className="card-inventory"
            />
            <ProfitKillerCard
                id="procurement"
                icon={<FiClock />}
                title="Procurement Timing Errors"
                hook="EPRA announces +Ksh 12.50/L increase. Effective in 3 days. You notice... 2 days too late."
                details={[
                    "Operating without 24/7 EPRA market monitoring",
                    "Lack of predictive inventory projections (stockout risk)",
                    "Buying at peaks due to lack of market intelligence",
                    "Competitors with AI buy Monday; you buy Thursday"
                ]}
                className="card-procurement"
            />
            <ProfitKillerCard
                id="leak"
                icon={<FiDroplet />}
                title="Micro-Leaks"
                hook="0.7 liters per hour. That's EPA's 'small leak' threshold. Over a year, that's 6,048 liters into the ground."
                details={[
                    "0.7 L/hr is invisible to manual dipstick measurements",
                    "Leak detection buried in 'acceptable variance'",
                    "Risk of NEMA fines up to Ksh 5M + Cleanup costs",
                    "Criminal liability under Environmental Management Act"
                ]}
                className="card-leak"
            />
            <ProfitKillerCard
                id="theft"
                icon={<FiUserX />}
                title="Internal Theft"
                hook="Attendant dispenses 50L, records 30L, pockets Ksh 3,800. Your books match, but your bank account doesn't."
                details={[
                    "Phantom dispenses (recording less than actual sales)",
                    "Night siphoning during unsupervised shift hours",
                    "Delivery collusion: driver and attendant split short-fills",
                    "No real-time fuel vs. sales reconciliation"
                ]}
                className="card-theft"
            />
            <ProfitKillerCard
                id="temp"
                icon={<FiThermometer />}
                title="Temperature Volume Variance"
                hook="Delivery arrives at 28°C. Underground tank is 20°C. You paid for 10,000L, you got 9,920L standard volume."
                details={[
                    "Fuel expands ~1% per 10°C increase during transport",
                    "Major oil companies sell at 15°C standard base",
                    "Ambient delivery hides volume deficits within physics",
                    "No ASTM D1250 volume correction on manual logs"
                ]}
                className="card-temp"
            />
            <ProfitKillerCard
                id="epra"
                icon={<FiFileText />}
                title="Compliance Failures"
                hook="Inspector walks in: 'Show me 90 days of logs.' Your book is stained, half-blank, and written in pencil."
                details={[
                    "Incomplete or inconsistent daily inventory logs",
                    "Failure to produce monthly leak detection evidence",
                    "Lack of traceable delivery vs. level cross-checks",
                    "Volume discrepancies >5% trigger mandatory audits"
                ]}
                className="card-epra"
            />
        </div>
        <p className="small-text text-center mt-8">IoTank continuously monitors all six — automatically.</p>
    </div>
);


export const FuelProblemsSection: React.FC<{ onShowCalculator: () => void }> = ({ onShowCalculator }) => {

    return (
        <section id="problem" className="fuel-challenges-section">
            <div className="challenges-container">

                {/* SECTION 1: THE CRISIS INTRODUCTION */}
                <div className="crisis-intro">
                    <h2 className="headline-large">
                        The Ksh 5.1 million problem<br />Every station owner ignores
                    </h2>
                    <p className="subheadline-medium">
                        You're losing money every single day. You just can't see it happening.
                    </p>

                    {/* Stats Row */}
                    <div className="problem-stats-grid">
                        <div className="problem-stat-card">
                            <span className="problem-stat-number">90%</span>
                            <span className="problem-stat-label">stations operate blind</span>
                        </div>
                        <div className="problem-stat-card">
                            <span className="problem-stat-number">428k</span>
                            <span className="problem-stat-label">Ksh loss / month</span>
                        </div>
                        <div className="problem-stat-card">
                            <span className="problem-stat-number">5.1M</span>
                            <span className="problem-stat-label">Ksh annual loss</span>
                        </div>
                        <div className="problem-stat-card">
                            <span className="problem-stat-number">±700L</span>
                            <span className="problem-stat-label">daily uncertainty</span>
                        </div>
                    </div>

                    {/* Testimonial Quote */}
                    <div className="problem-testimonial">
                        <blockquote className="problem-testimonial-quote">
                            &ldquo;I thought we were doing fine. Revenue was steady. Then I installed IoTank.
                            First week: caught a 400L leak. After 6 months: saved Ksh 1.8 million.&rdquo;
                        </blockquote>
                        <footer className="problem-testimonial-author">— John K., Station Owner</footer>
                    </div>
                </div>

                {/* SECTION 2: THE SIX PROFIT KILLERS */}
                <div className="profit-killers-section">
                    <h2 className="section-title">The six silent profit killers</h2>
                    <div className="profit-killers-grid">
                        <ProfitKillerCard
                            id="inventory"
                            icon={<FiDatabase />}
                            title="The Inventory Black Hole"
                            hook="Your dipstick says 8,000 liters. Reality? Could be 7,300L or 8,700L. ±10mm error = ±700 liters of uncertainty."
                            details={[
                                "Manual dipsticks can't account for tank tilt (±15mm error)",
                                "Temperature changes expand/contract fuel (1% per 10°C)",
                                "Human reading errors (parallax, rushed measurements)",
                                "No compensation for vapor pressure or density shifts"
                            ]}
                            className="card-inventory"
                        />
                        <ProfitKillerCard
                            id="procurement"
                            icon={<FiClock />}
                            title="The Procurement Trap"
                            hook="EPRA announces +Ksh 12.50/L increase. Effective in 3 days. You notice... 2 days too late."
                            details={[
                                "Operating without 24/7 EPRA market monitoring",
                                "Lack of predictive inventory projections (stockout risk)",
                                "Buying at peaks due to lack of market intelligence",
                                "Competitors with AI buy Monday; you buy Thursday"
                            ]}
                            className="card-procurement"
                        />
                        <ProfitKillerCard
                            id="leak"
                            icon={<FiDroplet />}
                            title="The Silent Thief"
                            hook="0.7 liters per hour. That's EPA's 'small leak' threshold. Over a year, that's 6,048 liters into the ground."
                            details={[
                                "0.7 L/hr is invisible to manual dipstick measurements",
                                "Leak detection buried in 'acceptable variance'",
                                "Risk of NEMA fines up to Ksh 5M + Cleanup costs",
                                "Criminal liability under Environmental Management Act"
                            ]}
                            className="card-leak"
                        />
                        <ProfitKillerCard
                            id="theft"
                            icon={<FiUserX />}
                            title="The Inside Job"
                            hook="Attendant dispenses 50L, records 30L, pockets Ksh 3,800. Your books match, but your bank account doesn't."
                            details={[
                                "Phantom dispenses (recording less than actual sales)",
                                "Night siphoning during unsupervised shift hours",
                                "Delivery collusion: driver and attendant split short-fills",
                                "No real-time fuel vs. sales reconciliation"
                            ]}
                            className="card-theft"
                        />
                        <ProfitKillerCard
                            id="temp"
                            icon={<FiThermometer />}
                            title="The Temperature Trap"
                            hook="Delivery arrives at 28°C. Underground tank is 20°C. You paid for 10,000L, you got 9,920L standard volume."
                            details={[
                                "Fuel expands ~1% per 10°C increase during transport",
                                "Major oil companies sell at 15°C standard base",
                                "Ambient delivery hides volume deficits within physics",
                                "No ASTM D1250 volume correction on manual logs"
                            ]}
                            className="card-temp"
                        />
                        <ProfitKillerCard
                            id="epra"
                            icon={<FiFileText />}
                            title="The EPRA Nightmare"
                            hook="Inspector walks in: 'Show me 90 days of logs.' Your book is stained, half-blank, and written in pencil."
                            details={[
                                "Incomplete or inconsistent daily inventory logs",
                                "Failure to produce monthly leak detection evidence",
                                "Lack of traceable delivery vs. level cross-checks",
                                "Volume discrepancies >5% trigger mandatory audits"
                            ]}
                            className="card-epra"
                        />
                    </div>
                </div>

                {/* SECTION 3: TESTIMONIALS + CALCULATOR */}
                <div className="loss-cta-section">
                    <div className="loss-cta-emotional">
                        <p className="loss-cta-lead">
                            These aren't just numbers. They are <em>real conversations</em> happening in break rooms,
                            on phone calls with suppliers, and in silence at 2 AM when a station owner stares
                            at the books and wonders where the money went.
                        </p>
                        <p className="loss-cta-sub">
                            The conversations never stop. The losses never pause. Every hour you don't have
                            visibility, the meter is running — quietly, invisibly, relentlessly.
                        </p>
                    </div>

                    <TestimonialCarousel />

                    <div className="loss-cta-btn-wrap">
                        <button className="btn-loss-calc" onClick={onShowCalculator}>
                            <FiBarChart2 />
                            Use free loss calculator
                        </button>
                    </div>
                </div>

            </div>
        </section>
    );
};





export const FuelChallengesSection: React.FC = () => {
    return (
        <section id="fuel-intelligence" className="fuel-challenges-section">
            <div className="challenges-container">

                {/* SECTION 4: THE INTELLIGENCE GAP */}
                <div className="intelligence-gap-section">
                    <h2 className="section-title">The Intelligence Gap</h2>
                    <div className="gap-split">
                        <div className="gap-side side-old">
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#dc2626' }}>The Old Way</h3>
                            <ul className="gap-list" style={{ margin: '16px 0' }}>
                                <li style={{ fontSize: '0.85rem' }}><FiXCircle className="gap-icon" /> Trust the dipstick (±700L uncertainty)</li>
                                <li style={{ fontSize: '0.85rem' }}><FiXCircle className="gap-icon" /> React to EPRA after price changes</li>
                                <li style={{ fontSize: '0.85rem' }}><FiXCircle className="gap-icon" /> Hope staff are honest</li>
                                <li style={{ fontSize: '0.85rem' }}><FiXCircle className="gap-icon" /> Pray EPRA doesn't show up</li>
                                <li style={{ fontSize: '0.85rem' }}><FiXCircle className="gap-icon" /> Accept "shrinkage" as normal</li>
                                <li style={{ fontSize: '0.85rem' }}><FiXCircle className="gap-icon" /> Guess when to buy fuel</li>
                            </ul>
                            <div style={{ marginTop: 'auto', color: '#dc2626', fontWeight: 700, fontSize: '0.9rem' }}>
                                Cost: Ksh 5.1 Million / Year
                            </div>
                        </div>
                        <div className="gap-side side-new">
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--cyber-emerald)' }}>The IoTank Way</h3>
                            <ul className="gap-list" style={{ margin: '16px 0' }}>
                                <li style={{ fontSize: '0.85rem' }}><FiCheckCircle className="gap-icon" /> ±1mm Inventory Accuracy 24/7</li>
                                <li style={{ fontSize: '0.85rem' }}><FiCheckCircle className="gap-icon" /> AI Alerts BEFORE Price Changes</li>
                                <li style={{ fontSize: '0.85rem' }}><FiCheckCircle className="gap-icon" /> Catch Theft the Moment It Happens</li>
                                <li style={{ fontSize: '0.85rem' }}><FiCheckCircle className="gap-icon" /> One-Click Compliance Reports</li>
                                <li style={{ fontSize: '0.85rem' }}><FiCheckCircle className="gap-icon" /> Stop Temperature Volume Physics</li>
                                <li style={{ fontSize: '0.85rem' }}><FiCheckCircle className="gap-icon" /> AI Advisor: "Buy Now" Alerts</li>
                            </ul>
                            <div style={{ marginTop: 'auto', color: 'var(--cyber-emerald)', fontWeight: 700, fontSize: '0.9rem' }}>
                                One-time Cost: Ksh 35,000
                            </div>
                        </div>
                    </div>

                    <div className="chat-revolution">
                        <div style={{ background: 'rgba(5, 150, 105, 0.1)', padding: '16px', borderRadius: '12px', color: 'var(--cyber-emerald)' }}>
                            <FiMessageSquare size={32} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Your Data, Now in Plain English</h3>
                            <p style={{ color: 'var(--text-muted)', lineHeight: '1.5', fontSize: '0.9rem' }}>
                                Forget complex dashboards. Ask IoTank AI: "Should I buy today?" or "Show me theft patterns."
                                Get answers instantly. No learning curve. Just conversations.
                            </p>
                        </div>
                    </div>
                </div>

                {/* SECTION 5: THE CHOICE */}


            </div>
            <SocialProofBar />
        </section>
    );
};

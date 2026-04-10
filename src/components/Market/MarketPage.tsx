/* eslint-disable @typescript-eslint/no-explicit-any, no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
    FiActivity,
    FiGlobe,
    FiAlertCircle,
    FiShield,
    FiTrendingUp,
    FiExternalLink,
    FiSearch,
    FiRefreshCw,
    FiBookmark,
    FiWifiOff,
    FiClock,
    FiCheckCircle,
    FiX,
    FiTrash2,
    FiArchive,
    FiInfo,
} from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useTanks } from '@/hooks/useSupabase';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';
import { useGeminiInsights } from '@/hooks/useGeminiInsights';
import { useMarketNews, NewsArticle } from '@/hooks/useMarketNews';
import { STRATEGIC_CAPABILITIES, OPERATIONAL_BOUNDARIES, IMPLICATION_META } from './MarketConstants';
import { calculateCommandOverviewMetrics } from '@/utils/strategicIntelligence';
import { TelemetryErrorBoundary, useTelemetryErrorHandling } from '@/components/Common/TelemetryErrorBoundary';
import { supabase } from '@/config/supabase';
import '../Common/DesignSystemCards.css';
import './MarketPage.css';

/**
 * Clean up HTML entities like &nbsp; or &amp; from RSS strings safely
 */
const decodeHTMLEntities = (text: string) => {
    if (!text) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    return doc.body.textContent || "";
};

// ─── Small helper components ──────────────────────────────────────────────────

const PriorityBadge: React.FC<{ score: number }> = ({ score }) => {
    if (score > 0.85) return <span className="mi-pill mi-pill--high">HIGH PRIORITY</span>;
    if (score > 0.6) return <span className="mi-pill mi-pill--med">MEDIUM</span>;
    return <span className="mi-pill mi-pill--normal">NORMAL</span>;
};

const RegionChip: React.FC<{ region: 'Kenya' | 'Global' }> = ({ region }) => (
    <span className={`mi-pill mi-pill--${region.toLowerCase()}`}>{region}</span>
);

const TopicTag: React.FC<{ tag: string }> = ({ tag }) => (
    <span className="mi-topic-tag">#{tag}</span>
);

// ─── News Card ────────────────────────────────────────────────────────────────

const NewsCard: React.FC<{
    article: NewsArticle;
    onBookmark: (a: NewsArticle) => void;
    bookmarked: Set<string>;
    isArchive?: boolean;
    onDelete?: (id: string) => void;
    onIgnore?: (id: string) => void;
    currentEPRA?: number;
}> = ({ article, onBookmark, bookmarked, isArchive, onDelete, onIgnore, currentEPRA }) => {
    const [expanded, setExpanded] = useState(false);
    const isHighPriority = (article.relevanceScore ?? 0) > 0.85;
    const meta = IMPLICATION_META[article.implicationCategory] || IMPLICATION_META['General'];
    const isBookmarked = bookmarked.has(article.id);
    
    // Check if within 48 hours for "RECENT" badge
    const isRecent = (Date.now() - article.timestamp) < (48 * 60 * 60 * 1000);

    const timeAgo = () => {
        const diff = Date.now() - article.timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const isUnverified = article.validationStatus === 'flagged' || !article.isCorroborated;

    return (
        <div className={`mi-news-card ${isHighPriority ? 'mi-news-card--high' : ''} ${article.validationStatus === 'flagged' ? 'mi-news-card--flagged' : ''}`}>
            {/* Top severity strap */}
            <div className={`mi-news-top-strap mi-news-top-strap--${
                article.validationStatus === 'flagged' ? 'flagged' :
                (article.relevanceScore ?? 0) > 0.85 ? 'high' : 
                (article.relevanceScore ?? 0) > 0.6 ? 'med' : 'normal'
            }`} />

            <div className="mi-news-body">
                {/* Header Metadata Row */}
                <div className="mi-news-header-row">
                    <div className="mi-news-pill-group">
                        <span className="mi-pill mi-pill--source">
                            {article.feedSource}
                        </span>
                        <RegionChip region={article.region} />
                        {!isUnverified && <PriorityBadge score={article.relevanceScore ?? 0} />}
                        
                        {isRecent && !isArchive && <span className="mi-pill bg-emerald-500 text-white">RECENT</span>}
                        {isArchive && <span className="mi-pill mi-pill--archive">ARCHIVED</span>}
                        {article.isCorroborated && <span className="mi-pill bg-blue-500 text-white flex items-center gap-1"><FiCheckCircle size={10} /> CORROBORATED</span>}
                    </div>
                    <div className="mi-news-time">
                        {timeAgo()}
                    </div>
                </div>

                {/* Validation Banner if unverified/flagged */}
                {article.validationLabel && (
                    <div className={`mi-validation-banner ${article.validationStatus === 'flagged' ? 'mi-validation-banner--error' : 'mi-validation-banner--warn'}`}>
                        <FiAlertCircle size={14} />
                        <span>{article.validationLabel}</span>
                        {article.validationStatus === 'flagged' && currentEPRA && (
                            <span className="ml-auto opacity-70">Current: Ksh {currentEPRA}/L</span>
                        )}
                    </div>
                )}

                {/* Title */}
                <h3
                    className="mi-news-title"
                    onClick={() => setExpanded(e => !e)}
                >
                    {decodeHTMLEntities(article.title)}
                </h3>

                {/* Summary (Truncated) */}
                <p className="mi-news-summary">
                    {decodeHTMLEntities(article.summary).substring(0, 180)}...
                </p>

                {/* Tags & Relevance Row */}
                <div className="mi-news-meta-row">
                    <div className="mi-tag-row">
                        {article.topicTags.slice(0, 3).map(tag => <TopicTag key={tag} tag={tag} />)}
                    </div>
                    
                    <div className="mi-relevance-container ml-auto">
                        <span className="mi-relevance-label">{Math.round((article.relevanceScore ?? 0) * 100)}% Relevance</span>
                        <div className="mi-relevance-bar-bg">
                            <div 
                                className={`mi-relevance-bar-fill mi-relevance-bar-fill--${
                                    article.validationStatus === 'flagged' ? 'flagged' :
                                    (article.relevanceScore ?? 0) > 0.85 ? 'high' : 
                                    (article.relevanceScore ?? 0) > 0.6 ? 'med' : 'normal'
                                }`}
                                style={{ width: `${Math.round((article.relevanceScore ?? 0) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Expanded: Intelligence Briefing */}
                {expanded && (
                    <div className="mi-briefing-panel">
                        <div className="mi-briefing-header">
                            <FiShield size={12} className="text-accent" />
                            <span>Rule-based Intelligence Briefing</span>
                        </div>
                        <p className="mi-briefing-text">{decodeHTMLEntities(article.briefingSummary)}</p>
                        <div className={`mi-implication-banner ${meta.bg} ${meta.color}`}>
                            <strong>Key Implication:</strong> {article.implicationCategory} impact detected base on pattern matching.
                        </div>
                        {!article.isCorroborated && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-800 flex items-start gap-2">
                                <FiInfo size={14} className="mt-0.5 shrink-0" />
                                <div>
                                    <strong>Intelligence Note:</strong> This claim has not yet been corroborated by other independent sources. Proceed with caution.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Footer */}
                <div className="mi-news-footer">
                    <div className="mi-news-actions">
                        <button
                            className="mi-action-btn-outline"
                            onClick={() => setExpanded(e => !e)}
                        >
                            <FiActivity size={12} />
                            {expanded ? 'Close' : 'Analyze'}
                        </button>
                        <button
                            className={`mi-action-btn-outline ${isBookmarked ? 'mi-action-btn-outline--active' : ''}`}
                            onClick={() => onBookmark(article)}
                        >
                            <FiBookmark size={12} />
                            {isBookmarked ? 'Saved' : 'Bookmark'}
                        </button>
                        
                        {(isUnverified || article.validationStatus === 'flagged') && onIgnore && (
                            <button
                                className="mi-action-btn-outline mi-action-btn-outline--ignore"
                                onClick={() => onIgnore(article.id)}
                            >
                                <FiTrash2 size={12} />
                                Mark as Noise
                            </button>
                        )}

                        {/* Archive specific delete button */}
                        {isArchive && onDelete && (
                            <button
                                className="mi-action-btn-outline mi-action-btn-outline--delete"
                                onClick={() => onDelete(article.id)}
                            >
                                <FiTrash2 size={12} />
                                Purge
                            </button>
                        )}
                        {article.externalUrl && (
                            <a
                                href={article.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mi-external-link ml-2"
                            >
                                <FiExternalLink size={16} />
                            </a>
                        )}
                    </div>

                    {/* Impact Chip - Moved to Action Row Footer */}
                    <div className={`mi-pill mi-pill--category ${meta.color} bg-opacity-10 border border-current px-3 py-1`}>
                        {article.implicationCategory} IMPACT
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Status Banners ───────────────────────────────────────────────────────────

const StatusBanner: React.FC<{
    type: 'no-signal' | 'cached-stale' | 'source-unavailable';
    onRetry?: () => void;
    cacheAgeMs?: number | null;
    onDismiss: () => void;
}> = ({ type, onRetry, cacheAgeMs, onDismiss }) => {
    if (type === 'no-signal') return (
        <div className="mi-banner mi-banner--error">
            <FiWifiOff size={14} />
            <span><strong>No signal.</strong> All news sources are unreachable. Showing fallback data.</span>
            {onRetry && <button className="mi-banner-btn" onClick={onRetry}>Retry</button>}
            <button className="mi-banner-dismiss" onClick={onDismiss}><FiX size={12} /></button>
        </div>
    );
    if (type === 'cached-stale') {
        const mins = cacheAgeMs ? Math.round(cacheAgeMs / 60000) : '?';
        return (
            <div className="mi-banner mi-banner--warn">
                <FiClock size={14} />
                <span><strong>Cached results shown</strong> ({mins} min old). Sources may be temporarily unavailable.</span>
                {onRetry && <button className="mi-banner-btn" onClick={onRetry}>Refresh</button>}
                <button className="mi-banner-dismiss" onClick={onDismiss}><FiX size={12} /></button>
            </div>
        );
    }
    return (
        <div className="mi-banner mi-banner--warn">
            <FiAlertCircle size={14} />
            <span><strong>One or more sources unavailable.</strong> Displaying partial results.</span>
            <button className="mi-banner-dismiss" onClick={onDismiss}><FiX size={12} /></button>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const MarketPage: React.FC = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    const orgId = currentUser?.stationId || 'default-org-id';

    // Existing hooks (keep metrics & insights)
    const { signals, risks, prices } = useMarketIntelligence(orgId);
    const { tanks } = useTanks(orgId);
    const { insights } = useGeminiInsights(orgId);

    const {
        status: newsStatus,
        cacheAge,
        isRefreshing,
        canRefresh,
        refresh,
        filteredArticles,
        validateAgainstEPRA,
    } = useMarketNews();

    const [ignoredNewsIds, setIgnoredNewsIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('mi_ignored_news');
        return new Set(saved ? JSON.parse(saved) : []);
    });

    useEffect(() => {
        localStorage.setItem('mi_ignored_news', JSON.stringify(Array.from(ignoredNewsIds)));
    }, [ignoredNewsIds]);

    // Bookmarks & Persistence
    const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
    const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);

    // Deleted News Persistence (Local for now, could be Supabase table)
    const [deletedNewsIds, setDeletedNewsIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('mi_deleted_news');
        return new Set(saved ? JSON.parse(saved) : []);
    });

    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Live clock for header
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'med'>('all');

    // Tab logic
    const [activeTab, setActiveTab] = useState<'news' | 'analytics' | 'strategy' | 'archive'>('news');

    // Thresholds
    const LIFESPAN_DAYS = 14;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const ARCHIVE_THRESHOLD = LIFESPAN_DAYS * MS_PER_DAY;

    // Persist deleted IDs
    useEffect(() => {
        localStorage.setItem('mi_deleted_news', JSON.stringify(Array.from(deletedNewsIds)));
    }, [deletedNewsIds]);

    // Deep-linking from notifications
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tabParam = queryParams.get('tab');
        if (tabParam && ['news', 'analytics', 'strategy', 'archive'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        }
    }, [location.search]);

    // Strategic intelligence metrics
    const metrics = useTelemetryErrorHandling(
        () => calculateCommandOverviewMetrics(signals, tanks, risks),
        {
            signalIntegrity: { score: 0, status: 'PARTIAL_BLACKOUT' as const, activeSources: 0, totalSources: 15, dataFreshness: 'Stale', crossVerification: 0 },
            marketSentiment: { score: 50, label: 'Neutral' as const, momentum: 'stable' as const, confidence: 'Low' as const, sourceAgreement: 0, totalSources: 0 },
            systemLatency: { score: 999, status: 'degraded' as const, breakdown: { newsFetch: 999, aiProcessing: 999, dashboardUpdate: 999 } },
            tankRiskOverlay: { score: 0, level: 'LOW_STRATEGIC_RISK' as const, timeToEmpty: 999, marketVolatility: 0, supplyRisk: 0, recommendation: 'System error — check telemetry' },
            strategicConfidence: { score: 0, level: 'Low' as const, sourceAgreement: 0, signalClarity: 'Low', historicalAccuracy: 0 },
        },
        'Strategic Intelligence Metrics Calculation'
    );

    // Bookmark handler
    const handleBookmark = useCallback(async (article: NewsArticle) => {
        if (bookmarked.has(article.id)) return;
        setBookmarked(prev => new Set([...prev, article.id]));
        setBookmarkFeedback(`"${article.title.substring(0, 40)}…" saved`);
        setTimeout(() => setBookmarkFeedback(null), 2500);
        try {
            const { error } = await supabase
                .from('market_bookmarks')
                .insert({
                    station_id: orgId,
                    title: article.title,
                    url: article.externalUrl || null,
                    source: article.feedSource,
                    published_at: new Date(article.timestamp).toISOString(),
                });
            if (error) throw error;
        } catch (err) {
            console.warn('[Market] Bookmark save failed:', err);
        }
    }, [bookmarked, orgId]);

    // Ignore handler
    const handleIgnoreNews = useCallback((id: string) => {
        setIgnoredNewsIds(prev => new Set([...prev, id]));
    }, []);

    // Delete handler
    const handleDeleteNews = useCallback((id: string) => {
        setDeletedNewsIds(prev => new Set([...prev, id]));
    }, []);

    // ─── Data Split Logic ───
    
    const { verifiedFeed, unverifiedFeed, archiveFeed, currentEPRA } = React.useMemo(() => {
        const now = Date.now();
        
        // Find latest EPRA price for validation (Diesel/AGO is most common reference)
        const epraLatest = prices.find(p => p.fuelType === 'AGO' || p.source === 'epra')?.pricePerLiter || 184.50; // Use fallback from KPI if none found

        // Map signals + regular news
        const mappedSignals: NewsArticle[] = signals.map(s => ({
            ...s,
            region: (s as any).region || ((s.title.toLowerCase().includes('kenya') || (s.source ?? '').toLowerCase().includes('kenya')) ? 'Kenya' : 'Global'),
            topicTags: (s as any).topicTags || [],
            implicationCategory: (s as any).implicationCategory || 'General',
            briefingSummary: (s as any).briefingSummary || s.summary,
            feedSource: s.attribution || s.source || 'Intelligence',
        }));

        const combined = [...filteredArticles, ...mappedSignals];
        
        // Apply EPRA Validation
        const validated = validateAgainstEPRA(combined, epraLatest);

        // Deduplicate & Filter Persistent Deletions / Ignores
        const seenIds = new Set<string>();
        const processed = validated.filter(a => {
            if (seenIds.has(a.id)) return false;
            if (deletedNewsIds.has(a.id)) return false;
            if (ignoredNewsIds.has(a.id)) return false;
            seenIds.add(a.id);
            return true;
        });

        // Split by 14 days and verification status
        const verified: NewsArticle[] = [];
        const unverified: NewsArticle[] = [];
        const archived: NewsArticle[] = [];

        processed.forEach(a => {
            const age = now - a.timestamp;
            if (age > ARCHIVE_THRESHOLD) {
                archived.push(a);
            } else {
                const isUnverified = a.validationStatus === 'flagged' || !a.isCorroborated;
                if (isUnverified) {
                    unverified.push(a);
                } else {
                    verified.push(a);
                }
            }
        });

        return {
            verifiedFeed: verified.sort((a, b) => b.timestamp - a.timestamp),
            unverifiedFeed: unverified.sort((a, b) => b.timestamp - a.timestamp),
            archiveFeed: archived.sort((a, b) => b.timestamp - a.timestamp),
            currentEPRA: epraLatest
        };
    }, [filteredArticles, signals, deletedNewsIds, ignoredNewsIds, ARCHIVE_THRESHOLD, prices, validateAgainstEPRA]);

    // Search & Filter application
    const filterList = (list: NewsArticle[]) => {
        return list.filter(a => {
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                if (!a.title.toLowerCase().includes(q) && !a.summary.toLowerCase().includes(q)) return false;
            }
            if (priorityFilter === 'high' && (a.relevanceScore ?? 0) <= 0.85) return false;
            if (priorityFilter === 'med' && ((a.relevanceScore ?? 0) <= 0.6 || (a.relevanceScore ?? 0) > 0.85)) return false;
            return true;
        });
    };

    const currentDisplayList = activeTab === 'archive' ? filterList(archiveFeed) : filterList(verifiedFeed);
    const currentUnverifiedList = activeTab === 'archive' ? [] : filterList(unverifiedFeed);
    
    const procurementAdvisories = insights.filter(i => i.type === 'procurement');
    const showBanner = !bannerDismissed && (newsStatus === 'no-signal' || newsStatus === 'cached-stale');

    return (
        <TelemetryErrorBoundary>
            <div className="market-page max-w-7xl mx-auto">

                {/* ── Tactical Command Header ── */}
                <header className="market-header mb-8">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#323264]">
                                    Market <span className="font-normal text-[#7A7A95]">intelligence</span>
                                </h1>
                                <p className="text-[8px] text-[#7A7A95] font-medium uppercase tracking-widest mt-1 opacity-70">
                                    Operational Status: {newsStatus === 'ok' ? 'Online' : 'Intermittent Signal'} · {currentTime.toLocaleTimeString()}
                                    {newsStatus === 'loading' && <FiRefreshCw className="inline ml-2 animate-spin text-accent" size={6} />}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                className={`mi-refresh-btn-premium ${!canRefresh || isRefreshing ? 'mi-refresh-btn-premium--disabled' : ''}`}
                                onClick={refresh}
                                disabled={!canRefresh || isRefreshing}
                            >
                                <FiRefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                                {isRefreshing ? 'Scanning...' : 'Refresh intel'}
                            </button>
                            <button className="mi-export-btn-premium">
                                <FiTrendingUp size={14} /> Export
                            </button>
                        </div>
                    </div>

                    {/* Mission-Critical KPIs (Promoted to Header) */}
                    <div className="mission-status-grid">
                        {[
                            { label: 'Brent Crude', val: '$74.50', unit: '/bbl', delta: '+1.2%', up: true, sub: 'Global benchmark' },
                            { label: 'KES/USD Rate', val: '128.40', unit: '', delta: '-0.3%', up: false, sub: 'CBK mid-rate' },
                            { label: 'EPRA Pump Price', val: 'KES 184.50', unit: '/L', delta: '+4.2%', up: true, sub: 'AGO · Current cycle' },
                            { label: 'OTS Cycle', val: '14 days', unit: '', delta: 'Jan 15–Feb 14', up: true, sub: 'Next review countdown' },
                        ].map((kpi, idx) => (
                            <div key={idx} className="an-kpi-card">
                                <div className="an-kpi-label">{kpi.label}</div>
                                <div className="an-kpi-value">{kpi.val}<span className="an-kpi-unit">{kpi.unit}</span></div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`an-kpi-delta ${kpi.up ? 'an-kpi-delta--up' : 'an-kpi-delta--down'}`}>
                                        {kpi.up ? '▲' : '▼'} {kpi.delta}
                                    </span>
                                    <span className="an-kpi-sub">{kpi.sub}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </header>

                <div className="mi-tab-bar mb-8">
                    {([
                        { id: 'news', label: 'LIVE Feed', icon: <FiGlobe size={14} />, dot: true },
                        { id: 'analytics', label: 'Analytics', icon: <FiTrendingUp size={14} />, dot: false },
                        { id: 'strategy', label: 'Strategy', icon: <FiShield size={14} />, dot: false },
                        { id: 'archive', label: 'Archive', icon: <FiArchive size={14} />, dot: false },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`mi-tab-btn ${activeTab === tab.id ? 'mi-tab-btn--active' : ''}`}
                        >
                            <span className="mi-tab-icon">{tab.icon}</span>
                            <span className="mi-tab-label">{tab.label}</span>
                            {tab.dot && newsStatus === 'ok' && verifiedFeed.some(a => (Date.now() - a.timestamp) < 48 * 60 * 60 * 1000) && <span className="mi-tab-live-dot" />}
                        </button>
                    ))}
                </div>

                {/* ── LIVE Feed & Archive Views ── */}
                {(activeTab === 'news' || activeTab === 'archive') && (
                    <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                        {showBanner && activeTab === 'news' && (
                            <StatusBanner
                                type={newsStatus as any}
                                cacheAgeMs={cacheAge}
                                onRetry={canRefresh ? refresh : undefined}
                                onDismiss={() => setBannerDismissed(true)}
                            />
                        )}

                        {bookmarkFeedback && (
                            <div className="mi-bookmark-toast">
                                <FiBookmark size={12} /> {bookmarkFeedback}
                            </div>
                        )}

                        {/* Filter toolbar */}
                        <div className="mi-filter-bar">
                            <div className="mi-search-wrap">
                                <FiSearch className="mi-search-icon" size={14} />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'archive' ? "Search historical data..." : "Search live intelligence..."}
                                    className="mi-search-input"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="mi-chip-row">
                                {(['all', 'high', 'med'] as const).map(p => (
                                    <button
                                        key={p}
                                        className={`mi-pill-btn ${priorityFilter === p ? 'mi-pill-btn--active' : ''}`}
                                        onClick={() => setPriorityFilter(p)}
                                    >
                                        {p === 'all' ? 'All Priority' : p === 'high' ? 'High' : 'Medium'}
                                    </button>
                                ))}
                                <div className="mi-chip-divider" />
                                <div className="text-[10px] font-bold text-[#7A7A95] uppercase">
                                    {currentDisplayList.length} {activeTab === 'archive' ? 'historical' : 'current'} signals
                                </div>
                            </div>
                            
                            {activeTab === 'archive' && (
                                <div className="ml-auto text-[10px] bg-amber-500/10 text-amber-600 px-3 py-1 rounded-md font-bold uppercase">
                                    Older than {LIFESPAN_DAYS}d
                                </div>
                            )}
                        </div>

                        {/* Article list */}
                        {currentDisplayList.length > 0 || currentUnverifiedList.length > 0 ? (
                            <div className="space-y-8">
                                {/* Verified Section */}
                                {currentDisplayList.length > 0 && (
                                    <div className="space-y-3">
                                        {currentDisplayList.map(article => (
                                            <NewsCard
                                                key={article.id}
                                                article={article}
                                                onBookmark={handleBookmark}
                                                bookmarked={bookmarked}
                                                isArchive={activeTab === 'archive'}
                                                onDelete={handleDeleteNews}
                                                onIgnore={handleIgnoreNews}
                                                currentEPRA={currentEPRA}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Unverified Section */}
                                {currentUnverifiedList.length > 0 && (
                                    <div className="mi-unverified-section space-y-3">
                                        <div className="mi-section-divider">
                                            <FiAlertCircle size={14} className="text-amber-500" />
                                            <span>UNVERIFIED SIGNALS ({currentUnverifiedList.length})</span>
                                            <div className="mi-divider-line" />
                                        </div>
                                        
                                        <div className="mi-unverified-banner">
                                            <FiInfo size={14} />
                                            <span>The following signals are either single-source or show significant variance from official EPRA benchmark data. Useful for early intelligence but not yet confirmed.</span>
                                        </div>

                                        {currentUnverifiedList.map(article => (
                                            <NewsCard
                                                key={article.id}
                                                article={article}
                                                onBookmark={handleBookmark}
                                                bookmarked={bookmarked}
                                                isArchive={activeTab === 'archive'}
                                                onDelete={handleDeleteNews}
                                                onIgnore={handleIgnoreNews}
                                                currentEPRA={currentEPRA}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : newsStatus !== 'loading' && (
                            <div className="mi-empty-state">
                                <FiGlobe size={36} className="mi-empty-icon" />
                                <p className="mi-empty-title">{searchTerm ? 'No matches found' : activeTab === 'archive' ? 'Archive is empty' : 'Feed is empty'}</p>
                                <p className="mi-empty-sub">Signals beyond {LIFESPAN_DAYS} days will appear in the Archive.</p>
                            </div>
                        )}

                        {/* Loading */}
                        {newsStatus === 'loading' && currentDisplayList.length === 0 && (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => <div key={i} className="mi-skeleton-card" />)}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Analytics Tab ── */}
                {activeTab === 'analytics' && (
                    <div className="an-grid animate-in slide-in-from-bottom-4 duration-500 space-y-6">

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 ds-card p-6 an-chart-card">
                                <h3 className="text-base font-black text-[#323264] flex items-center gap-2 mb-4">
                                    <FiActivity className="text-accent" size={16} /> 12-Month Market Sentiment Index
                                </h3>
                                <div className="an-bar-chart flex items-center justify-between gap-4 h-64">
                                    {[45, 52, 48, 65, 78, 82, 75, 88, 92, 85, 78, 84].map((v, i) => (
                                        <div key={i} className="an-bar-col h-full flex items-end flex-1">
                                            <div 
                                                className={`an-bar w-full rounded-t-lg transition-all ${v > 70 ? 'an-bar--bull' : v > 55 ? 'an-bar--mid' : 'an-bar--bear'}`} 
                                                style={{ height: `${v}%` }} 
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="ds-card p-6">
                                <h3 className="text-base font-black text-[#323264] mb-4">Supply Volatility Matrix</h3>
                                <div className="grid grid-cols-7 gap-2">
                                    {[...Array(28)].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`aspect-square rounded-md ${i % 7 === 0 ? 'bg-red-500/20' : i % 5 === 0 ? 'bg-amber-500/20' : 'bg-emerald-500/10'}`}
                                            title={`Day ${i+1}: Stability High`}
                                        />
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#7A7A95]">
                                        <div className="w-2 h-2 rounded-full bg-red-500" /> High Criticality
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#7A7A95]">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" /> Moderate Warning
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#7A7A95]">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Operational Stability
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Strategy Tab ── */}
                {activeTab === 'strategy' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                             <div className="ds-card st-advisory-card p-8 bg-gradient-to-br from-white to-[#f8f9ff]">
                                 <div className="flex items-center gap-3 mb-6">
                                     <FiShield className="text-accent" size={24} />
                                     <h2 className="text-xl font-black text-[#323264]">Command Strategy Overview</h2>
                                     <div className="ml-auto st-confidence-badge">{metrics.strategicConfidence.level} Confidence</div>
                                 </div>
                                 {procurementAdvisories.length > 0 ? (
                                     <div>
                                         <div className="text-lg font-bold text-[#323264] mb-2">{procurementAdvisories[0].title}</div>
                                         <p className="text-sm text-[#7A7A95] leading-relaxed mb-6">{procurementAdvisories[0].recommendation}</p>
                                         <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-6">
                                             <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Projected Savings</div>
                                             <div className="text-2xl font-black text-emerald-700">KES 420,000.00 / mo</div>
                                         </div>
                                         <button className="mi-refresh-btn-premium w-full justify-center py-4">Confirm Procurement Directive</button>
                                     </div>
                                 ) : (
                                     <div className="flex flex-col items-center justify-center py-12 text-[#7A7A95]">
                                         <FiShield size={48} className="opacity-20 mb-4" />
                                         <p className="text-center text-sm">Evaluating market signals for procurement advisories... <br/> No critical directives at this time.</p>
                                     </div>
                                 )}
                             </div>

                             <div className="space-y-4">
                                 <div className="ds-card p-6">
                                     <h3 className="text-base font-black text-[#323264] mb-4">Tactical Guardrails</h3>
                                     <div className="space-y-3">
                                         {OPERATIONAL_BOUNDARIES.map((b, i) => (
                                             <div key={i} className="flex items-start gap-3 p-3 bg-[#F4F5FF] rounded-xl">
                                                 <FiCheckCircle className="text-accent mt-0.5" size={14} />
                                                 <span className="text-[11px] font-bold text-[#323264]">{b}</span>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                                 <div className="ds-card p-6">
                                     <h3 className="text-base font-black text-[#323264] mb-4">System Capabilities</h3>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                         {STRATEGIC_CAPABILITIES.map((c, i) => (
                                             <div key={i} className="p-3 border border-[#E8E9F5] rounded-xl flex items-center gap-2">
                                                 <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                 <span className="text-[10px] font-bold text-[#7A7A95]">{c}</span>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             </div>
                         </div>
                    </div>
                )}

            </div>
        </TelemetryErrorBoundary>
    );
};

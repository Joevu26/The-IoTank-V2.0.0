/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useMarketNews — Spark-Safe Market Intelligence Hook
 *
 * Architecture:
 *  - Client-side RSS fetch via rss2json.com (free, no key, no proxy needed)
 *  - localStorage cache with 15-min TTL
 *  - 30-second refresh rate-limit guard
 *  - Rule-based relevance scoring and topic tagging (no LLM calls)
 *  - Failure states: 'ok' | 'cached-stale' | 'no-signal' | 'source-unavailable'
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';
import { MarketSignal } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000;       // 15 minutes — standard news sources
const CACHE_TTL_SLOW_MS = 60 * 60 * 1000;  // 60 minutes — regulatory/forex (low frequency)
const REFRESH_COOLDOWN_MS = 30 * 1000;     // 30 seconds

// ─── Proxies ──────────────────────────────────────────────────────────────────
const PROXY_BASE = 'https://suifvborodwergtrbjez.supabase.co/functions/v1';
const RSS_PARSER = `${PROXY_BASE}/rss-parser`;
const GNEWS_PROXY = `${PROXY_BASE}/gnews-proxy`;
const NEWSDATA_PROXY = `${PROXY_BASE}/newsdata-proxy`;
const CURRENTS_PROXY = `${PROXY_BASE}/currents-proxy`;

// Google News RSS fallback queries
const GN_RSS = (query: string) =>
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-KE&gl=KE&ceid=KE:en`;


// ─── Source Credibility Mapping ──────────────────────────────────────────────

const SOURCE_CREDIBILITY: Record<string, number> = {
    'epra.go.ke': 1.0,
    'cbk.go.ke': 1.0,
    'eia.gov': 0.95,
    'reuters.com': 0.85,
    'oilprice.com': 0.85,
    'businessdailyafrica.com': 0.75,
    'nation.africa': 0.75,
    'the-star.co.ke': 0.60,
    'standardmedia.co.ke': 0.70,
};

const HIGH_IMPACT_KEYWORDS = ['price increase', 'price hike', 'fuel rise', 'pump price', 'price drop', 'price reduction'];

// ─── Whitelisted RSS Sources ──────────────────────────────────────────────────

export interface NewsFeedSource {
    label: string;
    shortLabel: string;
    region: 'Kenya' | 'Global';
    url: string;
    type: 'Regulatory' | 'News Outlet' | 'Commodity' | 'Logistics';
    /** Override cache TTL (ms). Defaults to CACHE_TTL_MS (15 min). */
    cacheTTL?: number;
}

export const NEWS_SOURCES: NewsFeedSource[] = [
    // ── Tier 1: Kenya Regulatory (highest priority) ──────────────────────────
    {
        label: 'EPRA — Petroleum Pricing',
        shortLabel: 'EPRA',
        region: 'Kenya',
        url: GN_RSS('EPRA Kenya fuel petroleum price petroleum regulatory authority'),
        type: 'Regulatory',
        cacheTTL: CACHE_TTL_MS,
    },
    {
        label: 'Central Bank of Kenya — Forex',
        shortLabel: 'CBK',
        region: 'Kenya',
        url: GN_RSS('Central Bank Kenya shilling forex rate'),
        type: 'Regulatory',
        cacheTTL: CACHE_TTL_SLOW_MS, // CBK data moves slowly — 1hr TTL
    },
    {
        label: 'Kenya Ports Authority — Logistics',
        shortLabel: 'KPA',
        region: 'Kenya',
        url: GN_RSS('Kenya Ports Authority Mombasa fuel supply terminal'),
        type: 'Logistics',
        cacheTTL: CACHE_TTL_SLOW_MS,
    },

    // ── Tier 2: Kenya News ────────────────────────────────────────────────────
    {
        label: 'Business Daily Africa',
        shortLabel: 'BD Africa',
        region: 'Kenya',
        url: GN_RSS('Business Daily Africa fuel energy'),
        type: 'News Outlet',
    },
    {
        label: 'Nation Africa — Kenya',
        shortLabel: 'Nation',
        region: 'Kenya',
        url: GN_RSS('Nation Africa Kenya fuel prices energy'),
        type: 'News Outlet',
    },
    {
        label: 'The Standard Media',
        shortLabel: 'Standard',
        region: 'Kenya',
        url: GN_RSS('Standard Media Kenya petroleum news'),
        type: 'News Outlet',
    },

    // ── Tier 3: Global Commodity ──────────────────────────────────────────────
    {
        label: 'Reuters — Commodities',
        shortLabel: 'Reuters',
        region: 'Global',
        url: 'https://feeds.reuters.com/reuters/businessNews',
        type: 'News Outlet',
    },
    {
        label: 'OilPrice.com',
        shortLabel: 'OilPrice',
        region: 'Global',
        url: 'https://oilprice.com/rss/main',
        type: 'Commodity',
    },
    // ── Tier 4: Intelligence Proxies (Internal) ──────────────────────────────
    {
        label: 'EIA Petroleum Intelligence',
        shortLabel: 'EIA',
        region: 'Global',
        url: 'proxy:eia',
        type: 'Commodity',
        cacheTTL: CACHE_TTL_SLOW_MS,
    },
    {
        label: 'Global Exchange Parity',
        shortLabel: 'Forex',
        region: 'Global',
        url: 'proxy:exchange-rate',
        type: 'Regulatory',
        cacheTTL: CACHE_TTL_SLOW_MS,
    },
    {
        label: 'Alpha Vantage Market Sentiment',
        shortLabel: 'AlphaV',
        region: 'Global',
        url: 'proxy:alpha-vantage',
        type: 'Commodity',
    },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type FetchStatus = 'ok' | 'cached-stale' | 'no-signal' | 'source-unavailable' | 'loading';

export interface NewsArticle extends MarketSignal {
    region: 'Kenya' | 'Global';
    topicTags: string[];
    implicationCategory: 'Price' | 'Supply' | 'Compliance' | 'Logistics' | 'General';
    briefingSummary: string;   // Rule-based 200-char snippet + implication
    feedSource: string;        // shortLabel of origin
    imageUrl?: string;
    
    // ─── Verification Metadata ───
    confidenceScore: number;   // 0-1.0
    verificationStatus: 'verified' | 'unverified' | 'disputed' | 'flagged';
    validationLabel?: string;
    isCorroborated?: boolean;
    corroborationCount?: number;
    isUnhighlighted?: boolean; // If hidden/auto-hide
    isOfficial?: boolean;      // EPRA / Official Kenyan Agency
}


interface CachePayload {
    articles: NewsArticle[];
    fetchedAt: number;
}

// ─── Rule-based helpers ───────────────────────────────────────────────────────

function computeTopicTags(title: string, description: string): string[] {
    const text = (title + ' ' + description).toLowerCase();
    const tags: string[] = [];
    if (text.includes('epra') || text.includes('energy regulatory')) tags.push('EPRA');
    if (text.includes('price') || text.includes('pump price') || text.includes('petroleum price')) tags.push('PriceAlert');
    if (text.includes('supply') || text.includes('shortage') || text.includes('shortage')) tags.push('SupplyChain');
    if (text.includes('forex') || text.includes('dollar') || text.includes('shilling') || text.includes('exchange rate')) tags.push('Forex');
    if (text.includes('crude') || text.includes('brent') || text.includes('wti')) tags.push('CrudeOil');
    if (text.includes('pipeline') || text.includes('kpc') || text.includes('logistics') || text.includes('port') || text.includes('terminal')) tags.push('Logistics');
    if (text.includes('tax') || text.includes('vat') || text.includes('levy') || text.includes('excise')) tags.push('Tax');
    if (text.includes('diesel') || text.includes('petrol') || text.includes('kerosene') || text.includes('lpg')) tags.push('FuelProduct');
    return tags.length > 0 ? tags : ['General'];
}

function computeImplication(title: string, summary: string): 'Price' | 'Supply' | 'Compliance' | 'Logistics' | 'General' {
    const text = (title + ' ' + summary).toLowerCase();
    if (text.includes('epra') || text.includes('regulation') || text.includes('tax') || text.includes('vat') || text.includes('mandate')) return 'Compliance';
    if (text.includes('pipeline') || text.includes('port') || text.includes('logistics') || text.includes('terminal') || text.includes('shipping')) return 'Logistics';
    if (text.includes('supply') || text.includes('shortage') || text.includes('stock')) return 'Supply';
    if (text.includes('price') || text.includes('crude') || text.includes('brent') || text.includes('cost') || text.includes('forex') || text.includes('shilling')) return 'Price';
    return 'General';
}

function computeRelevanceScore(title: string, summary: string, sourceType: string, externalUrl?: string): number {
    const text = (title + ' ' + summary).toLowerCase();
    let score = 0.65;
    if (text.includes('epra')) score += 0.2;
    if (text.includes('fuel') || text.includes('petroleum') || text.includes('diesel') || text.includes('petrol')) score += 0.15;
    if (text.includes('kenya') || text.includes('nairobi')) score += 0.05;
    if (text.includes('price')) score += 0.1;
    if (sourceType === 'Regulatory') score += 0.2; // Substantial boost, but not pinned to 100%
    if (sourceType === 'Commodity') score += 0.1;

    // Apply Source Credibility Multiplier
    let multiplier = 0.7; // Default for unknown sources
    if (externalUrl) {
        try {
            const domain = new URL(externalUrl).hostname.replace('www.', '');
            if (SOURCE_CREDIBILITY[domain]) {
                multiplier = SOURCE_CREDIBILITY[domain];
            } else {
                // Check if any key is a substring (e.g. nation.africa might be business.nation.africa)
                const entry = Object.entries(SOURCE_CREDIBILITY).find(([key]) => domain.includes(key));
                if (entry) multiplier = entry[1];
            }
        } catch { /* ignore invalid urls */ }
    }

    return Math.min(score * multiplier, 1.0);
}

function extractPriceFromText(text: string): number | null {
    // Regex for "Ksh 123", "Ksh 123.45", "Ksh. 123"
    const match = text.match(/ksh\.?\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
    if (match && match[1]) {
        return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
}

function validatePriceClaim(article: NewsArticle, currentEPRAPrice: number) {
    const text = (article.title + ' ' + article.summary);
    const claimedPrice = extractPriceFromText(text);

    if (!claimedPrice) return { status: 'unverifiable' as const };

    const deviation = Math.abs(claimedPrice - currentEPRAPrice) / currentEPRAPrice;

    if (deviation > 0.20) {
        return {
            status: 'flagged' as const,
            label: `⚠️ Unverified — exceeds 20% variance from current EPRA data (Ksh ${currentEPRAPrice})`,
            autoHide: true
        };
    }
    return { status: 'plausible' as const };
}

function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    if (s1 === s2) return 1.0;
    
    // Simple word-based Jaccard similarity
    const w1 = new Set(s1.split(/\s+/));
    const w2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    const union = new Set([...w1, ...w2]);
    return intersection.size / union.size;
}

function calculateConfidenceScore(article: NewsArticle, corroborationCount: number): number {
    let score = article.confidenceScore;

    // + Boost for high-authority sources
    const domain = article.externalUrl ? new URL(article.externalUrl).hostname.replace('www.', '') : '';
    if (SOURCE_CREDIBILITY[domain] >= 0.9) score += 0.15;
    
    // + Boost for corroboration
    score += (corroborationCount * 0.1);

    // - Penalty for single-source high-impact claims
    const isHighImpact = HIGH_IMPACT_KEYWORDS.some(kw => 
        (article.title + ' ' + article.summary).toLowerCase().includes(kw)
    );
    if (isHighImpact && corroborationCount === 0) score -= 0.1;

    return Math.min(score, 1.0);
}

function corroborateArticles(articles: NewsArticle[]): NewsArticle[] {
    return articles.map(item => {
        const others = articles.filter(n => 
            n.id !== item.id && 
            calculateSimilarity(n.title, item.title) > 0.35
        );

        const corroborationCount = others.length;
        const score = calculateConfidenceScore(item, corroborationCount);
        
        // Final Status Determination
        let status: NewsArticle['verificationStatus'] = 'unverified';
        if (score > 0.85) status = 'verified';
        if (score < 0.4 && corroborationCount === 0) status = 'unverified';
        
        return {
            ...item,
            corroborationCount,
            isCorroborated: corroborationCount > 0,
            confidenceScore: score,
            verificationStatus: status,
            validationLabel: status === 'unverified' && corroborationCount === 0 ? '🔍 Unconfirmed — single source' : 
                             status === 'verified' ? '✅ Verified Market Signal' : undefined
        };
    });
}


function buildBriefingSummary(title: string, description: string, implication: string): string {
    const cleanDesc = description.replace(title, '').replace(/<[^>]*>/g, '').trim();
    const snippet = cleanDesc.length > 20 ? cleanDesc.substring(0, 300) : description.substring(0, 300);
    return `${snippet || title} | Strategic Context: This ${implication.toLowerCase()} signal suggests immediate monitoring of operational margins.`;
}

function buildSignalFromArticle(
    article: any,
    source: NewsFeedSource
): NewsArticle {
    const title = article.title || 'Untitled';
    const description = (article.description || article.content || '').replace(/<[^>]*>/g, '');
    const topicTags = computeTopicTags(title, description);
    const implicationCategory = computeImplication(title, description);
    const link = article.link || article.url || article.guid || undefined;
    const relevanceScore = computeRelevanceScore(title, description, source.type, link);
    
    let publishedAt = Date.now();
    if (article.pubDate || article.publishedAt || article.published_at) {
        try {
            const dateStr = article.pubDate || article.publishedAt || article.published_at;
            publishedAt = new Date(dateStr).getTime();
            if (isNaN(publishedAt)) publishedAt = Date.now();
        } catch {
            publishedAt = Date.now();
        }
    }

    const signalSourceType = source.type === 'Logistics' ? 'Operational Alert' : source.type;

    return {
        id: `int-${source.shortLabel.replace(/\s/g, '_')}-${publishedAt}-${Math.random().toString(36).substring(7)}`,
        type: source.type === 'Regulatory' ? 'regulatory' : source.type === 'Commodity' ? 'market' : source.type === 'Logistics' ? 'logistics' : 'market',
        source: source.label,
        sourceType: signalSourceType,
        title,
        summary: (description.replace(title, '').trim() || description || title).substring(0, 500),
        timestamp: publishedAt,
        relevanceScore,
        confidenceScore: source.type === 'Regulatory' ? 0.95 : 0.7,
        verificationStatus: 'unverified',
        externalUrl: link,
        attribution: source.shortLabel,
        region: source.region,
        topicTags,
        implicationCategory,
        briefingSummary: buildBriefingSummary(title, description, implicationCategory),
        feedSource: source.shortLabel,
        isOfficial: source.type === 'Regulatory',
        imageUrl: article.thumbnail || article.urlToImage || article.image || article.enclosure?.link || undefined,
    };
}


// ─── Cache helpers ────────────────────────────────────────────────────────────

function getCacheKey(sourceLabel: string): string {
    return `mi:news:${sourceLabel.replace(/\s/g, '_')}`;
}

function readCache(sourceLabel: string): { articles: NewsArticle[]; age: number } | null {
    try {
        const raw = localStorage.getItem(getCacheKey(sourceLabel));
        if (!raw) return null;
        const payload: any = JSON.parse(raw);
        const age = Date.now() - payload.fetchedAt;
        if (age > CACHE_TTL_MS * 2) {
            // Purge very old cache
            localStorage.removeItem(getCacheKey(sourceLabel));
            return null;
        }
        return { articles: payload.articles, age };
    } catch {
        return null;
    }
}


function writeCache(sourceLabel: string, articles: NewsArticle[]): void {
    try {
        const payload: CachePayload = { articles, fetchedAt: Date.now() };
        localStorage.setItem(getCacheKey(sourceLabel), JSON.stringify(payload));
    } catch {
        // Ignore storage quota errors
    }
}

function getLastRefreshTime(): number {
    try {
        return parseInt(localStorage.getItem('mi:lastRefresh') || '0', 10);
    } catch {
        return 0;
    }
}

function setLastRefreshTime(): void {
    try {
        localStorage.setItem('mi:lastRefresh', String(Date.now()));
    } catch { /* noop */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseMarketNewsReturn {
    articles: NewsArticle[];
    status: FetchStatus;
    cacheAge: number | null;        // ms since last fetch (null if live)
    lastUpdated: Date | null;       // Date of last successful fetch
    isRefreshing: boolean;
    canRefresh: boolean;            // false during 30s cooldown
    countdown: number;              // seconds remaining in cooldown
    refresh: () => Promise<void>;
    activeSource: string;           // 'all' or a source shortLabel
    setActiveSource: (s: string) => void;
    activeRegion: 'all' | 'Kenya' | 'Global';
    setActiveRegion: (r: 'all' | 'Kenya' | 'Global') => void;
    filteredArticles: NewsArticle[]; // post-filter view
    validateAgainstEPRA: (articles: NewsArticle[], epraPrice: number) => NewsArticle[];
}

export function useMarketNews(): UseMarketNewsReturn {
    const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
    const [status, setStatus] = useState<FetchStatus>('loading');
    const [cacheAge, setCacheAge] = useState<number | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [activeSource, setActiveSource] = useState('all');
    const [activeRegion, setActiveRegion] = useState<'all' | 'Kenya' | 'Global'>('all');

    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const apiCooldowns = useRef<Record<string, number>>({}); // Tracks API -> expiration timestamp

    // Adaptive backoff check
    const isApiAvailable = (api: string) => {
        const cooldown = apiCooldowns.current[api];
        if (!cooldown) return true;
        if (Date.now() > cooldown) {
            delete apiCooldowns.current[api];
            return true;
        }
        return false;
    };

    const markApiLimited = (api: string) => {
        console.warn(`[useMarketNews] API ${api} rate-limited. Backing off for 2 minutes.`);
        apiCooldowns.current[api] = Date.now() + 120000; // 2 minute cooldown
    };

    // Can refresh is computed from countdown
    const canRefresh = countdown === 0;

    // Start cooldown UI timer
    const startCooldown = useCallback(() => {
        const last = getLastRefreshTime();
        const elapsed = Date.now() - last;
        const remaining = Math.max(0, REFRESH_COOLDOWN_MS - elapsed);
        if (remaining <= 0) {
            setCountdown(0);
            return;
        }
        setCountdown(Math.ceil(remaining / 1000));
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const getSafeAuthHeaders = async (): Promise<Record<string, string>> => {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'apikey': anonKey || ''
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const isValidToken = session && (session.expires_at ? session.expires_at > (Date.now() / 1000) + 10 : true);
            
            if (isValidToken && session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } catch (e) {
            console.warn('[useMarketNews] Auth check failed, proceeding anonymously.');
        }

        return headers;
    };

    const fetchFromSource = useCallback(async (source: NewsFeedSource): Promise<NewsArticle[]> => {
        const cacheKey = source.shortLabel;
        const cached = readCache(cacheKey);
        const ttl = source.cacheTTL ?? CACHE_TTL_MS;
        if (cached && cached.age < ttl) {
            return cached.articles;
        }

        const headers = await getSafeAuthHeaders();
        const collected: NewsArticle[] = [];

        // 1. Try Primary: GNews API Proxy
        if (isApiAvailable('GNEWS')) {
            try {
                const response = await fetch(GNEWS_PROXY, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: source.shortLabel + ' fuel petroleum Kenya', max: 5 })
                });
                
                if (response.status === 429) {
                    markApiLimited('GNEWS');
                } else if (response.ok) {
                    const data = await response.json();
                    if (data.articles) {
                        const articles = data.articles.map((a: any) => buildSignalFromArticle(a, source));
                        collected.push(...articles);
                    }
                }
            } catch (e) { /* silent fail to fallback */ }
        }

        // 2. Try Secondary Redundancy (only if primary failed or returned nothing)
        if (collected.length === 0 && isApiAvailable('NEWSDATA')) {
            try {
                const response = await fetch(NEWSDATA_PROXY, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: source.shortLabel + ' energy Kenya' })
                });
                
                if (response.status === 429) {
                    markApiLimited('NEWSDATA');
                } else if (response.ok) {
                    const data = await response.json();
                    if (data.results) {
                        const articles = data.results.map((a: any) => buildSignalFromArticle(a, source));
                        collected.push(...articles);
                    }
                }
            } catch (e) {
                // Failover to Currents Proxy
                if (isApiAvailable('CURRENTS')) {
                    try {
                        const response = await fetch(CURRENTS_PROXY, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ query: source.shortLabel })
                        });
                        if (response.status === 429) {
                            markApiLimited('CURRENTS');
                        } else if (response.ok) {
                            const data = await response.json();
                            if (data.news) {
                                const articles = data.news.map((a: any) => buildSignalFromArticle(a, source));
                                collected.push(...articles);
                            }
                        }
                    } catch (ce) { /* exhaust proxies */ }
                }
            }
        }

        // 3. Last Resort: Self-Hosted RSS Parser (skip if Proxy-only source)
        const isUrlValid = source.url && source.url.startsWith('http');
        if (collected.length === 0 && isUrlValid && !source.url.startsWith('proxy:')) {
            try {
                const response = await fetch(RSS_PARSER, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ rssUrl: source.url })
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.items) {
                        const articles = data.items.map((i: any) => buildSignalFromArticle(i, source));
                        collected.push(...articles);
                    }
                }
            } catch (e) { /* total failure */ }
        }

        if (collected.length > 0) {
            writeCache(cacheKey, collected);
        }
        return collected;
    }, []);


    const fetchAll = useCallback(async (force = false) => {
        // Rate-limit check (skip on initial mount, enforce on manual refresh)
        if (force) {
            const last = getLastRefreshTime();
            if (Date.now() - last < REFRESH_COOLDOWN_MS) {
                return; // Blocked
            }
            setLastRefreshTime();
            startCooldown();
        }

        setIsRefreshing(true);
        setStatus('loading');

        try {
            // Sequential Fetching with Staggered Delays (Prevents 429 floods)
            const collected: NewsArticle[] = [];
            let anySuccess = false;
            let anyFromCache = false;

            for (const src of NEWS_SOURCES) {
                try {
                    const articles = await fetchFromSource(src);
                    if (articles.length > 0) {
                        const cached = readCache(src.shortLabel);
                        if (cached && cached.age > (src.cacheTTL || CACHE_TTL_MS)) {
                            anyFromCache = true;
                        } else {
                            anySuccess = true;
                        }
                        collected.push(...articles);
                    }
                } catch (e) {
                    console.error(`[useMarketNews] Batch error for ${src.shortLabel}:`, e);
                }
                // Small stagger delay between source requests
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            if (collected.length === 0) {
                setAllArticles([]);
                setStatus('no-signal');
            } else {
                // Deduplicate by URL or unique ID
                const seen = new Set<string>();
                const deduped = collected.filter(a => {
                    const ident = a.externalUrl || a.id;
                    if (seen.has(ident)) return false;
                    seen.add(ident);
                    return true;
                });
                // Sort by newest first
                deduped.sort((a, b) => b.timestamp - a.timestamp);
                
                // Final Pass: Corroboration
                const corroborated = corroborateArticles(deduped);
                
                setAllArticles(corroborated);
                setStatus(anyFromCache && !anySuccess ? 'cached-stale' : 'ok');
                setLastUpdated(new Date());
                setCacheAge(anyFromCache ? Date.now() - (getLastRefreshTime() - REFRESH_COOLDOWN_MS) : null);
            }
        } catch {
            setStatus('no-signal');
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchFromSource, startCooldown]);

    // Initial fetch on mount
    useEffect(() => {
        // On mount: load from cache instantly, then try to refresh if TTL expired
        const cachedArticles: NewsArticle[] = [];
        let hasAnyCached = false;
        NEWS_SOURCES.forEach(src => {
            const c = readCache(src.shortLabel);
            if (c) {
                cachedArticles.push(...c.articles);
                hasAnyCached = true;
            }
        });

        if (hasAnyCached) {
            const deduped = Array.from(new Map(cachedArticles.map(a => [a.externalUrl || a.id, a])).values());
            deduped.sort((a, b) => b.timestamp - a.timestamp);
            setAllArticles(deduped);
            setStatus('ok');
            setIsRefreshing(false);
        }

        // Still fetch in background to refresh if needed
        fetchAll(false);

        // Restore cooldown timer if still active
        startCooldown();

        return () => {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, []);

    const refresh = useCallback(async () => {
        if (!canRefresh) return;
        await fetchAll(true);
    }, [canRefresh, fetchAll]);

    // Filtered view
    const filteredArticles = allArticles.filter(a => {
        if (activeSource !== 'all' && a.feedSource !== activeSource) return false;
        if (activeRegion !== 'all' && a.region !== activeRegion) return false;
        return true;
    });

    const validateAgainstEPRA = useCallback((articles: NewsArticle[], epraPrice: number) => {
        return articles.map(a => {
            const validation = validatePriceClaim(a, epraPrice);
            return {
                ...a,
                verificationStatus: validation.status === 'flagged' ? 'flagged' : a.verificationStatus,
                validationLabel: a.validationLabel || validation.label,
                isUnhighlighted: (validation as any).autoHide || false
            };
        });
    }, []);

    return {
        articles: allArticles,
        status,
        cacheAge,
        lastUpdated,
        isRefreshing,
        canRefresh,
        countdown,
        refresh,
        activeSource,
        setActiveSource,
        activeRegion,
        setActiveRegion,
        filteredArticles,
        validateAgainstEPRA,
    };
}

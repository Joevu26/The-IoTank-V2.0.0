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
const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Google News RSS — free, no key, CORS-safe via rss2json, works for sites without direct RSS
// Filtered to Kenya-relevant domain/topic queries
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
        url: GN_RSS('EPRA Kenya fuel price petroleum'),
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
    validationStatus?: 'plausible' | 'flagged' | 'unverifiable';
    validationLabel?: string;
    isCorroborated?: boolean;
    isUnhighlighted?: boolean; // If hidden/auto-hide
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
    if (sourceType === 'Regulatory') score += 0.15;
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

function corroborateArticles(articles: NewsArticle[]): NewsArticle[] {
    return articles.map(item => {
        const needsCorroboration = HIGH_IMPACT_KEYWORDS.some(kw => 
            (item.title + ' ' + item.summary).toLowerCase().includes(kw)
        );
        
        if (!needsCorroboration) return item;

        const others = articles.filter(n => 
            n.id !== item.id && 
            calculateSimilarity(n.title, item.title) > 0.4 // Adjusted threshold for broader matching
        );

        const isCorroborated = others.length >= 1;
        
        return {
            ...item,
            isCorroborated,
            validationLabel: !isCorroborated ? '🔍 Unconfirmed — single source' : undefined
        };
    });
}

function buildBriefingSummary(title: string, description: string, implication: string): string {
    const snippet = description ? description.replace(/<[^>]*>/g, '').substring(0, 200) : title.substring(0, 200);
    return `${snippet.trim()}… | Key implication: ${implication} impact`;
}

function buildSignalFromArticle(
    article: any,
    source: NewsFeedSource
): NewsArticle {
    const title = article.title || 'Untitled';
    const description = (article.description || article.content || '').replace(/<[^>]*>/g, '');
    const topicTags = computeTopicTags(title, description);
    const implicationCategory = computeImplication(title, description);
    const link = article.link || article.guid || undefined;
    const relevanceScore = computeRelevanceScore(title, description, source.type, link);
    
    // Ensure pubDate is parsed as UTC if it's from rss2json
    let publishedAt = Date.now();
    if (article.pubDate) {
        try {
            // rss2json usually returns 'YYYY-MM-DD HH:MM:SS' in UTC
            const dateStr = article.pubDate.includes(' ') && !article.pubDate.includes('Z') && !article.pubDate.includes('GMT')
                ? `${article.pubDate} UTC`
                : article.pubDate;
            publishedAt = new Date(dateStr).getTime();
            if (isNaN(publishedAt)) publishedAt = Date.now();
        } catch (e) {
            console.warn('[useMarketNews] Date parse failed:', article.pubDate, e);
            publishedAt = Date.now();
        }
    }

    const signalSourceType = source.type === 'Logistics' ? 'Operational Alert' : source.type;

    return {
        id: `live-${source.shortLabel.replace(/\s/g, '_')}-${publishedAt}`,
        type: source.type === 'Regulatory' ? 'regulatory' : source.type === 'Commodity' ? 'market' : source.type === 'Logistics' ? 'logistics' : 'market',
        source: source.label,
        sourceType: signalSourceType,
        title,
        summary: description.substring(0, 300) || title,
        timestamp: publishedAt,
        relevanceScore,
        confidenceScore: 0.88,
        externalUrl: article.link || article.guid || undefined,
        attribution: source.shortLabel,
        region: source.region,
        topicTags,
        implicationCategory,
        briefingSummary: buildBriefingSummary(title, description, implicationCategory),
        feedSource: source.shortLabel,
        imageUrl: article.thumbnail || article.enclosure?.link || undefined,
    };
}

function parseXMLToArticles(xmlString: string, source: NewsFeedSource): NewsArticle[] {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const items = xmlDoc.querySelectorAll("item, entry");
        
        return Array.from(items).slice(0, 15).map(item => {
            const title = item.querySelector("title")?.textContent || "Untitled";
            // Check for link in various formats (RSS 2.0 <link>, Atom <link href="...">)
            const linkTag = item.querySelector("link");
            const link = linkTag?.getAttribute("href") || linkTag?.textContent || item.querySelector("guid")?.textContent || "";
            
            const description = item.querySelector("description")?.textContent || 
                              item.querySelector("summary")?.textContent || 
                              item.querySelector("content")?.textContent || "";
            
            const pubDate = item.querySelector("pubDate")?.textContent || 
                           item.querySelector("published")?.textContent || 
                           item.querySelector("updated")?.textContent || "";
            
            return buildSignalFromArticle({
                title,
                link,
                description,
                pubDate,
            }, source);
        });
    } catch (e) {
        console.warn('[useMarketNews] XML Parse Error:', e);
        return [];
    }
}


// ─── Cache helpers ────────────────────────────────────────────────────────────

function getCacheKey(sourceLabel: string): string {
    return `mi:news:${sourceLabel.replace(/\s/g, '_')}`;
}

function readCache(sourceLabel: string): { articles: NewsArticle[]; age: number } | null {
    try {
        const raw = localStorage.getItem(getCacheKey(sourceLabel));
        if (!raw) return null;
        const payload: CachePayload = JSON.parse(raw);
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

    const fetchFromSource = useCallback(async (source: NewsFeedSource): Promise<NewsArticle[]> => {
        const cacheKey = source.shortLabel;
        const cached = readCache(cacheKey);
        const ttl = source.cacheTTL ?? CACHE_TTL_MS;   // respect per-source TTL
        if (cached && cached.age < ttl) {
            return cached.articles;  // Fresh cache — use it
        }

        // 0. Handle Internal Intelligence Proxies
        if (source.url.startsWith('proxy:')) {
            try {
                const proxyName = source.url.split(':')[1];
                const { data: proxyData, error: proxyError } = await supabase.functions.invoke(`${proxyName}-proxy`, {
                    body: proxyName === 'alpha-vantage' ? { symbol: 'NEWS_SENTIMENT' } : {}
                });

                if (proxyError) throw proxyError;

                if (proxyName === 'eia' && proxyData?.data) {
                    const latest = proxyData.data[0];
                    if (!latest) return [];
                    const articles = [{
                        id: `eia-${latest.period || Date.now()}`,
                        type: 'market',
                        source: 'EIA Petroleum Intelligence',
                        sourceType: 'API',
                        title: `WTI Crude Spot Price: $${latest.value || 'N/A'} per barrel`,
                        summary: `Latest petroleum data from EIA indicates a spot price of $${latest.value || 'N/A'}. Period: ${latest.period || 'Recent'}.`,
                        timestamp: latest.period ? new Date(latest.period).getTime() : Date.now(),
                        relevanceScore: 0.95,
                        confidenceScore: 1.0,
                        attribution: 'EIA',
                        region: 'Global',
                        topicTags: ['PriceAlert', 'CrudeOil'],
                        implicationCategory: 'Price',
                        briefingSummary: `WTI Crude at $${latest.value} | Key implication: Global price pressure`,
                        feedSource: 'EIA'
                    } as NewsArticle];
                    writeCache(cacheKey, articles);
                    return articles;
                }

                if (proxyName === 'exchange-rate' && proxyData?.success) {
                    const articles = [{
                        id: `fx-${proxyData.timestamp}`,
                        type: 'regulatory',
                        source: 'Global Exchange Parity',
                        sourceType: 'API',
                        title: `USD/KES Exchange Rate: ${proxyData.rate}`,
                        summary: `Current market rate for USD to KES is ${proxyData.rate}. Base currency: ${proxyData.base}.`,
                        timestamp: proxyData.timestamp * 1000,
                        relevanceScore: 0.9,
                        confidenceScore: 0.98,
                        attribution: 'Forex',
                        region: 'Global',
                        topicTags: ['Forex', 'PriceAlert'],
                        implicationCategory: 'Price',
                        briefingSummary: `USD/KES at ${proxyData.rate} | Key implication: Import cost volatility`,
                        feedSource: 'Forex'
                    } as NewsArticle];
                    writeCache(cacheKey, articles);
                    return articles;
                }

                if (proxyName === 'alpha-vantage' && Array.isArray(proxyData?.feed)) {
                    const articles = proxyData.feed.slice(0, 5).map((item: any) => ({
                        id: `av-${item.url || Math.random().toString()}`,
                        type: 'market',
                        source: 'Alpha Vantage Sentiment',
                        sourceType: 'API',
                        title: item.title || 'Market Intelligence Update',
                        summary: item.summary || 'No summary available.',
                        timestamp: item.time_published 
                            ? new Date(item.time_published.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z')).getTime() 
                            : Date.now(),
                        relevanceScore: parseFloat(item.overall_sentiment_score) || 0.8,
                        confidenceScore: 0.85,
                        externalUrl: item.url,
                        attribution: 'AlphaV',
                        region: 'Global',
                        topicTags: item.topics?.map((t: any) => t.topic) || ['General'],
                        implicationCategory: 'General',
                        briefingSummary: `${item.title.substring(0, 100)}... | Sentiment: ${item.overall_sentiment_label}`,
                        feedSource: 'AlphaV',
                        imageUrl: item.banner_image
                    } as NewsArticle));
                    writeCache(cacheKey, articles);
                    return articles;
                }
                return [];
            } catch (e) {
                console.warn(`[useMarketNews] Internal Proxy failed for ${source.shortLabel}`, e);
                return [];
            }
        }

        // 1. Try Supabase Proxy (Bypasses CORS, most reliable if deployed)
        try {
            const { data: proxyData, error: proxyError } = await supabase.functions.invoke('news-api-proxy', {
                body: { url: source.url }
            });

            if (!proxyError && proxyData) {
                if (proxyData.contents) {
                    const articles = parseXMLToArticles(proxyData.contents, source);
                    if (articles.length > 0) {
                        writeCache(cacheKey, articles);
                        return articles;
                    }
                } else if (Array.isArray(proxyData.items)) {
                    const articles = proxyData.items.map((item: any) => buildSignalFromArticle(item, source));
                    writeCache(cacheKey, articles);
                    return articles;
                }
            }
        } catch (e) {
            console.warn(`[useMarketNews] Supabase Proxy failed for ${source.shortLabel}`);
        }

        // 2. Try RSS2JSON (Standard RSS converter)
        try {
            const url = `${RSS2JSON_BASE}${encodeURIComponent(source.url)}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
                    const articles = data.items.map((item: any) => buildSignalFromArticle(item, source));
                    writeCache(cacheKey, articles);
                    return articles;
                }
            }
        } catch (e) {
            console.warn(`[useMarketNews] RSS2JSON failed for ${source.shortLabel}`);
        }

        // 3. Try AllOrigins Proxy (Public CORS bypass)
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(source.url)}`;
            const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
            if (response.ok) {
                const data = await response.json();
                if (data.contents) {
                    const articles = parseXMLToArticles(data.contents, source);
                    if (articles.length > 0) {
                        writeCache(cacheKey, articles);
                        return articles;
                    }
                }
            }
        } catch (e) {
            console.warn(`[useMarketNews] AllOrigins failed for ${source.shortLabel}`);
        }

        // 4. Try CorsProxy.io (Alternative public proxy)
        try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(source.url)}`;
            const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
            if (response.ok) {
                const xml = await response.text();
                const articles = parseXMLToArticles(xml, source);
                if (articles.length > 0) {
                    writeCache(cacheKey, articles);
                    return articles;
                }
            }
        } catch (e) {
            console.warn(`[useMarketNews] CorsProxy.io failed for ${source.shortLabel}`);
        }

        throw new Error(`All fetch methods failed for ${source.shortLabel}`);


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
            // Fetch all sources in parallel
            const results = await Promise.allSettled(
                NEWS_SOURCES.map(src => fetchFromSource(src))
            );

            const collected: NewsArticle[] = [];
            let anySuccess = false;
            let anyFromCache = false;

            results.forEach((result, i) => {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    const cached = readCache(NEWS_SOURCES[i].shortLabel);
                    if (cached && cached.age > (NEWS_SOURCES[i].cacheTTL || CACHE_TTL_MS)) anyFromCache = true;
                    else anySuccess = true;
                    collected.push(...result.value);
                }
            });

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
                validationStatus: validation.status,
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

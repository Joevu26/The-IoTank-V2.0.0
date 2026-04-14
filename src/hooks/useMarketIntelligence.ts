import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { MarketSignal, SupplyRisk, RegulatoryNotice, MarketData } from '@/types';
import { NewsService } from '@/services/NewsService';

export const useMarketIntelligence = (stationId: string) => {
    // Cache key for news feed
    const MI_CACHE_KEY_SIGNALS = 'mi_cache_signals';

    const [signals, setSignals] = useState<MarketSignal[]>(() => {
        try {
            const cached = localStorage.getItem(MI_CACHE_KEY_SIGNALS);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [risks, setRisks] = useState<SupplyRisk[]>([]);
    const [notices, setNotices] = useState<RegulatoryNotice[]>([]);
    const [prices, setPrices] = useState<MarketData[]>([]);

    const [loading, setLoading] = useState<boolean>(() => {
        try {
            return !localStorage.getItem(MI_CACHE_KEY_SIGNALS);
        } catch {
            return true;
        }
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refetch = async () => {
        setRefreshTrigger(prev => prev + 1);
        setLoading(true);
        return new Promise<void>(resolve => setTimeout(resolve, 500));
    };

    // ── Real-time Listener ──
    useEffect(() => {
        const handleNewSignal = (e: any) => {
            const newSignal = e.detail;
            setSignals(prev => {
                const alreadyExists = prev.some(s => s.id === newSignal.id);
                if (alreadyExists) return prev;
                const updated = [newSignal, ...prev].slice(0, 50); // Keep last 50
                try {
                    localStorage.setItem(MI_CACHE_KEY_SIGNALS, JSON.stringify(updated));
                } catch (err) { console.warn('Cache update failed', err); }
                return updated;
            });
        };

        window.addEventListener('market-news-update', handleNewSignal);
        NewsService.startListening();

        return () => {
            window.removeEventListener('market-news-update', handleNewSignal);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (signals.length === 0) setLoading(true);

        const fetchData = async () => {
            try {
                // 1. Fetch Historical News (Market News)
                const historicalNews = await NewsService.fetchRecentNews(20);

                // 2. Fetch Prices
                const { data: priceData, error: priceError } = await supabase
                    .from('market_prices')
                    .select('*')
                    .order('effective_date', { ascending: false })
                    .limit(10);
                
                if (priceError) throw priceError;
                const mappedPricesValue = (priceData || []).map((p: any) => ({
                    id: p.id,
                    fuelType: p.fuel_type.toUpperCase(),
                    pricePerLiter: Number(p.price_per_liter),
                    currency: p.currency,
                    timestamp: new Date(p.effective_date).getTime(),
                    source: p.source as any
                } as MarketData));

                // 3. Fetch Signals (AI / External)
                const { data: signalData, error: signalError } = await supabase
                    .from('market_signals')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .limit(20);
                
                if (signalError) throw signalError;
                const mappedSignalsValue = (signalData || []).map((s: any) => ({
                    id: s.id,
                    type: s.type,
                    source: s.source,
                    sourceType: s.source_type,
                    title: s.title,
                    summary: s.summary,
                    timestamp: s.timestamp,
                    relevanceScore: s.relevance_score,
                    confidenceScore: s.confidence_score,
                    externalUrl: s.external_url,
                    attribution: s.attribution
                } as MarketSignal));

                // Merge Both Sources, Sort by Timestamp
                const mergedSignals = [...historicalNews, ...mappedSignalsValue]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 30);

                // 4. Fetch Risks
                const { data: riskData, error: riskError } = await supabase
                    .from('supply_risks')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .limit(10);
                
                if (riskError) throw riskError;
                const mappedRisksValue = (riskData || []).map((r: any) => ({
                    id: r.id,
                    category: r.category,
                    severity: r.severity,
                    message: r.message,
                    affectedRegions: r.affected_regions,
                    timestamp: r.timestamp,
                    source: r.source
                } as SupplyRisk));

                // 5. Fetch Notices
                const { data: noticeData, error: noticeError } = await supabase
                    .from('regulatory_notices')
                    .select('*')
                    .order('effective_date', { ascending: false })
                    .limit(10);
                
                if (noticeError) throw noticeError;
                const mappedNoticesValue = (noticeData || []).map((n: any) => ({
                    id: n.id,
                    authority: n.authority,
                    noticeType: n.notice_type,
                    title: n.title,
                    effectiveDate: n.effective_date,
                    summary: n.summary,
                    documentUrl: n.document_url
                } as RegulatoryNotice));

                if (isMounted) {
                    setPrices(mappedPricesValue);
                    setSignals(mergedSignals);
                    try {
                        localStorage.setItem(MI_CACHE_KEY_SIGNALS, JSON.stringify(mergedSignals));
                    } catch (e) {
                        console.warn('Failed to cache signals', e);
                    }
                    setRisks(mappedRisksValue);
                    setNotices(mappedNoticesValue);
                    setLoading(false);
                }
            } catch (err: unknown) {
                console.warn('MarketIntelligence: Fetch Error:', err);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        const timer = setTimeout(() => {
            if (isMounted && loading) {
                setLoading(false);
            }
        }, 5000);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [stationId, refreshTrigger]);

    return { signals, risks, notices, prices, loading, refetch };
};

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { MarketSignal, SupplyRisk, RegulatoryNotice, MarketData } from '@/types';

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

    useEffect(() => {
        let isMounted = true;
        if (signals.length === 0) setLoading(true);

        // Supabase fetch for signals, risks, notices, and prices
        const fetchData = async () => {
            try {
                // Fetch Prices
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

                // Fetch Signals
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

                // Fetch Risks
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

                // Fetch Notices
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
                    setSignals(mappedSignalsValue);
                    try {
                        localStorage.setItem(MI_CACHE_KEY_SIGNALS, JSON.stringify(mappedSignalsValue));
                    } catch (e) {
                        console.warn('Failed to cache signals', e);
                    }
                    setRisks(mappedRisksValue);
                    setNotices(mappedNoticesValue);
                    setLoading(false);
                }
            } catch (err: unknown) {
                console.warn('Supabase Fetch Error:', err);
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        
        // Safety timeout to prevent infinite white screen
        const timer = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('MarketIntelligence: Loading timed out, forcing resolution');
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

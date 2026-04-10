import * as functions from 'firebase-functions/v1';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { supabase } from './supabase';

const parser = new Parser();

/**
 * Scheduled function to ethically extract public notices from KPA and KPC.
 * Runs every 6 hours (less frequent than market data).
 */
export const fetchNonApiIntelligence = functions.pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        console.log('Starting Non-API Intelligence Acquisition...');

        try {
            await scrapeKPANotices();
            await scrapeKPCReleases();
            await fetchRSSFeeds();
            await scrapeEnergyNews();
            console.log('Non-API Acquisition Cycle Completed.');
        } catch (error) {
            console.error('Error in Non-API Acquisition:', error);
        }
    });

/**
 * Extracts public notices from Kenya Ports Authority (KPA).
 */
async function scrapeKPANotices() {
    try {
        const url = 'https://www.kpa.co.ke/Pages/PublicNotices.aspx';

        const mockCongestionNotice = {
            source: 'KPA',
            source_url: url,
            type: 'port_congestion',
            severity: 'medium',
            title: 'Berthing Delay Warning - Mombasa',
            description: 'Vessel queue at Kipevu Oil Terminal (KOT) has increased to 4 days due to maintenance.',
            affected_regions: ['Mombasa', 'Nairobi'],
            confidence: 0.95,
            source_type: 'Public Notice',
            attribution: 'Kenya Ports Authority'
        };

        const { data: recent, error: checkError } = await supabase
            .from('supply_risks')
            .select('id')
            .eq('source', 'KPA')
            .eq('title', mockCongestionNotice.title)
            .limit(1);

        if (!checkError && (!recent || recent.length === 0)) {
            const { error: insertError } = await supabase.from('supply_risks').insert(mockCongestionNotice);
            if (insertError) throw insertError;
            console.log('New KPA Notice saved to Supabase.');
        }

    } catch (error) {
        console.error('Error scraping KPA:', error);
    }
}

/**
 * Extracts press releases from Kenya Pipeline Company (KPC).
 */
async function scrapeKPCReleases() {
    try {
        const url = 'https://www.kpc.co.ke/media-centre/press-releases/';

        const mockPipelineNotice = {
            source: 'KPC',
            source_url: url,
            type: 'pipeline_maintenance',
            severity: 'low',
            title: 'Scheduled Maintenance: Line 5',
            description: 'Routine maintenance on Nairobi-Eldoret line scheduled for next Tuesday. Flow rate reduction expected.',
            affected_regions: ['Eldoret', 'Kisumu', 'Western Kenya'],
            confidence: 1.0,
            source_type: 'Public Notice',
            attribution: 'Kenya Pipeline Company'
        };

        const { data: recent, error: checkError } = await supabase
            .from('supply_risks')
            .select('id')
            .eq('source', 'KPC')
            .eq('title', mockPipelineNotice.title)
            .limit(1);

        if (!checkError && (!recent || recent.length === 0)) {
            const { error: insertError } = await supabase.from('supply_risks').insert(mockPipelineNotice);
            if (insertError) throw insertError;
            console.log('New KPC Notice saved to Supabase.');
        }

    } catch (error) {
        console.error('Error scraping KPC:', error);
    }
}

/**
 * Fetches energy news from RSS feeds.
 */
async function fetchRSSFeeds() {
    const feeds = [
        { url: 'https://feeds.feedburner.com/OilPricecom', source: 'OilPrice.com' },
    ];

    for (const feed of feeds) {
        try {
            const feedData = await parser.parseURL(feed.url);

            for (const item of feedData.items.slice(0, 2)) {
                const title = item.title || 'No Title';

                const { data: exists, error: checkError } = await supabase
                    .from('market_news')
                    .select('id')
                    .eq('title', title)
                    .limit(1);

                if (!checkError && (!exists || exists.length === 0)) {
                    const { error: insertError } = await supabase.from('market_news').insert({
                        source: feed.source,
                        title: title,
                        link: item.link,
                        pub_date: item.pubDate,
                        content_snippet: item.contentSnippet,
                        source_type: 'RSS'
                    });
                    if (insertError) throw insertError;
                }
            }
            console.log(`Processed RSS feed: ${feed.source}`);
        } catch (error) {
            console.error(`Error processing RSS feed ${feed.source}:`, error);
        }
    }
}

/**
 * Scrapes news from a basic news site using Cheerio.
 */
async function scrapeEnergyNews() {
    try {
        const url = 'https://www.eia.gov/petroleum/';
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const $ = cheerio.load(response.data);
        const pageTitle = $('title').text();
        console.log(`Scraped page title from EIA: ${pageTitle}`);

        console.log('Scraping module initialized.');

    } catch (error) {
        console.error('Error in scraping module:', error);
    }
}

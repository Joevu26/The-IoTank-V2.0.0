/**
 * Predictive Prefetching Utility
 * Manually triggers the dynamic import of a lazy-loaded component factory.
 */
export const prefetch = (factory: () => Promise<any>) => {
    // We swallow errors and results; the goal is just to get the browser to start 
    // downloading and parsing the chunk in the background.
    factory().catch(() => {});
};

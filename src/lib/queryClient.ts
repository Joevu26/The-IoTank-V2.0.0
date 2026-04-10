import { QueryClient } from '@tanstack/react-query';

/**
 * Global Query Client for IoTank SaaS.
 * Configured with aggressive but safe caching defaults.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute by default.
      // Dynamic telemetry will override this with staleTime: 0.
      staleTime: 60 * 1000, 
      
      // Keep inactive queries in cache for 10 minutes.
      gcTime: 10 * 60 * 1000, 
      
      // Retry failed requests once.
      retry: 1,
      
      // Don't refetch on window focus to avoid redundant Supabase hits.
      refetchOnWindowFocus: false,
    },
  },
});

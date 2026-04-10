import React from 'react';
import { useLatestReading } from '@/hooks/useSupabase';
import { Tank, TankReading } from '@/types';

/**
 * Helper component to fetch latest reading for a tank
 * This is needed because hooks can't be called conditionally or in loops
 */
interface TankReadingFetcherProps {
    tank: Tank;
    orgId: string;
    onReadingFetched: (tankId: string, reading: TankReading | null) => void;
}

export const TankReadingFetcher: React.FC<TankReadingFetcherProps> = ({ tank, orgId, onReadingFetched }) => {
    const { reading } = useLatestReading(orgId, tank.id);

    // Call the callback whenever reading changes
    React.useEffect(() => {
        onReadingFetched(tank.id, reading);
    }, [reading, tank.id, onReadingFetched]);

    return null; // This component doesn't render anything
};

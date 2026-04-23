/**
 * Linear Regression: Time-aware Slope Calculation (L/hr)
 */
export function calculateTimeBasedSlope(points: { x: number; y: number }[]): number {
    const n = points.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    // Normalize X to hours from the first point to prevent large number overflow
    const startTime = points[0].x;
    
    for (const p of points) {
        const x = (p.x - startTime) / (1000 * 60 * 60); // Convert ms to hours
        const y = p.y;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
}

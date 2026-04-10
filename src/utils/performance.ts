/**
 * Performance Utilities for High-Scale IoT Telemetry
 * Implements LTTB Downsampling and Sliding Window optimizations
 */

export interface Point {
    x: number;
    y: number;
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm
 * Reduces the number of points in a dataset while preserving its visual characteristics (spikes/refills).
 * @param data The array of points to downsample [{x, y}]
 * @param threshold The target number of points (usually equivalent to pixel width of chart)
 */
export function downsampleLTTB(data: Point[], threshold: number): Point[] {
    const dataLength = data.length;
    if (threshold >= dataLength || threshold === 0) {
        return data; // No downsampling needed
    }

    const sampled: Point[] = [];
    let sampledIndex = 0;

    // Bucket size. Leave room for start and end points
    const bucketSize = (dataLength - 2) / (threshold - 2);

    let a = 0; // Initially a is the first point in the triangle
    let maxAreaPoint: Point = data[0];
    let maxArea: number;
    let area: number;
    let nextA: number = 0;

    sampled[sampledIndex++] = data[a]; // Always add the first point

    for (let i = 0; i < threshold - 2; i++) {
        // Calculate point average for next bucket (higher bucket boundary)
        let avgX = 0;
        let avgY = 0;
        let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
        let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
        avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

        const avgRangeLength = avgRangeEnd - avgRangeStart;

        for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
            avgX += data[avgRangeStart].x;
            avgY += data[avgRangeStart].y;
        }
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;

        // Get the range for this bucket
        let rangeOffs = Math.floor((i + 0) * bucketSize) + 1;
        const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

        // Point a
        const pointAx = data[a].x;
        const pointAy = data[a].y;

        maxArea = area = -1;

        for (; rangeOffs < rangeTo; rangeOffs++) {
            // Calculate triangle area over three buckets
            area = Math.abs((pointAx - avgX) * (data[rangeOffs].y - pointAy) -
                (pointAx - data[rangeOffs].x) * (avgY - pointAy)
            ) * 0.5;

            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = data[rangeOffs];
                nextA = rangeOffs; // Next a is this secondary point
            }
        }

        sampled[sampledIndex++] = maxAreaPoint; // Pick the highest visual impact point
        a = nextA; // This becomes the next 'a'
    }

    sampled[sampledIndex++] = data[dataLength - 1]; // Always add the last point

    return sampled;
}

/**
 * Sliding Window Pruning
 * Removes points from a dataset that are older than the specified duration.
 * @param data Array of items with timestamps
 * @param durationMs The duration to keep (e.g., 30 * 60 * 1000 for 30 minutes)
 * @param timestampKey The key containing the timestamp (default 'timestamp')
 */
export function pruneSlidingWindow<T>(
    data: T[],
    durationMs: number,
    timestampKey: keyof T = 'timestamp' as keyof T
): T[] {
    const now = Date.now();
    const cutoff = now - durationMs;
    
    // Find the first index that is within the window
    const firstValidIndex = data.findIndex(item => (item[timestampKey] as unknown as number) >= cutoff);
    
    if (firstValidIndex === -1) return []; // All points are old
    if (firstValidIndex === 0) return data; // All points are fresh
    
    return data.slice(firstValidIndex);
}

/**
 * Convert an Image File/Blob to WebP format using Canvas API
 * @param file The source image file
 * @param quality Quality from 0 to 1 (default 0.8)
 */
export async function convertToWebP(file: File | Blob, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas to WebP conversion failed'));
                    }
                }, 'image/webp', quality);
            };
            img.onerror = () => reject(new Error('Failed to load image for conversion'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Throttled execution for high-frequency telemetry parsers
 */
export function throttle(func: Function, limit: number) {
    let inThrottle: boolean;
    return function(this: any, ...args: any[]) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

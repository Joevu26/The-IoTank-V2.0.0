/**
 * Formatting Utilities for IoTank Fuel Intelligence Hub
 * These are purely for display and contain no physics calculations.
 */

/**
 * Convert Celsius to Fahrenheit
 * @param celsius - Temperature in Celsius
 * @returns Temperature in Fahrenheit
 */
export function celsiusToFahrenheit(celsius: number): number {
    return Number(((celsius * 9 / 5) + 32).toFixed(1));
}

/**
 * Convert liters to gallons (US)
 * @param liters - Volume in liters
 * @returns Volume in US gallons
 */
export function litersToGallons(liters: number): number {
    return Number((liters * 0.264172).toFixed(2));
}

/**
 * Format volume with appropriate unit
 * @param liters - Volume in liters
 * @param unit - Desired unit ('liters' or 'gallons')
 * @param includeUnit - Whether to append unit label
 * @returns Formatted string
 */
export function formatVolume(
    liters: number,
    unit: 'liters' | 'gallons' = 'liters',
    includeUnit: boolean = true
): string {
    const value = unit === 'gallons' ? litersToGallons(liters) : liters;
    const unitLabel = unit === 'gallons' ? 'gal' : 'L';
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    return includeUnit ? `${formatted} ${unitLabel}` : formatted;
}

/**
 * Format temperature with appropriate unit
 * @param celsius - Temperature in Celsius
 * @param unit - Desired unit ('celsius' or 'fahrenheit')
 * @param includeSymbol - Whether to append unit symbol
 * @returns Formatted string
 */
export function formatTemperature(
    celsius: number,
    unit: 'celsius' | 'fahrenheit' = 'celsius',
    includeSymbol: boolean = true
): string {
    const value = unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius;
    const symbol = unit === 'fahrenheit' ? '°F' : '°C';
    const formatted = value.toFixed(1);

    return includeSymbol ? `${formatted}${symbol}` : formatted;
}

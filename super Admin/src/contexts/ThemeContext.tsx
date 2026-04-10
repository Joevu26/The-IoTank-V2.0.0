import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ThemeMode, ColorBlindMode } from '@shared/types';

interface ThemeContextType {
    theme: ThemeMode;
    colorBlindMode: ColorBlindMode;
    setTheme: (theme: ThemeMode) => void;
    setColorBlindMode: (mode: ColorBlindMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    // Initialize theme to light mode only (Dark mode disabled for presentation)
    const [theme, setThemeState] = useState<ThemeMode>('light');

    const [colorBlindMode, setColorBlindModeState] = useState<ColorBlindMode>(() => {
        const stored = localStorage.getItem('iotank-colorblind-mode');
        return (stored as ColorBlindMode) || 'none';
    });

    // Apply theme to document root (Force light)
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('iotank-theme', 'light');
    }, [theme]);

    // Apply colorblind mode
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-colorblind', colorBlindMode);
        localStorage.setItem('iotank-colorblind-mode', colorBlindMode);
    }, [colorBlindMode]);

    const setTheme = (newTheme: ThemeMode) => {
        setThemeState(newTheme);
        localStorage.setItem('iotank-theme-manual', 'true');
    };

    const setColorBlindMode = (mode: ColorBlindMode) => {
        setColorBlindModeState(mode);
    };

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    const value: ThemeContextType = {
        theme,
        colorBlindMode,
        setTheme,
        setColorBlindMode,
        toggleTheme,
    };

    return (<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>) as any;
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

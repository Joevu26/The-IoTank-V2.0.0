/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { DEFAULT_TEMPERATURE_THRESHOLDS, TemperatureThresholds } from '@/utils/temperatureSafety';

export interface GeminiConfig {
    apiKey: string;
    endpoint: string;
}

export interface GroqConfig {
    apiKey: string;
}

export interface DeepSeekConfig {
    apiKey: string;
}

export interface MarketConfig {
    newsApiKey: string;
    eiaApiKey: string;
    alphaVantageApiKey: string;
    exchangeRateApiKey: string;
}

export interface TemperatureConfig {
    thresholds: Record<string, TemperatureThresholds>;
}

interface ConfigContextType {
    geminiConfig: GeminiConfig | null;
    groqConfig: GroqConfig | null;
    deepSeekConfig: DeepSeekConfig | null;
    marketConfig: MarketConfig | null;
    temperatureConfig: TemperatureConfig;
    updateGeminiConfig: (config: GeminiConfig) => void;
    updateGroqConfig: (config: GroqConfig) => void;
    updateDeepSeekConfig: (config: DeepSeekConfig) => void;
    updateMarketConfig: (config: MarketConfig) => void;
    updateTemperatureConfig: (config: TemperatureConfig) => void;
    resetConfigs: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
    GEMINI: 'iotank_gemini_config',
    GROQ: 'iotank_groq_config',
    DEEPSEEK: 'iotank_deepseek_config',
    MARKET: 'iotank_market_config',
    TEMPERATURE: 'iotank_temperature_config'
};

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [geminiConfig, setGeminiConfig] = useState<GeminiConfig | null>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.GEMINI);
        return saved ? JSON.parse(saved) : null;
    });

    const [groqConfig, setGroqConfig] = useState<GroqConfig | null>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.GROQ);
        return saved ? JSON.parse(saved) : { apiKey: '' };
    });

    const [deepSeekConfig, setDeepSeekConfig] = useState<DeepSeekConfig | null>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.DEEPSEEK);
        return saved ? JSON.parse(saved) : { apiKey: '' };
    });

    const [marketConfig, setMarketConfig] = useState<MarketConfig | null>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.MARKET);
        if (saved) return JSON.parse(saved);

        // Environment Defaults
        return {
            newsApiKey: '',
            eiaApiKey: '',
            alphaVantageApiKey: '',
            exchangeRateApiKey: ''
        };
    });

    const [temperatureConfig, setTemperatureConfig] = useState<TemperatureConfig>(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.TEMPERATURE);
        if (saved) return JSON.parse(saved);

        return {
            thresholds: DEFAULT_TEMPERATURE_THRESHOLDS
        };
    });

    const updateGeminiConfig = (config: GeminiConfig) => {
        setGeminiConfig(config);
        localStorage.setItem(LOCAL_STORAGE_KEYS.GEMINI, JSON.stringify(config));
    };

    const updateGroqConfig = (config: GroqConfig) => {
        setGroqConfig(config);
        localStorage.setItem(LOCAL_STORAGE_KEYS.GROQ, JSON.stringify(config));
    };

    const updateDeepSeekConfig = (config: DeepSeekConfig) => {
        setDeepSeekConfig(config);
        localStorage.setItem(LOCAL_STORAGE_KEYS.DEEPSEEK, JSON.stringify(config));
    };

    const updateMarketConfig = (config: MarketConfig) => {
        setMarketConfig(config);
        localStorage.setItem(LOCAL_STORAGE_KEYS.MARKET, JSON.stringify(config));
    };

    const updateTemperatureConfig = (config: TemperatureConfig) => {
        setTemperatureConfig(config);
        localStorage.setItem(LOCAL_STORAGE_KEYS.TEMPERATURE, JSON.stringify(config));
    };

    const resetConfigs = () => {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.GEMINI);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.GROQ);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.DEEPSEEK);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.MARKET);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.TEMPERATURE);
        setGeminiConfig(null);
        setGroqConfig(null);
        setDeepSeekConfig(null);
        setMarketConfig(null);
        setTemperatureConfig({ thresholds: DEFAULT_TEMPERATURE_THRESHOLDS });
        window.location.reload();
    };

    return (
        <ConfigContext.Provider value={{
            geminiConfig,
            groqConfig,
            deepSeekConfig,
            marketConfig,
            temperatureConfig,
            updateGeminiConfig,
            updateGroqConfig,
            updateDeepSeekConfig,
            updateMarketConfig,
            updateTemperatureConfig,
            resetConfigs
        }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};

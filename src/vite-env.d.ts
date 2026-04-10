/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_ENDPOINT: string
    readonly VITE_MARKET_DATA_ENDPOINT: string
    readonly VITE_APP_NAME: string
    readonly VITE_APP_VERSION: string
    readonly VITE_DEFAULT_LOCALE: string
    readonly VITE_ENABLE_ANALYTICS: string
    readonly VITE_ENABLE_3D_MODELS: string
    readonly VITE_ENABLE_AR_MODE: string
    readonly VITE_ENABLE_VOICE_CONTROL: string
    readonly VITE_ENABLE_COLLABORATION: string
    readonly VITE_ENABLE_DEBUG_TOOLS: string
    readonly VITE_ENABLE_GOVERNANCE_CONSOLE: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

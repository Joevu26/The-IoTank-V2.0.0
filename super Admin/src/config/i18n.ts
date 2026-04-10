import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            "dashboard": "Dashboard",
            "inventory": "Inventory",
            "analytics": "Analytics",
            "market": "Market Intelligence",
            "reporting": "Reports",
            "governance": "AI Governance",
            "history": "Event Log",
            "settings": "Settings",
            "help": "Support",
            "alerts": "Alerts",
            "primary_storage": "Primary Storage Monitor",
            "live_inventory": "Live Inventory Hub",
            "scanning": "Scanning for telemetry signals...",
            "procurement_strategy": "Procurement Strategy",
            "acknowledged": "Acknowledged",
            "dismiss": "Dismiss",
            "system_configuration": "System Configuration",
            "system_version": "System version"
        }
    },
    es: {
        translation: {
            "dashboard": "Panel de Control",
            "inventory": "Inventario",
            "analytics": "Analítica",
            "market": "Inteligencia de Mercado",
            "reporting": "Informes",
            "governance": "Gobernanza de IA",
            "history": "Registro de Eventos",
            "settings": "Configuración",
            "help": "Soporte",
            "alerts": "Alertas",
            "primary_storage": "Monitor de Almacenamiento Primario",
            "live_inventory": "Centro de Inventario en Vivo",
            "scanning": "Escaneando señales de telemetría...",
            "procurement_strategy": "Estrategia de Adquisición",
            "acknowledged": "Reconocido",
            "dismiss": "Descartar",
            "system_configuration": "Configuración del Sistema",
            "system_version": "Versión del sistema"
        }
    }
}

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "en",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;

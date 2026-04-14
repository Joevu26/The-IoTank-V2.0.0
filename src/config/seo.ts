// src/config/seo.ts

export const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "IoTank",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "KES"
  },
  "description": "AI-powered fuel monitoring and procurement intelligence platform for fuel stations in Kenya.",
  "provider": {
    "@type": "Organization",
    "name": "Joe Engineering Ltd",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "KE"
    }
  }
};

export const seoDefaults = {
  title: "IoTank | AI Fuel Monitoring System & Petrol Station Analytics Kenya",
  description: "IoTank is Kenya's leading AI-powered fuel monitoring system for fuel stations and fleet depots. Features real-time underground tank monitoring, precision leak detection, EPRA-compliant reporting, and intelligent fuel procurement analytics.",
  keywords: "fuel monitoring system Kenya, fuel tank monitoring Kenya, EPRA compliance software, fuel theft detection Kenya, AI fuel procurement, petrol station inventory management",
  author: "Joe Engineering Ltd",
  themeColor: "#00D4FF"
};

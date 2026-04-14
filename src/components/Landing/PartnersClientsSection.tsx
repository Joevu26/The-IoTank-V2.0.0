import React from 'react';
import './PartnersClientsSection.css';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

// Import All Local Logo Assets
import logoDupont from '@/assets/logo-dupont.png';
import logoMaxim from '@/assets/logo-maxim.png';
import logoEspressif from '@/assets/logo-espressif.png';
import logoArkema from '@/assets/logo-arkema.png';
import logoGoogleCloud from '@/assets/logo-google-cloud.png';

import logoGithub from '@/assets/logo-github.png';
import logoTwilio from '@/assets/logo-twilio.png';
import logoOpis from '@/assets/logo-opis.png';
import logoRubis from '@/assets/logo-rubis.png';
import logoTotal from '@/assets/logo-total.png';
import logoBloomberg from '@/assets/logo-bloomberg.png';
import logoEpra from '@/assets/logo-epra.png';
import logoOla from '@/assets/logo-ola.png';
import logoTiRefined from '@/assets/logo-ti-refined.png';
import logoSupabase from '@/assets/logo-supabase.png';

import { 
    FiDroplet, 
    FiTruck, 
    FiWifi, 
    FiPlusSquare, 
    FiTool, 
    FiAnchor
} from 'react-icons/fi';

/* 
  VERSION: 2.0.7 - High-Fidelity Modernization
*/

const PartnersClientsSection: React.FC = () => {

    interface Partner {
        name: string;
        logoUrl: string;
        scale?: number;
    }

    interface Industry {
        title: string;
        tagline: string;
        icon: React.ReactNode;
        theme: string;
    }

    const { elementRef: partnersRef, isVisible: partnersVisible } = useScrollAnimation(0.15);
    const { elementRef: industriesRef, isVisible: industriesVisible } = useScrollAnimation(0.15);

    const partners: Partner[] = [
        { name: "Espressif Systems", logoUrl: logoEspressif },
        { name: "DYP Sensors", logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAM0AAACUCAMAAAAH411kAAAAY1BMVEUAAAD////q6updXV0bGxu/v7/x8fGAgICHh4f6+vqnp6eqqqpMTEz29va8vLzf399AQEBxcXFlZWXW1tZWVlaampotLS0hISGNjY1sbGx3d3cXFxfNzc0QEBA3NzfGxsazs7MrIkTmAAAFH0lEQVR4nO2a2YKqMAyGBRUFZVEQl3Hh/Z/yqOOM5G+6eeby/y6lbZo2TZrUyYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGx7Lupna5X+2CXtVNCA61njx/7rUPsfcSvz7Q51amDum5vyyv2WWCrk0PAFBqX3XOIzCX2PmQ7P+hL6WSXJx7yrF5CpxqazO2C1zh+9Wi7X/mkPuS201htKv+wd7Kd6HTF7wfb8HtsOX/udB8mNqm7OG1uYcMm2eky6lWgVMsqGmpX37u4xt21UsWcoK82dNhkaEb9SvhYqEIbbHZ7ncEOP9iJ2Z4meJHkuFv8qDmCJkVlGlt3l9jNRRlb5YgCXWRve7qg4bemI1jjvp9/XfkmQmpSb0O1OWQx46bvcY11NxyBoUz7q8xlFyM1aRsc20LhddCC+j2hA3zKQKShzMhQ94Eu7Ycq0NYih03ms5+eV/SGZzFwg8qko1M3Cwg3Ald4HrEMdy5P8nfgOaGRbkbj9mdURvjwbZxJJFmYNrPNMLfT3oWC3JG94AKPRbqVmVymhUPsXTCqs5mEMXOw328ND1789uxQ5mBVJjPc0sUld7Zv5rCIgdr4QGfavjcH73jlzwb4lfEDOz/z9wjiCnMeuWJ0BK8VhHVNslA7Ecglsd4EY4Fr8PCOk1sIOk8fYbjfbPGRWOmgbn+kzD3Eyg0YHegBN6eb9Phb+eGyrsVSpR+NocUpuMyN7KZHJ1FdMR7nn9pIJyJAoI/+KlZjNBOHi8jYcE6gTXrDKGRRZjuMpRZ7s8XpE20asZb5Tmuzsc8PTzxiOTMXmSHVSvIqPWagNhvZ6ai1OYoDWYy9Ze9WxmZmcLrmyt5IhxmojVyCVL2ugjZCNN4+g5SZrKX/3ZnHFXKVNkwb6U911+HSxpW9KpN8MZXuw7THGcSyVZg2cjL6DUKedTiya6syenr9RK5PYpYV0M8H5tNykSq1jbSmnZykNfUqHFmJXJ8c59oZ18MwZSCHLLQ2kMpgdc1SgFm5rlZL0bTerkdsD6bxqvMy2Qqvnqtp0VQGRKPNSctWBpcyIdVBQWAd6iAMONdcGsSG0nDiVyWDrZx116svTAGBPmCyEutaak06ufSteSDNyo+jlvsgvDr4pFbCkYo8EqqDhmxlUIZGw2mNSrwkojqYxGQUcqpnpQXOVIuI6NbQUSDTGGVye9gCeuk+FPvEiaolZ9TYFx3wsuqkCM47vTHZKLgNyihGguaRahTjHJS78CT6JM8vrqlRSEpSzYbh1pXkHqkR1cEssJT2ZCePI3xV6rpzbRSs7PgSxT74ZWKI0MW4Dv3+/jXbN4XieGr1jRMLhfr96M01yKXl+S20AP1CRrH0uPjmsJqrjwd6MmdkBXqrkTY4bYMyS9uIA/PNPvRp7YVqZ6bf85XP5LU7qwqD5fSDAppRyHejPNI8MIrkvtfkhWgd+7hpJeoxynJolFuXT6zU/hx5OqwsYx6jrA/euMPe2pd06NVfVWVj3rjOVoPAkqc3h5drGJi7+IlIMwa7PWB+472/y+Y+DxjKBbNvK9nSkS8toLHvznmFof9Im8a4uCg8Fr5y3vAx3Lj/RYQ3aPWu9AnGe5Kuzs2drRh1dE9yA6e19SvfivF0aWqSpStf4oc7nPnCjXTo5w/+66SyzFykdX0uAiLbui7H3cqzT33Rvhz+QpPnPJYLB1OfxbzoF8sxh6MvVVzI5v+tBiGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQmz8A8eFRDShUgHHAAAAAElFTkSuQmCC" },
        { name: "Maxim Integrated", logoUrl: logoMaxim, scale: 1.5 },
        { name: "DuPont", logoUrl: logoDupont },
        { name: "Arkema", logoUrl: logoArkema },
        { name: "EPRA", logoUrl: logoEpra },
        { name: "OLA Energy", logoUrl: logoOla },
        { name: "Rubis", logoUrl: logoRubis },
        { name: "TotalEnergies", logoUrl: logoTotal },
        { name: "Google Cloud", logoUrl: logoGoogleCloud, scale: 1.4 },

        { name: "Bloomberg", logoUrl: logoBloomberg },
        { name: "OPIS", logoUrl: logoOpis },
        { name: "Texas Instruments", logoUrl: logoTiRefined },
        { name: "Supabase", logoUrl: logoSupabase, scale: 1.6 },
        { name: "Twilio", logoUrl: logoTwilio },
        { name: "GitHub", logoUrl: logoGithub }
    ];

    const industries: Industry[] = [
        {
            title: "Retail Fuel Stations",
            tagline: "Protect Margin. Prevent Stockouts.",
            icon: <FiDroplet />,
            theme: "cyan"
        },
        {
            title: "Fleet & Logistics Depots",
            tagline: "Control Bulk Consumption.",
            icon: <FiTruck />,
            theme: "orange"
        },
        {
            title: "Telecom & Remote Towers",
            tagline: "Zero Downtime Fuel.",
            icon: <FiWifi />,
            theme: "green"
        },
        {
            title: "Hospitals & Data Centers",
            tagline: "Backup Power Assurance.",
            icon: <FiPlusSquare />,
            theme: "red"
        },
        {
            title: "Mining & Industrial Sites",
            tagline: "Fuel in Harsh Environments.",
            icon: <FiTool />,
            theme: "indigo"
        },
        {
            title: "Maritime & Ports",
            tagline: "Supply Chain Stability.",
            icon: <FiAnchor />,
            theme: "blue"
        }
    ];

    // Duplicate partners for seamless marquee
    const marqueePartners = [...partners, ...partners];

    return (
        <section className="partners-clients-section">
            <div className="pc-container">

                {/* PARTNERS SECTION */}
                <div ref={partnersRef} className={`reveal-on-scroll ${partnersVisible ? 'is-visible' : ''}`} style={{ marginBottom: '80px' }}>
                    <div className="pc-header">
                        <div className="pc-pill ecosystem">Innovation Ecosystem</div>
                        <h2 className="pc-title">Our <span className="text-cyan">Strategic Partners</span></h2>
                        <p className="pc-subtitle">Built on world-class infrastructure and engineering standards.</p>
                    </div>

                    <div className="partners-marquee-container">
                        <div className="partners-marquee-track">
                            {marqueePartners.map((partner, index) => (
                                <div key={index} className="partner-card">
                                    <img
                                        src={partner.logoUrl}
                                        alt={partner.name}
                                        className="partner-logo"
                                        title={partner.name}
                                        style={partner.scale ? { transform: `scale(${partner.scale})` } : {}}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* TARGETED INDUSTRIES SECTION */}
                <div ref={industriesRef} className={`clients-wrapper reveal-on-scroll ${industriesVisible ? 'is-visible' : ''}`}>
                    <div className="pc-header">
                        <div className="pc-pill industries">Targeted Industries</div>
                        <h2 className="pc-title">Where Fuel Failure Is <span className="text-orange">Not an Option</span></h2>
                        <p className="pc-subtitle">High-risk environments that require real-time fuel visibility.</p>
                    </div>

                    <div className="industry-cards-grid">
                        {industries.map((ind, i) => (
                            <div key={i} className={`industry-card ${ind.theme}`}>
                                <div className="industry-card-icon-box">
                                    {ind.icon}
                                </div>
                                <h3 className="industry-card-title">{ind.title}</h3>
                                <p className="industry-card-tagline">{ind.tagline}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </section>
    );
};

export default PartnersClientsSection;

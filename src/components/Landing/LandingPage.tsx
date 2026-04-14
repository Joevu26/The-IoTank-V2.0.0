import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckCircle, FiMessageSquare, FiDroplet,
  FiTwitter, FiLinkedin, FiFacebook, FiMenu, FiX,
  FiTarget, FiThermometer, FiZap, FiCloud, FiActivity, FiLayout, FiShield,
  FiMail
} from 'react-icons/fi';

import './LandingPage.css';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

// Import Assets
import brandMark from '@/assets/iotank-logo-v3.png';
import dashboardMockup from '@/assets/dashboard-mockup.png';

const ExcellenceSection = React.lazy(() => import('./ExcellenceSection'));
const OwnershipSection = React.lazy(() => import('./OwnershipSection'));
const SecuritySection = React.lazy(() => import('./SecuritySection'));
const FAQSection = React.lazy(() => import('./FAQSection'));
const PartnersClientsSection = React.lazy(() => import('./PartnersClientsSection'));
const ComplianceOverview = React.lazy(() => import('./ComplianceOverview').then(module => ({ default: module.ComplianceOverview })));
const InteractiveDashboardSnippet = React.lazy(() => import('./InteractiveDashboardSnippet'));
const TestimonialCarousel = React.lazy(() => import('./TestimonialCarousel'));
const LeadMagnetNewsletter = React.lazy(() => import('./LeadMagnetNewsletter'));

import { DocViewer } from './DocViewer';
import { LiveChat } from './LiveChat';
import {
    LossCalculatorModal,
    CrisisIntro,
    ProfitKillers,
    DecisionPaths,
    SocialProofBar
} from './FuelChallengesSection';


export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLossCalcOpen, setIsLossCalcOpen] = useState(false); // Renamed state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Scroll Animations
  const { elementRef: problemRef, isVisible: problemVisible } = useScrollAnimation();
  const { elementRef: excellenceRef, isVisible: excellenceVisible } = useScrollAnimation();
  const { elementRef: solutionRef, isVisible: solutionVisible } = useScrollAnimation();
  const { elementRef: testimonialRef, isVisible: testimonialVisible } = useScrollAnimation();
  const { elementRef: dashboardSimRef, isVisible: dashboardSimVisible } = useScrollAnimation();
  const { elementRef: newsletterRef, isVisible: newsletterVisible } = useScrollAnimation();
  const { elementRef: finalCTARef, isVisible: finalCTAVisible } = useScrollAnimation();

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videos: string[] = [
    'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-network-of-data-42750-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-data-center-server-room-9932-large.mp4'
  ];


  const videoRef = useRef<HTMLVideoElement>(null);
  const handleVideoEnded = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
  };

  const handleRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Optimized Video Playback Observer
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoElement.play().catch(err => {
            console.warn("Video play interrupted or failed:", err);
          });
        } else {
          videoElement.pause();
        }
      },
      { threshold: 0.1 } // Play when at least 10% is visible
    );

    observer.observe(videoElement);
    return () => observer.disconnect();
  }, [currentVideoIndex]);

  useEffect(() => {
    const updateHandlePosition = () => {
      if (!handleRef.current) return;
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;

      if (scrollHeight > 0) {
        const progress = scrollY / scrollHeight;
        const top = progress * (window.innerHeight - 18);
        handleRef.current.style.top = `${top}px`;
      }

      const isScrolled = scrollY > 50;
      if (scrollHeight > 0) {
        setScrolled(isScrolled);
      }
      scrollRafRef.current = null;
    };

    const onScroll = () => {
      if (!scrollRafRef.current) {
        scrollRafRef.current = requestAnimationFrame(updateHandlePosition);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const trackHeight = window.innerHeight - 20;
        // Use refined delta for smoother tracking
        const deltaY = e.movementY;
        const scrollDelta = (deltaY / trackHeight) * scrollHeight;
        window.scrollBy(0, scrollDelta);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    updateHandlePosition(); // Initial position

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [isDragging, scrolled]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.userSelect = 'none';
  };

  // Parallax Effect for Hero
  const [parallaxY, setParallaxY] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      setParallaxY(window.scrollY * 0.4);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Magnetic Button Effect
  const magneticBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const btn = magneticBtnRef.current;
    if (!btn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const distance = Math.sqrt(x * x + y * y);

      if (distance < 100) {
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.05)`;
      } else {
        btn.style.transform = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Open Terms Modal on "Get Started" or "Sign Up"
  const handleGetStarted = () => {
    navigate('/login');
  };


  return (
    <div className="landing-page">
      {/* Documentation Viewer */}
      <DocViewer
        isOpen={isDocViewerOpen}
        onClose={() => setIsDocViewerOpen(false)}
      />

      {/* Global Loss Calculator Modal */}
      {isLossCalcOpen && (
        <LossCalculatorModal onClose={() => setIsLossCalcOpen(false)} />
      )}

      {/* 1. NAVBAR */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''} ${isMenuOpen ? 'menu-open' : ''}`}>
        <div className="container navbar-inner">
          <div className="brand">
            <img src={brandMark} alt="IoTank Brandmark" className="brand-logo-nav" style={{ width: 'auto', height: '38px' }} />
            <span>Joe Engineering</span>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? <FiX /> : <FiMenu />}
          </button>

          {/* Right Side Container for Tabs + Button */}
          <div className={`nav-actions-container ${isMenuOpen ? 'mobile-visible' : ''}`}>
            <div className="nav-links">
              <a href="#problem" onClick={() => setIsMenuOpen(false)}>Challenges</a>
              <a href="#solution-overview" onClick={() => setIsMenuOpen(false)}>Solution</a>
              <a href="#how-it-works" onClick={() => setIsMenuOpen(false)}>How It Works</a>
              <a href="#pricing" onClick={() => setIsMenuOpen(false)}>Pricing</a>
              <a href="#faq" onClick={() => setIsMenuOpen(false)}>FAQ</a>
            </div>
            <div className="nav-btn-container">
              <button className="btn-primary btn-gemini-glow" onClick={() => { handleGetStarted(); setIsMenuOpen(false); }}>
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <header className="hero">
        <div className="container">
          <div className="hero-content animate-fade-in text-center">
            <h1 className="hero-h1">Fuel intelligence for safer, smarter stations</h1>
          </div>


           <div className="hero-visual-inner" style={{ transform: `translateY(${parallaxY}px)` }}>
            <div className="hero-video-container">
              <video
                ref={videoRef}
                key={currentVideoIndex}
                className="hero-video-bg"
                src={videos[currentVideoIndex]}

                autoPlay
                muted
                playsInline
                preload="none"
                onEnded={handleVideoEnded}
                onError={(e) => {
                  console.error("Video failed to load:", videos[currentVideoIndex], e);
                  // Robust fallback: if current video fails, try the other one.
                  // If we've already tried all, stop to avoid infinite loops.
                  if (currentVideoIndex < videos.length - 1) {
                    handleVideoEnded();
                  }
                }}
                poster={brandMark}
                title="Modern Data Flow Animation"
                onCanPlay={(e) => (e.currentTarget.muted = true)}
              />
              <div className="hero-video-overlay">
                <h3 className="h3 text-white mb-4" style={{ textShadow: '0 2px 15px rgba(0,0,0,0.8)' }}>
                  Stop invisible fuel losses before they cost you millions.
                </h3>
                <p className="hero-overlay-p">
                  Real-time underground tank monitoring, AI-driven procurement insights, and compliance-ready reporting — engineered for high-risk fuel environments in Kenya.
                </p>
                <div className="hero-overlay-btns">
                  <button 
                    ref={magneticBtnRef}
                    className="btn-primary btn-gemini-glow" 
                    onClick={handleGetStarted}
                  >
                    Get Started
                  </button>

                  <button
                    className="btn-secondary"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(5px)' }}
                    onClick={() => setCurrentVideoIndex(0)}
                  >
                    View Demo
                  </button>
                </div> {/* Close hero-overlay-btns */}
              </div> {/* Close hero-video-overlay */}
            </div> {/* Close hero-video-container */}
          </div> {/* Close hero-visual-inner */}

          {/* Scroll Indicator */}
          <div className="hero-scroll-indicator">
            <div className="mouse">
              <div className="wheel"></div>
            </div>
            <div>
              <span className="m_scroll_arrows first"></span>
              <span className="m_scroll_arrows second"></span>
              <span className="m_scroll_arrows third"></span>
            </div>
          </div>
        </div> {/* Close container */}
      </header>

      {/* 2. SECTION 1 — THE ECONOMIC REALITY (Chaos/Risk - Slate) */}
      <div ref={problemRef} className={`reveal-on-scroll ${problemVisible ? 'is-visible' : ''}`}>
        <section id="problem" className="section-bg-mist" style={{ paddingTop: '40px', paddingBottom: '16px' }}>
          <div className="container">
            <CrisisIntro onShowCalculator={() => setIsLossCalcOpen(true)} />

            <div style={{ marginTop: '16px' }}>
              <OwnershipSection />
            </div>
          </div>
        </section>
      </div>

      {/* 3. SECTION 2 — THE SOLUTION (From Guesswork to Precision) */}
      <section id="solution-overview" className="section section-bg-white-to-solution">
        <div className="container">
          {/* Header */}
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <div className="solution-pill" style={{ marginBottom: '12px' }}>THE SOLUTION</div>
            <h2 className="h2 solution-heading" style={{ marginBottom: '8px' }}>From Guesswork to <span className="text-cyan">Precision</span></h2>
          </div>

          {/* Image + Text + Grid split */}
          <div className="solution-split-layout">
            {/* Left: Dashboard Image */}
            <div className="solution-image-side">
              <img
                src={dashboardMockup}
                alt="IoTank Intelligence Dashboard"
                className="solution-mockup-img"
                loading="eager"
              />
            </div>

            {/* Right: Text + Feature Grid */}
            <div className="solution-content-side">
              <p className="body-text" style={{ marginBottom: '10px' }}>
                IoTank replaces manual dipping and fragmented reporting with a continuous intelligence system.
              </p>
              <p className="body-text" style={{ marginBottom: '28px' }}>
                Instead of reacting after losses happen, you get real-time tank levels (±1mm precision), temperature-corrected volume, and AI procurement timing signals.
              </p>

              <div className="solution-feature-grid">
                <div className="solution-feature-card precision">
                  <div className="feature-icon"><FiTarget /></div>
                  <span className="feature-label">±1mm Precision</span>
                </div>
                <div className="solution-feature-card temp">
                  <div className="feature-icon"><FiThermometer /></div>
                  <span className="feature-label">Temp Correction</span>
                </div>
                <div className="solution-feature-card ai">
                  <div className="feature-icon"><FiZap /></div>
                  <span className="feature-label">AI Procurement</span>
                </div>
                <div className="solution-feature-card compliant">
                  <div className="feature-icon"><FiShield /></div>
                  <span className="feature-label">EPRA Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SECTION 3 — HOW IT WORKS (Process Flow) */}
      <section id="how-it-works" className="section section-bg-offwhite-to-white">
        <div className="container">
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <div className="solution-pill" style={{ background: 'rgba(0, 181, 216, 0.1)', border: '1px solid rgba(0, 181, 216, 0.2)', marginBottom: '12px' }}>HOW IT WORKS</div>
            <h2 className="h2 solution-heading" style={{ marginBottom: '8px' }}>From <span className="text-cyan">Sensor to Strategy</span></h2>
            <p className="body-text" style={{ color: '#94A3B8' }}>No spreadsheets. No assumptions. No surprises.</p>
          </div>

          <div className="process-grid-modern">
            {/* Step 1 */}
            <div className="process-step-card">
              <div className="step-icon-frame"><FiDroplet /></div>
              <div className="step-meta">STEP 1</div>
               <h3 className="step-title-bold">Tank Sensors</h3>
               <p className="step-description-text">Industrial ultrasonic sensors capture fuel level and temperature in real time.</p>
               <a href="#hardware" className="step-link-modern">View Hardware →</a>
            </div>

            <div className="step-connector"></div>

            {/* Step 2 */}
            <div className="process-step-card">
              <div className="step-icon-frame"><FiCloud /></div>
              <div className="step-meta">STEP 2</div>
               <h3 className="step-title-bold">Secure Cloud</h3>
               <p className="step-description-text">Encrypted synchronization via our secure cloud infrastructure ensures data continuity and backup.</p>
               <a href="#security" className="step-link-modern">Security Architecture →</a>
            </div>

            <div className="step-connector"></div>

            {/* Step 3 */}
            <div className="process-step-card">
              <div className="step-icon-frame"><FiActivity /></div>
              <div className="step-meta">STEP 3</div>
               <h3 className="step-title-bold">AI Advisory</h3>
               <p className="step-description-text">Consumption patterns analyzed against market price feeds to generate buy/wait signals.</p>
               <a href="#ai" className="step-link-modern">How AI works →</a>
            </div>

            <div className="step-connector"></div>

            {/* Step 4 */}
            <div className="process-step-card">
              <div className="step-icon-frame"><FiLayout /></div>
              <div className="step-meta">STEP 4</div>
               <h3 className="step-title-bold">Actionable Dashboard</h3>
               <p className="step-description-text">Clear alerts. Compliance reports. Theft detection. Procurement guidance.</p>
               <a href="#dashboard" className="step-link-modern">See Dashboard →</a>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: INTERACTIVE DASHBOARD SIMULATION */}
      <div ref={dashboardSimRef} className={`reveal-on-scroll ${dashboardSimVisible ? 'is-visible' : ''}`}>
        <Suspense fallback={<div className="section-loader">Loading Dashboard...</div>}>
          <InteractiveDashboardSnippet />
        </Suspense>
      </div>

      {/* NEW: SECURITY SECTION INTEGRATION */}
      <Suspense fallback={<div className="section-loader">Loading Security...</div>}>
        <SecuritySection />
      </Suspense>


      {/* 5. SECTION 4 — THE SIX RISK FACTORS (Control - Deep Navy) */}

      <div ref={solutionRef} className={`reveal-on-scroll ${solutionVisible ? 'is-visible' : ''}`}>
        <section id="risks" className="section section-bg-light-gray">
          <div className="container">

            <ProfitKillers />
          </div>
        </section>
      </div>

      {/* 6. SECTION 5 — AUTHORITY & COMPLIANCE (Deep Navy to White) */}
      <div ref={excellenceRef} className={`reveal-on-scroll ${excellenceVisible ? 'is-visible' : ''}`}>
        <section className="section section-bg-dark-navy">
          <Suspense fallback={<div className="section-loader">Loading...</div>}>
            <ExcellenceSection />
          </Suspense>
        </section>
      </div>


      <section id="compliance" className="section section-bg-white">
        <div className="container">

          <div className="text-center mb-8">
            <div className="regulatory-pill">REGULATORY COMPLIANCE</div>
            <h2 className="h2 regulatory-heading">
              Built for <span className="regulatory-highlight">Regulatory &amp; Industrial</span> Environments
            </h2>
            <p className="body-text regulatory-sub">IoTank aligns with EPRA, EHS, and digital audit trail frameworks.</p>
          </div>
          <Suspense fallback={<div className="section-loader">Loading Compliance...</div>}>
            <ComplianceOverview />
          </Suspense>
        </div>
      </section>

      {/* 7. SECTION 6 — DECISION INTELLIGENCE (AI Chat) */}
      <section id="ai-intelligence" className="section ai-section-dark">
        <div className="container">

          {/* Header */}
          <div className="text-center">

            <div className="ai-pill">AI INTELLIGENCE ENGINE</div>
            <h2 className="ai-section-heading">
              Your Data, in <span className="ai-heading-cyan">Plain English</span>
            </h2>
            <p className="ai-section-sub">Ask IoTank AI anything. No training required.</p>
          </div>

          {/* Chat Terminal Card */}
          <div className="ai-terminal-card">
            {/* Terminal Title Bar */}
            <div className="ai-terminal-bar">
              <div className="ai-traffic-lights">
                <span className="tl-red"></span>
                <span className="tl-yellow"></span>
                <span className="tl-green"></span>
              </div>
              <span className="ai-terminal-title">IoTank Fuel Intelligence Hub</span>
              <span className="ai-live-dot"><span className="live-pulse"></span>Live</span>
            </div>

            {/* Chat Body */}
            <div className="ai-chat-body">
              {/* User Message */}
              <div className="ai-chat-row user-row">
                <div className="ai-bubble user-bubble">&ldquo;Should I buy today?&rdquo;</div>
              </div>

              {/* AI Response */}
              <div className="ai-chat-row ai-row">
                <div className="ai-avatar"><FiMessageSquare size={16} /></div>
                <div className="ai-bubble ai-bubble-response">
                  &ldquo;Yes. Consumption is high and EPRA price increase is projected for Sunday. Buying now saves you <span className="ai-ksh-highlight">Ksh 185,000</span>.&rdquo;
                </div>
              </div>
            </div>

            {/* Terminal Footer */}
            <div className="ai-terminal-footer">
              Powered by IoTank&apos;s Fuel Intelligence Engine &middot; Updated every 15 minutes
            </div>
          </div>
        </div>
      </section>

      {/* 8. SECTION 7 — PRICING */}
      <section id="pricing" className="section section-bg-offwhite-to-white">
        <div className="container">
          <div className="pricing-header-modern">
            <div className="pricing-pill">PRICING</div>
            <h2 className="pricing-title-modern">Simple & <span>Transparent</span></h2>
          </div>

          <div className="pricing-grid-modern">
            {/* CARD 1: PLATFORM */}
            <div className="pricing-card-modern software">
              <span className="pricing-badge-modern">SOFTWARE</span>
              <div className="pricing-label-modern">WEB PLATFORM</div>
              <h3 className="pricing-value-modern">Usage-Based</h3>
              <p className="pricing-period-modern">Billed Monthly</p>
              
              <p className="pricing-desc-modern">
                Complete dashboard, analytics, AI insights. No fixed tiers. 
                Billed based on actual monitored activity.
              </p>

              <div className="pricing-features-modern">
                <div className="pricing-feature-modern"><FiCheckCircle /> Real-time Monitoring</div>
                <div className="pricing-feature-modern"><FiCheckCircle /> AI Procurement Alerts</div>
                <div className="pricing-feature-modern"><FiCheckCircle /> Compliance Reporting</div>
              </div>

              <button className="pricing-btn-modern primary" onClick={() => window.location.href = 'mailto:iotank.com@gmail.com'}>
                Get Started
              </button>
            </div>

            {/* CARD 2: HARDWARE */}
            <div className="pricing-card-modern hardware">
              <span className="pricing-badge-modern">HARDWARE</span>
              <div className="pricing-label-modern">HARDWARE PACKAGE</div>
              <div className="hardware-price-wrap">
                <h3 className="pricing-value-modern">35k</h3>
                <span className="hardware-price-unit">Ksh</span>
              </div>
              <p className="pricing-period-modern">One-Time</p>
              
              <p className="pricing-desc-modern">
                Industrial sensors, controller, enclosure. 
                Software auto-activated.
              </p>

              <div className="pricing-features-modern">
                <div className="pricing-feature-modern"><FiCheckCircle /> Ultrasonic Precision</div>
                <div className="pricing-feature-modern"><FiCheckCircle /> Thermal Correction</div>
                <div className="pricing-feature-modern"><FiCheckCircle /> 24hr Installation</div>
              </div>

              <button className="pricing-btn-modern outline" onClick={() => window.location.href = 'mailto:iotank.com@gmail.com'}>
                Order Hardware
              </button>
            </div>
          </div>
          
           <p className="pricing-footer-note">
            Payback period: ~8 days (average site).
          </p>
        </div>
      </section>

      {/* NEW: PREMIUM TESTIMONIAL CAROUSEL */}
      <div ref={testimonialRef} className={`reveal-on-scroll ${testimonialVisible ? 'is-visible' : ''}`}>
        <Suspense fallback={<div className="section-loader">Loading Testimonials...</div>}>
          <TestimonialCarousel />
        </Suspense>
      </div>


      {/* 9. SECTION 8 — PROOF & SCALE */}
      <SocialProofBar />

      {/* 10. SECTION 9 — THE DECISION FRAME */}
      <section id="decision" className="section section-bg-white-to-offwhite">
        <div className="container">

          <DecisionPaths onGetStarted={handleGetStarted} />
        </div>
      </section>

      {/* NEW FAQ SECTION */}
      <div className="section-bg-offwhite-to-white">
        <Suspense fallback={<div className="section-loader">Loading FAQ...</div>}>
          <FAQSection />
        </Suspense>
      </div>

      {/* PARTNERS & CLIENTS */}
      <Suspense fallback={<div className="section-loader">Loading Partners...</div>}>
        <PartnersClientsSection />
      </Suspense>

      {/* NEW: LEAD MAGNET NEWSLETTER */}
      <div ref={newsletterRef} className={`reveal-on-scroll ${newsletterVisible ? 'is-visible' : ''}`}>
        <Suspense fallback={<div className="section-loader">Loading Newsletter...</div>}>
          <LeadMagnetNewsletter />
        </Suspense>
      </div>

      <div ref={finalCTARef} className={`reveal-on-scroll ${finalCTAVisible ? 'is-visible' : ''}`}>


        <section className="final-cta-modern">
          <div className="container">
            <div className="cta-pill-modern">GET STARTED TODAY</div>
            <h2 className="cta-title-modern">Start managing fuel as a <span>strategic asset</span></h2>
            <p className="cta-desc-modern">Stop guessing. Start knowing. Join the future of fuel intelligence today.</p>
            <div className="cta-actions-modern">
              <button className="btn-cta-primary" onClick={handleGetStarted}>Get Started Now</button>
              <button className="btn-cta-outline" onClick={() => setIsDocViewerOpen(true)}>View Documentation</button>
            </div>
          </div>
          <div className="cta-glow-effect"></div>
        </section>
      </div>

      <footer className="footer-landing">
        <div className="container footer-grid">
          {/* Column 1: Company (Authority Layer) */}
          <div className="footer-brand">
            <div className="brand">
              <div className="footer-logo-frame">
                <img src={brandMark} alt="IoTank Brandmark" className="footer-logo-img" />
              </div>
              <span>Joe Engineering</span>
            </div>
            <p className="footer-company-desc">Pioneering Industrial IoT & AI for the fuel energy sector in Kenya.</p>
            <p className="footer-location-text">Headquartered in Nairobi, Kenya.</p>

            <div className="footer-trust-badges">
              <span className="trust-pill shadow-soft">Registered in Kenya</span>
              <span className="trust-pill shadow-soft">Serving Retail, Fleet & Infrastructure</span>
              <span className="trust-pill shadow-soft">Nairobi | Mombasa | Nakuru</span>
            </div>
          </div>

          {/* Column 2: Platform */}
          <div>
            <h4 className="footer-title">Platform</h4>
            <ul className="footer-links">
              <li><a href="#solution-overview">IoTank System</a></li>
              <li><a href="#how-it-works">Hardware Device</a></li>
              <li><a href="#ai-intelligence">AI Engine</a></li>
              <li><a href="#pricing">Deployment & Install</a></li>
              <li><a href="#compliance">Security Architecture</a></li>
            </ul>
          </div>

          {/* Column 3: Compliance */}
          <div>
            <h4 className="footer-title">Compliance</h4>
            <ul className="footer-links">
              <li><a href="#compliance">EPRA Standards</a></li>
              <li><a href="#compliance">Environmental Monitoring</a></li>
              <li><a href="#compliance">Audit Reporting</a></li>
              <li><a href="#ai-intelligence">AI Governance</a></li>
              <li><a href="#compliance">Safety & Isolation</a></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div>
            <h4 className="footer-title">Resources</h4>
            <ul className="footer-links">
              <li><a href="#how-it-works">How It Works</a></li>
              <li><button className="link-btn" onClick={() => setIsDocViewerOpen(true)}>Technical Docs</button></li>
              <li><a href="#!">Case Studies</a></li>
              <li><button className="link-btn" onClick={() => setIsLossCalcOpen(true)}>Fuel Risk Calculator</button></li>
              <li><a href="#!">Updates</a></li>
            </ul>
          </div>

          {/* Column 5: Support */}
          <div>
            <h4 className="footer-title">Support</h4>
            <ul className="footer-links">
              <li><a href="https://wa.me/254111746901" target="_blank" rel="noopener noreferrer">WhatsApp Support</a></li>
              <li><a href="mailto:iotank.com@gmail.com">iotank.com@gmail.com</a></li>
              <li><a href="tel:+254111746901">+254 111 746 901</a></li>
              <li><a href="#!">Help Center</a></li>
              <li><a href="#!">System Status</a></li>
            </ul>
          </div>
        </div>

        <div className="container">
          <div className="footer-infrastructure-bar">
            <div className="footer-infra-left">
              <span>IoTank Platform v2.0.0</span>
              <span>Firmware Baseline v2.1.4-Stable</span>
              <span>System Uptime: 99.98%</span>
            </div>
            <div className="footer-infra-right">
              <span>Powered by Secure Cloud Infrastructure</span>
              <span>AES-256 Encryption</span>
              <span>Built for EPRA Compliance</span>
            </div>
          </div>
        </div>

        <div className="container footer-bottom">
          <div className="footer-bottom-main">
            <p>&copy; {new Date().getFullYear()} Joe Engineering Ltd. All rights reserved.</p>
            <div className="footer-social-links">
              <a href="https://x.com/josephvundi16" target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="X (Twitter) @josephvundi16"><FiTwitter /></a>
              <a href="https://www.linkedin.com/in/joseph-vundi-engineering" target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="LinkedIn"><FiLinkedin /></a>
              <a href="https://www.facebook.com/joseph.vundi.180" target="_blank" rel="noopener noreferrer" className="social-icon-btn" title="Facebook"><FiFacebook /></a>
              <a href="mailto:iotank.com@gmail.com" className="social-icon-btn" title="Email Customer Support"><FiMail /></a>
            </div>
          </div>
        </div>
      </footer>

      {/* AI Live Chat Integration */}
      <LiveChat />

      {/* Floating Custom Scroll Handle (Tiny) */}
      <div
        ref={handleRef}
        className={`scroll-top-handle ${scrolled ? 'visible' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{
          transform: 'translateX(0)'
        }}
        onMouseDown={handleMouseDown}
        title="Scroll Handle"
      >
        <div className="handle-grip">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div >
  );
};

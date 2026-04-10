import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
import { MainLayout } from '@/components/Layout/MainLayout';
import { NewsToast } from '@/components/Common/NewsToast';
import { SkeletonLoader } from '@/components/Common/SkeletonLoader';
import { CookieConsent } from '@/components/Common/CookieConsent';
import { enableGovernanceConsole } from '@/config/supabase';
import '@/styles/theme.css';
import '@/styles/global.css';
import '@/styles/modules.css';
import '@/styles/mobile.css';
import '@/styles/tour.css';

const LandingPage = lazy(() => import('@/components/Landing/LandingPage').then(module => ({ default: module.LandingPage })));
const LoginForm = lazy(() => import('@/components/Auth/LoginForm').then(module => ({ default: module.LoginForm })));
const ForgotPasswordForm = lazy(() => import('@/components/Auth/ForgotPasswordForm').then(module => ({ default: module.ForgotPasswordForm })));
const ResetPasswordForm = lazy(() => import('@/components/Auth/ResetPasswordForm').then(module => ({ default: module.ResetPasswordForm })));
const Dashboard = lazy(() => import('@/components/Dashboard/Dashboard').then(module => ({ default: module.Dashboard })));
const InventoryPage = lazy(() => import('@/components/Inventory/InventoryPage').then(module => ({ default: module.InventoryPage })));
const AnalyticsPage = lazy(() => import('@/components/Analytics/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));

const MarketPage = lazy(() => import('@/components/Market/MarketPage').then(module => ({ default: module.MarketPage })));
const AlertsCenter = lazy(() => import('@/components/Alerts/AlertsCenter').then(module => ({ default: module.AlertsCenter })));
const ReportingPage = lazy(() => import('@/components/Reporting/ReportingPage').then(module => ({ default: module.ReportingPage })));
const AIGovernancePage = lazy(() => import('@/components/Governance/AIGovernancePage').then(module => ({ default: module.AIGovernancePage })));
const SettingsPage = lazy(() => import('@/components/Settings/SettingsPage').then(module => ({ default: module.SettingsPage })));
const HelpPage = lazy(() => import('@/components/Help/HelpPage').then(module => ({ default: module.HelpPage })));
const EventLogPage = lazy(() => import('@/components/History/EventLogPage').then(module => ({ default: module.EventLogPage })));
const BillingPage = lazy(() => import('@/components/Billing/BillingPage').then(module => ({ default: module.BillingPage })));
const TeamManagement = lazy(() => import('@/components/Users/TeamManagement').then(module => ({ default: module.TeamManagement })));
const DeliveriesPage = lazy(() => import('@/components/Deliveries/DeliveriesPage').then(module => ({ default: module.DeliveriesPage })));


const PublicLoader = () => (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <div className="spinner mb-4" />
    </div>
);

const PageLoader = () => (
    <div className="skeleton-page-overlay">
        <div className="skeleton-page-content">
            <SkeletonLoader type="dashboard" />
        </div>
    </div>
);

import { ErrorBoundary } from '@/components/Common/ErrorBoundary';
import { TelemetryQueueProvider } from '@/contexts/TelemetryQueueContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

import { useEffect } from 'react';
import { NewsService } from '@/services/NewsService';

function App() {
    useEffect(() => {
        NewsService.startListening();
        return () => NewsService.stopListening();
    }, []);

    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <TelemetryQueueProvider>
                    <ModalProvider>
                <ConfigProvider>
                    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                        <ThemeProvider>
                            <AuthProvider>
                                <NewsToast />
                                <CookieConsent />
                                <Routes>
                                    {/* Public routes */}
                                    <Route path="/" element={<Suspense fallback={<PublicLoader />}><LandingPage /></Suspense>} />
                                    <Route path="/login" element={<Suspense fallback={<PublicLoader />}><LoginForm /></Suspense>} />
                                    <Route path="/forgot-password" element={<Suspense fallback={<PublicLoader />}><ForgotPasswordForm /></Suspense>} />
                                    <Route path="/reset-password" element={<Suspense fallback={<PublicLoader />}><ResetPasswordForm /></Suspense>} />

                                    {/* Protected Application Routes - Level 7 (Minimum for all) */}
                                    <Route element={<ProtectedRoute requiredLevel={7}><Suspense fallback={<PageLoader />}><MainLayout /></Suspense></ProtectedRoute>}>
                                        <Route path="dashboard" element={<Dashboard />} />
                                        <Route path="inventory" element={<InventoryPage />} />

                                        <Route path="market" element={<MarketPage />} />
                                        <Route path="alerts" element={<AlertsCenter />} />
                                        <Route path="help" element={<HelpPage />} />
                                        <Route path="bottom-link" element={<HelpPage />} />
                                    </Route>

                                    {/* Protected Application Routes - Level 6 (Supervisor) */}
                                    <Route element={<ProtectedRoute requiredLevel={6}><Suspense fallback={<PageLoader />}><MainLayout /></Suspense></ProtectedRoute>}>
                                        <Route path="analytics" element={<AnalyticsPage />} />
                                        <Route path="reporting" element={<ReportingPage />} />
                                        <Route path="deliveries" element={<DeliveriesPage />} />
                                        <Route path="inventory/transactions" element={<DeliveriesPage />} />
                                        <Route path="settings" element={<SettingsPage />} />
                                        <Route path="event-log" element={<EventLogPage />} />
                                    </Route>

                                    {/* Protected Application Routes - Level 5 (Owner) */}
                                    <Route element={<ProtectedRoute requiredLevel={5}><Suspense fallback={<PageLoader />}><MainLayout /></Suspense></ProtectedRoute>}>
                                        {enableGovernanceConsole && <Route path="governance" element={<AIGovernancePage />} />}
                                        <Route path="billing" element={<BillingPage />} />
                                        <Route path="users" element={<TeamManagement />} />
                                    </Route>
                                </Routes>
                            </AuthProvider>
                        </ThemeProvider>
                    </BrowserRouter>
                </ConfigProvider>
                </ModalProvider>
                </TelemetryQueueProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}

export default App;

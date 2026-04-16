# IoTank Fuel Intelligence Hub v2.0.0

Cloud-native Industrial IoT fuel tank monitoring dashboard with AI analytics, designed to surpass existing fuel inventory management solutions.

## 🚀 Features

- **Real-Time Monitoring**: Live fuel level and temperature tracking with sub-second updates using Supabase Real-time.
- **AI-Driven Analytics**: Google Gemini-powered predictive forecasting, anomaly detection, and procurement recommendations via Supabase Edge Functions.
- **Thermal Expansion Correction**: Automatic volume standardization to 15.5°C using fuel-specific coefficients.
- **3D Visualization**: Interactive tank models with Three.js.
- **Market Intelligence**: Real-time fuel pricing and strategic procurement advice.
- **Multi-Site Management**: Scale to hundreds of tanks across multiple locations.
- **Enterprise Security**: RBAC, identity-locked row-level security (RLS), and forensic audit logs.
- **Accessibility**: WCAG 2.1 AA compliant with colorblind modes.
- **Internationalization**: Support for EN, ES, FR, DE, SW with locale-aware formatting.

## 📋 Prerequisites

- Node.js 18+ and npm
- [Supabase](https://supabase.com/) project with:
  - PostgreSQL database enabled
  - Authentication configured (Email/Password + Google OAuth)
  - Edge Functions enabled
- [Firebase](https://firebase.google.com/) project for Hosting
- Google Cloud project with Gemini API access (configured via Supabase secrets)

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your **Supabase** configuration:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anonymous Key
   - `VITE_FIREBASE_CONFIG`: (Optional) Firebase config for hosting-specific features

3. **Run development server:**
   ```bash
   npm run dev
   ```
   
   The app will open at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── components/        # React components (Dashboard, TankCard, etc.)
├── contexts/         # React contexts (AuthContext, ThemeContext)
├── hooks/            # Custom hooks (useSupabase, etc.)
├── services/         # Business logic (AlertDetectionEngine, MarketIntelligence)
├── config/           # App configuration (Supabase, i18n)
├── types/            # TypeScript interfaces (index.ts)
├── utils/            # Shared utilities (math, formatting)
└── styles/           # Global CSS and Design System
```

## 🛠️ Troubleshooting Common Issues

### 🔒 Unauthorized (401) during Registration Approval
If you receive a `Provisioning Failed: Unauthorized (401)` error in the Super Admin dashboard when approving registrations, it means your Supabase Edge Functions do not have the correct secrets to validate your session token.

**Fix:**
1. Ensure your `.env` file has `SUPABASE_SERVICE_ROLE_KEY`.
2. Run the secret synchronization script:
   ```powershell
   .\scripts\sync-supabase-secrets.ps1
   ```
3. Refresh the Super Admin dashboard and try again.

## 🎨 Theme Customization

The app supports light/dark modes with industrial aesthetics. Modify `src/styles/theme.css` to customize the design system tokens. Theme preference is persisted in the user's Supabase profile.

## 🔒 Security

- **Row Level Security (RLS)**: Core data (tanks, readings, alerts) is protected at the database level using organization-bound policies.
- **JWT Authentication**: All requests are authenticated via Supabase JWTs.
- **Edge Security**: Sensitive operations (Gemini API, Market Data) are proxied through Supabase Edge Functions with secret management.
- **Audit Logging**: All critical actions are recorded in an immutable `audit_logs` table.

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests with Cypress
npm run test:e2e
```

## 📦 Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

## 🚀 Deployment

The frontend is deployed to **Firebase Hosting** for high-availability edge delivery.

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login and Deploy:
   ```bash
   firebase login
   npm run build
   firebase deploy --only hosting
   ```

## 🌍 Internationalization

Add or modify translations in `src/locales/`. Supports English, Spanish, French, German, and Swahili.

## 📊 Data Structure

### Core PostgreSQL Tables (Supabase)

```sql
-- Profiles: User identity and organization binding
profiles (id, auth_user_id, client_id, role, display_name)

-- Tanks: Physical tank configuration
tanks (id, client_id, site_id, name, capacity, fuel_type)

-- Sensor Readings: Time-series telemetry
sensor_readings (id, tank_id, fuel_level, temperature, volume_corrected, created_at)

-- Alerts: System and AI-generated notifications
alerts (id, tank_id, severity, message, status)
```

## 🤖 AI Integration

The system uses **Supabase Edge Functions** to interface with Google Gemini for:
- **Time-to-Empty forecasting**
- **Anomaly detection** (leaks, theft, unusual consumption)
- **Strategic procurement** advice based on market trends

## 🆘 Support

For issues or questions:
1. Check the project documentation in the repository.
2. Review Supabase logs for Edge Function or Database errors.
3. Check browser console for client-side issues.

## 📄 License

© 2026 IoTank Fuel Intelligence Hub. All rights reserved.

---

**Built with:** React 18, TypeScript, Supabase, Google Gemini AI, Three.js, Recharts, Firebase Hosting

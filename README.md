# IoTank Fuel Intelligence Hub v2.0.0

Cloud-native Industrial IoT fuel tank monitoring dashboard with AI analytics, designed to surpass existing fuel inventory management solutions.

## 🚀 Features

- **Real-Time Monitoring**: Live fuel level and temperature tracking with sub-second updates
- **AI-Driven Analytics**: Google Gemini-powered predictive forecasting, anomaly detection, and procurement recommendations
- **Thermal Expansion Correction**: Automatic volume standardization to 15.5°C using fuel-specific coefficients
- **3D Visualization**: Interactive tank models with Three.js
- **Market Intelligence**: Real-time fuel pricing and strategic procurement advice
- **Multi-Site Management**: Scale to hundreds of tanks across multiple locations
- **Enterprise Security**: RBAC, MFA, audit logs, and compliance-ready features
- **Accessibility**: WCAG 2.1 AA compliant with colorblind modes
- **Internationalization**: Support for EN, ES, FR, DE, SW with locale-aware formatting

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project with:
  - Firestore database enabled
  - Authentication configured (Email/Password + Google OAuth)
  - Cloud Functions enabled
- Google Cloud project with Gemini API access (optional for AI features)

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Firebase configuration:
   - Get your Firebase config from Firebase Console → Project Settings
   - Add your project credentials to the `.env` file

3. **Run development server:**
   ```bash
   npm run dev
   ```
   
   The app will open at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── components/        # React components
│   ├── Auth/         # Authentication (Login, ProtectedRoute)
│   ├── Dashboard/    # Main dashboard, TankCard, TankGrid
│   ├── Alerts/       # Alert banners and notifications
│   └── ...
├── contexts/         # React contexts (Theme, Auth)
├── hooks/            # Custom hooks (useFirestore, etc.)
├── utils/            # Utility functions (thermal correction, formatting)
├── config/           # Firebase configuration
├── types/            # TypeScript interfaces
└── styles/           # Global CSS and theme
```

## 🛠️ Troubleshooting Common Issues

### 🔒 Unauthorized (401) during Registration Approval
If you receive a `Provisioning Failed: Unauthorized (401)` error in the Super Admin dashboard when approving registrations, it means your Supabase Edge Functions do not have the correct secrets to validate your session token.

**Fix:**
1. Ensure your `.env` file has `SUPABASE_SERVICE_ROLE_KEY` (copy it from Supabase Dashboard → Settings → API).
2. Run the secret synchronization script:
   ```powershell
   .\scripts\sync-supabase-secrets.ps1
   ```
3. Refresh the Super Admin dashboard and try again.

## 🎨 Theme Customization

The app supports light/dark modes with industrial aesthetics. Modify `src/styles/theme.css` to customize:
- Color palette (primary, accent, status colors)
- Typography (fonts, sizes, weights)
- Spacing scale
- Border radius and shadows

Theme auto-detects system preference but can be manually toggled. Preference is stored in Firestore per user.

## 🔒 Security

- All Firebase API keys are public-facing (safe for client-side use with Firestore security rules)
- Sensitive operations (Gemini API calls, market data fetching) are proxied through Cloud Functions
- NEVER expose Cloud Function API keys or service account credentials client-side
- Firestore security rules enforce row-level access control

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

This creates an optimized build in the `dist/` directory with:
- Code splitting for faster loads
- Tree shaking to remove unused code
- Asset optimization (minification, compression)
- PWA service worker for offline support

## 🚀 Deployment

### Firebase Hosting (Recommended)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase Hosting:
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to `dist`
   - Configure as single-page app: Yes
   - Don't overwrite index.html

4. Deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

## 🌍 Internationalization

Add new languages by creating translation files in `src/locales/`:
- `en.json` (English - default)
- `es.json` (Spanish)
- `fr.json` (French)
- `de.json` (German)
- `sw.json` (Swahili)

Users can switch languages in Settings. Preference is stored in Firestore.

## 📊 Data Structure

### Firestore Collections

```
/organizations/{orgId}
  /tanks/{tankId}
    /readings/{readingId}
  /alerts/{alertId}
  /sites/{siteId}
  /reports/{reportId}
  
/users/{userId}
/userPreferences/{userId}
/marketData/{dataId}
```

### Sample Tank Reading

```json
{
  "tankId": "tank-001",
  "timestamp": 1704722400000,
  "rawDistance": 120.5,
  "temperature": 22.3,
  "fuelLevel": 75.2,
  "volumeMeasured": 15230.5,
  "volumeCorrected": 15187.3,
  "signalQuality": 95,
  "deviceId": "esp32-abc123",
  "processingLocation": "edge"
}
```

## 🤖 AI Integration

The system uses Google Gemini API for:
- Time-to-Empty forecasting
- Anomaly detection (leaks, unusual patterns)
- Procurement recommendations
- Predictive maintenance alerts

All AI insights are labeled as "Advisory Only" and require human verification for critical actions.

## 🆘 Support

For issues or questions:
1. Check the implementation plan in `brain/implementation_plan.md`
2. Review Firebase Console for backend errors
3. Check browser console for client-side issues

## 📄 License

© 2026 IoTank Fuel Intelligence Hub. All rights reserved.

---

**Built with:** React 18, TypeScript, Firebase, Google Gemini AI, Three.js, Recharts

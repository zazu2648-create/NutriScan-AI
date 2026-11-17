# NutriScan AI — Android Build, Running on Device & Play Store Release Guide

## Environment Note
This repository includes:
1. **Full-stack React + TypeScript + Vite frontend** (`/src`)
2. **Express + SQLite + Gemini + Open Food Facts + USDA backend** (`/server`, `/server.ts`)
3. **Configured Capacitor Android Project** (`/android`, `/capacitor.config.ts`, package ID `com.nutriscanai.app`)

Because the cloud preview sandbox does not ship with a Java JDK or Android SDK (`java`, `gradle`, `adb`), the binary `.apk` and signed `.aab` files must be compiled on your local computer with Android Studio.

---

## Step 1: Install Prerequisites on Your Computer
1. **Node.js 20+** (https://nodejs.org)
2. **Android Studio** (includes Android SDK, Gradle, and JDK 17+) (https://developer.android.com/studio)

---

## Step 2: Configure Backend & API Keys
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set your keys in `.env`:
   - `GEMINI_API_KEY` — Required for AI Meal Photo Estimation & Nutrition Label OCR.
   - `USDA_FDC_API_KEY` — Optional free key from https://fdc.nal.usda.gov/api-key-signup.html (defaults to `DEMO_KEY`).
   - `AUTH_SECRET` — Optional random 32+ char string for signing user session tokens.
3. Install dependencies and start the backend:
   ```bash
   npm install
   npm run dev
   ```
   The web app + API server runs at `http://localhost:3000`.

---

## Step 3: Run on Your Android Phone (Debug APK)
1. Point the Android wrapper to your hosted HTTPS backend URL in `capacitor.config.ts` (for production release, deploy `server.ts` + `dist/` to Cloud Run / Render / Fly.io / VPS and configure `server.url` or API base URL).
2. Build the web bundle and sync Android assets:
   ```bash
   npm run build
   npx cap sync android
   ```
3. Open the native Android project in Android Studio:
   ```bash
   npx cap open android
   ```
4. Enable **Developer Options > USB Debugging** on your Android phone, connect via USB, and click **Run** in Android Studio—or build a debug APK from terminal:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Step 4: Generate a Release Keystore & Signed `.aab`
1. Generate a private upload keystore (keep this file and passwords safe and NEVER commit them to Git):
   ```bash
   keytool -genkey -v -keystore nutriscan-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias nutriscan
   ```
2. Create `android/keystore.properties` (from `android/keystore.properties.example`):
   ```properties
   storeFile=../nutriscan-upload-key.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=nutriscan
   keyPassword=YOUR_KEY_PASSWORD
   ```
3. Build the signed Android App Bundle (`.aab`):
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   Output signed bundle: `android/app/build/outputs/bundle/release/app-release.aab`.

---

## Step 5: Google Play Store Publishing Checklist
- [ ] Verify package ID `com.nutriscanai.app` and increment `versionCode` / `versionName` in `android/app/build.gradle`.
- [ ] Upload `app-release.aab` to an Internal Testing track first and verify camera barcode scanning, photo OCR, offline mode, and account deletion on a physical Android device.
- [ ] Resize `src/assets/images/nutriscan_app_icon_1794893955486.jpg` to 512×512 PNG for Play Console App Icon.
- [ ] Resize `src/assets/images/nutriscan_feature_graphic_1794893956536.jpg` to 1024×500 JPG/PNG for Play Console Feature Graphic.
- [ ] Capture phone screenshots (Light & Dark mode, English & Urdu) on a 1080×1920+ Android device.
- [ ] Host your Privacy Policy URL publicly and paste it in Play Console > App Content > Privacy Policy.
- [ ] Complete Play Console > App Content > Data Safety using `play-store/DATA_SAFETY_CHECKLIST.md`.
- [ ] Submit for review (note: review and publication are performed by Google Play after submission).

# Google Play Data Safety Declaration Checklist — NutriScan AI

Use these answers when completing the **App content > Data safety** form in Google Play Console for `com.nutriscanai.app`:

## 1. Data Collection & Security
- **Does your app collect or share any of the required user data types?** Yes (only if the user chooses optional account sync, photo AI analysis, or barcode/search lookups).
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS/TLS for Open Food Facts, USDA FoodData Central, and backend API sync).
- **Do you provide a way for users to request that their data is deleted?** Yes — directly inside the app under **Profile > Settings & Legal > Delete Account & Cloud Data**, plus support contact `support@nutriscan.ai`.

## 2. Data Types Declared
| Category | Data Type | Collected | Shared | Purpose | Ephemeral / User-Initiated |
|---|---|---|---|---|---|
| Personal info | Name, Email address | Optional (only if user creates a sync account; Guest mode collects none) | No | Account authentication & cloud sync | No (retained until user deletes account) |
| Health & fitness | Daily food logs, height, weight, age, nutrition goals | Optional (stored locally in Guest mode; synced if signed in) | No | App functionality (calorie & macro target estimates and diary tracking) | No (user-editable and deletable anytime) |
| Photos & videos | Food / nutrition label images | Yes, only when user explicitly triggers Photo Scan or Label OCR | Processed via server-side Gemini API; not sold or shared with third-party advertisers | App functionality (AI meal estimation & OCR table extraction) | Yes (processed in-memory for the request, not stored permanently on server) |
| App activity | In-app search history | Stored locally on device (clearable in Settings) | No | App functionality | Stored locally; clearable |

## 3. Permissions Justification (Play Console App Content)
- **`android.permission.CAMERA`**: Requested strictly at runtime with an in-app rationale dialog when the user opens the Barcode Scanner, Photo Food Scanner, or Nutrition Label OCR Scanner. Never accessed in the background.
- **`android.permission.POST_NOTIFICATIONS`** (Android 13+): Optional, disabled by default, enabled only when the user turns on meal/summary reminders in Settings.
- **`android.permission.INTERNET`**: Required for Open Food Facts, USDA FoodData Central, Gemini multimodal analysis, and optional account synchronization.

## 4. Data Selling Declaration
- NutriScan AI **does not sell** personal user data or health logs to advertisers or data brokers.

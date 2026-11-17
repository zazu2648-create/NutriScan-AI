# Privacy Policy — NutriScan AI

Effective Date: November 2026  
Application: NutriScan AI (`com.nutriscanai.app`)  
Support Contact: support@nutriscan.ai

## 1. Overview
NutriScan AI respects your privacy. You may use core features—barcode scanning, nutrition calculation, food search, and local food logging—in **Guest Mode** without creating an account.

## 2. Permissions & Camera Usage
- **Camera (`CAMERA`)**: Requested strictly when you explicitly open the Barcode Scanner, AI Food Photo Scanner, or Nutrition Label OCR Scanner. Camera frames are never captured or uploaded silently in the background.
- **Notifications (`POST_NOTIFICATIONS`)**: Optional, disabled by default, and used only for user-configured meal logging and daily summary reminders.

## 3. Data Collected
- **Local Storage (Guest Mode)**: Profile settings, targets, daily food logs, recent scans, and cached product entries are stored locally on your device.
- **Optional Account Sync**: If you create an account, we store your display name, email address, hashed password (scrypt), profile targets, favorites, and daily food logs on our server database solely to synchronize your data across sessions.
- **Image Analysis**: When you submit a food photo or nutrition label photo, the image is sent over HTTPS to our backend and processed via the Gemini API to extract nutritional estimates or label text. Images are not sold or used for advertising.

## 4. Third-Party Food Databases
Barcode and food search queries are sent over HTTPS to **Open Food Facts** (ODbL) and **USDA FoodData Central** (CC0) to retrieve product nutrition data.

## 5. Your Rights: Export & Deletion
- You can export your full profile, goals, and food diary as **JSON** or **CSV** at any time from **Profile**.
- You can clear local scan/search history or permanently **Delete Account & Cloud Data** inside **Settings & Legal**, which immediately removes your user record, profile, logs, and favorites from our server.
- NutriScan AI never sells personal data.

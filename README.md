# Meeting Notes AI - Production Ready Template

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-Expo-blue?style=flat&logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Price-$39-orange?style=flat&logo=gumroad" alt="$39">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat" alt="MIT">
</p>

A production-ready React Native (Expo) mobile application template for AI-powered meeting notes. Record meetings, transcribe speech to text using Whisper, and generate structured AI summaries with GPT.

---

## Features

### Recording & Organization
- **One-tap Recording** - Simple audio recording with timer display
- **Folder System** - Organize by Work, Product, Personal
- **Speaker Tagging** - Tag speakers before/during recording
- **Search** - Quick search across all meetings

### AI Processing
- **Speech-to-Text** - Real transcription using OpenAI Whisper API
- **AI Summaries** - GPT-powered analysis returning:
  - Summary (2-3 sentences)
  - Key Points (3-5 bullets)
  - Action Items
  - Questions Raised

### Export Options
- **PDF Export** - Beautiful formatted PDF documents
- **Share** - System share sheet
- **Copy** - Copy to clipboard

### Technical
- Clean architecture with service layers
- API key configuration screen
- Error handling and retry logic
- Demo mode (works without API key)
- Production-ready code

---

## Screenshots

| Main Screen | Recording | Detail View |
|-------------|-----------|-------------|
| ![Main](https://via.placeholder.com/300x600/f8f9fa/1a1a1a?text=Meeting+List) | ![Recording](https://via.placeholder.com/300x600/f8f9fa/1a1a1a?text=Recording) | ![Detail](https://via.placeholder.com/300x600/f8f9fa/1a1a1a?text=AI+Summary) |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

---

## API Configuration

### Getting an OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new secret key
5. Copy the key (starts with `sk-`)

### Adding API Key in App

1. Open the app
2. Tap **SETTINGS** in top right
3. Enter your OpenAI API key
4. Tap **SAVE**

### Cost Estimation

- **Whisper (transcription):** ~$0.006/minute
- **GPT-3.5 (summarization):** ~$0.01/meeting
- **Total cost:** ~$0.02-0.05 per meeting

---

## Building APK

### Android

```bash
# Generate native Android project
npx expo prebuild --platform android

# Build debug APK
cd android
./gradlew assembleDebug

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS

```bash
# Generate native iOS project
npx expo prebuild --platform ios

# Build using Xcode
cd ios
open *.xcworkspace
```

---

## Project Structure

```
meeting-notes-ai/
├── app/
│   └── index.tsx              # Main app with all screens
├── src/
│   └── services/
│       ├── aiService.js       # OpenAI API integration (Whisper + GPT)
│       └── storageService.js  # Local data persistence
├── assets/                    # App icons, splash, images
├── package.json
├── app.json
├── README.md
└── SETUP_GUIDE.md            # Detailed setup for buyers
```

---

## What's Included

### For Buyers ($39)
- Full source code (React Native/Expo)
- Setup guide (README.md + SETUP_GUIDE.md)
- API integration instructions
- Demo mode (works without API key)
- Free bug fix updates
- Support for setup issues

### Features Ready to Use
| Feature | Status |
|---------|--------|
| One-tap Recording | ✅ |
| Folders | ✅ |
| Speaker Tagging | ✅ |
| Search | ✅ |
| Whisper Transcription | ✅ |
| GPT Summarization | ✅ |
| PDF Export | ✅ |
| Share/Copy | ✅ |
| Demo Mode | ✅ |
| API Settings | ✅ |

---

## Demo

Try before you buy - the app works in demo mode without an API key:

1. Download Expo Go on your phone
2. Scan QR from `npx expo start`
3. See demo meetings with AI summaries

---

## Customization

### Adding New Folders

Edit `app/index.tsx`:
```javascript
const FOLDERS = ['All', 'Work', 'Product', 'Personal', 'YourFolder'];
```

### Adding Speaker Options

Edit the SPEAKERS array in `app/index.tsx`:
```javascript
const SPEAKERS = ['Speaker 1', 'Speaker 2', 'John', 'Sarah', 'YourSpeaker'];
```

### Changing Colors

Edit the COLORS object in `app/index.tsx`:
```javascript
const COLORS = {
  primary: '#1a1a1a',  // Change primary color
  accent: '#2563eb',   // Change accent color
  // ...
};
```

---

## License

MIT License - Use freely for personal and commercial projects.

---

## Support

For issues or questions:
- Open GitHub issue
- Check SETUP_GUIDE.md

---

<p align="center">
  <strong>Ready to sell on Gumroad? $39</strong><br>
  Clean code • Well documented • Easy to customize
</p>

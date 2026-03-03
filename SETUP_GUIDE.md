# Meeting Notes AI - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npx expo start
```

### 3. Run on Device/Emulator
```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

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
# Then build in Xcode
```

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

## Customization

### Adding New Folders

Edit `app/index.tsx`:
```javascript
const FOLDERS = ['All', 'Work', 'Product', 'Personal', 'YourFolder'];
```

### Changing Colors

Edit the COLORS object in `app/index.tsx`:
```javascript
const COLORS = {
  primary: '#1a1a1a',  // Change this
  accent: '#2563eb',   // Change this
  // ...
};
```

### Adding Export Formats

The export system is in `app/index.tsx`:
- `handleShare()` - System share
- `handleCopy()` - Clipboard
- `exportAsText()` - Text formatting

### Connecting Different AI APIs

Edit `src/services/aiService.js`:
- `transcribeAudio()` - Change Whisper endpoint
- `generateSummary()` - Change GPT model or use different AI provider

## Troubleshooting

### Microphone Permission Denied
- Go to phone Settings > Apps > Meeting Notes > Permissions
- Enable Microphone

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

### API Errors
- Check your API key is valid
- Check you have credits in your OpenAI account
- Verify API key format (starts with `sk-`)

## Support

For issues, check:
1. README.md
2. GitHub issues
3. Contact support

## License

MIT License - Use freely for personal and commercial projects.

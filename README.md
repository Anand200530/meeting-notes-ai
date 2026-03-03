# Meeting Notes AI - Production Ready Template

A production-ready React Native (Expo) mobile application template for AI-powered meeting notes. Record meetings, transcribe speech to text using Whisper, and generate structured AI summaries with GPT.

## Features

### Core Functionality
- **One-tap Recording** - Simple audio recording with timer display
- **File Management** - Save, rename, and organize recordings by folder
- **Speech-to-Text** - Real transcription using OpenAI Whisper API
- **AI Summaries** - GPT-powered analysis returning:
  - Summary (2-3 sentences)
  - Key Points (3-5 bullets)
  - Action Items
  - Questions Raised

### Export Options
- Share via system share sheet
- Copy to clipboard
- Full text export

### Technical Features
- Clean architecture with service layers
- API key configuration screen
- Error handling and retry logic
- Loading states with progress indicators
- Production-ready code structure

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- OpenAI API key

### Installation

```bash
# Navigate to project
cd voicenotes

# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

### API Configuration

1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Open the app
3. Tap SETTINGS
4. Enter your OpenAI API key
5. Save

### Cost Estimate
- Whisper: ~$0.006/minute of audio
- GPT-3.5: ~$0.01/meeting summary
- **Total: ~$0.02-0.05 per meeting**

## Project Structure

```
src/
├── services/
│   ├── aiService.js       # OpenAI API integration (Whisper + GPT)
│   └── storageService.js   # Local data persistence
app/
└── index.tsx               # Main app with all screens
```

## Building for Production

### Android APK
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

### iOS
```bash
npx expo prebuild --platform ios
cd ios
xcodebuild -scheme YourApp -configuration Release
```

## API Integration

### Using Your Own API Keys

The app requires an OpenAI API key for:
- **Whisper** - Speech to text transcription
- **GPT-3.5** - AI summary generation

### Environment Variables (Optional)

Create `.env` file:
```
OPENAI_API_KEY=your-api-key-here
```

## Customization

### Adding New Export Formats

Edit `src/services/aiService.js`:

```javascript
export function exportAsPDF(meeting) {
  // Add PDF export logic using expo-print
}
```

### Adding New Folders

Edit the FOLDERS array in `app/index.tsx`:
```javascript
const FOLDERS = ['All', 'Work', 'Product', 'Personal', 'YourFolder'];
```

## Selling on Gumroad

This template is ready to sell on Gumroad:

1. **Clean Code** - Well-structured, production-ready
2. **Documented** - Setup guide included
3. **Customizable** - Easy to modify
4. **Demo-Ready** - Works out of the box (demo mode included)

### Recommended Price: $39

### What's Included
- Full source code
- Setup guide (this file)
- API integration instructions
- Demo screenshots
- Support for modifications

## License

MIT License - Use freely for personal and commercial projects.

## Support

For issues or questions, please open an issue on the repository.

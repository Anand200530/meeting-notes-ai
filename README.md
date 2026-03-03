# Meeting Notes AI - Production Ready Template

A production-ready React Native (Expo) mobile app for AI-powered meeting notes. Record meetings, transcribe speech to text, and generate AI summaries.

## Features

- One-tap audio recording
- Speech-to-text (Whisper API)
- AI summaries with GPT
- Export & Share
- Clean UI

## Getting Started

```bash
# Install
npm install

# Run
npx expo start
```

## API Setup

1. Get OpenAI key from https://platform.openai.com/api-keys
2. Open app > Settings
3. Enter API key
4. Save

## Building

```bash
# Android
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug

# iOS
npx expo prebuild --platform ios
```

## Sell on Gumroad

This template is ready to sell ($39). Clean code, documented, customizable.

## License

MIT

# CardDeal Frontend

Location-based card recommendation service mobile application.

## Tech Stack

- React Native (Expo)
- TypeScript
- React Navigation
- Google Maps API
- Axios

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
- API_BASE_URL: Backend API URL
- GOOGLE_MAPS_API_KEY: Google Maps API key
- GOOGLE_OAUTH_CLIENT_ID: Google OAuth client ID

4. Run the app:
```bash
npm start
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── screens/          # Screen components
├── navigation/       # Navigation configuration
├── services/         # API services
├── context/          # React Context providers
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── assets/           # Static assets
```

## Available Scripts

- `npm start`: Start Expo development server
- `npm run android`: Run on Android emulator
- `npm run ios`: Run on iOS simulator
- `npm run web`: Run on web browser

## Features

- User authentication with Google OAuth
- Real-time location-based merchant discovery
- Card benefit recommendations
- Personal card management
- Card usage tracking

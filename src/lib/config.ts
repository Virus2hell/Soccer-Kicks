// Where the game server lives.
//
// Set it in a .env file in the project root (Expo reads EXPO_PUBLIC_* at build time):
//   EXPO_PUBLIC_SERVER_URL=https://your-app-name.onrender.com
// After changing .env, restart with:  npx expo start -c
export const SERVER_URL = (process.env.EXPO_PUBLIC_SERVER_URL || 'https://soccer-pucks-server.onrender.com').replace(/\/+$/, '');

// Render's free plan sleeps when nobody plays for 15 minutes; waking up takes up to ~1 minute
export const WAKE_UP_TIMEOUT_MS = 75_000;

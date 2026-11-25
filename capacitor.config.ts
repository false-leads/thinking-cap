import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: appId can never change once the app is uploaded to Google Play / F-Droid.
const config: CapacitorConfig = {
  appId: 'com.falseleads.thinkingcap',
  appName: 'Thinking Cap',
  webDir: 'dist',
  backgroundColor: '#16133a',
  android: {
    // fully offline: every deck ships inside the app
    allowMixedContent: false,
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.car.tracker",
  appName: "Car Tracker",
  webDir: "dist",
  android: {
    useLegacyBridge: true,
  },
};

export default config;

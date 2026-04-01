import { Capacitor } from "@capacitor/core";

export const isAndroid = Capacitor.getPlatform() === "android";

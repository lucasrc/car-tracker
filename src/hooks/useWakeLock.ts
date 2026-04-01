import { useEffect, useRef, useState, useCallback } from "react";
import { KeepAwake } from "@capgo/capacitor-keep-awake";

interface WakeLockState {
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

export function useWakeLock(): WakeLockState {
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);
  const isRequestedRef = useRef(false);
  const isNativeUsedRef = useRef(false);

  const acquireWeb = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock.current = await navigator.wakeLock.request("screen");
      wakeLock.current.addEventListener("release", () => {
        if (isRequestedRef.current) {
          setIsActive(false);
        }
      });
      setIsActive(true);
    } catch (err) {
      console.error("Web Wake Lock error:", err);
    }
  }, []);

  const releaseWeb = useCallback(async () => {
    if (wakeLock.current) {
      try {
        await wakeLock.current.release();
        wakeLock.current = null;
        setIsActive(false);
      } catch (err) {
        console.error("Web Wake Lock release error:", err);
      }
    }
  }, []);

  const request = useCallback(async () => {
    isRequestedRef.current = true;

    try {
      const supported = await KeepAwake.isSupported();
      if (supported.isSupported) {
        await KeepAwake.keepAwake();
        isNativeUsedRef.current = true;
        setIsActive(true);
        return;
      }
    } catch (err) {
      console.warn("Native KeepAwake not available, using web API:", err);
    }

    isNativeUsedRef.current = false;
    await acquireWeb();
  }, [acquireWeb]);

  const release = useCallback(async () => {
    isRequestedRef.current = false;

    if (isNativeUsedRef.current) {
      try {
        await KeepAwake.allowSleep();
      } catch (err) {
        console.error("Native KeepAwake release error:", err);
      }
      isNativeUsedRef.current = false;
    } else {
      await releaseWeb();
    }
    setIsActive(false);
  }, [releaseWeb]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isRequestedRef.current) {
        if (isNativeUsedRef.current) {
          try {
            await KeepAwake.keepAwake();
          } catch {
            isNativeUsedRef.current = false;
            await acquireWeb();
          }
        } else if (!wakeLock.current) {
          await acquireWeb();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acquireWeb]);

  useEffect(() => {
    return () => {
      isRequestedRef.current = false;
      if (isNativeUsedRef.current) {
        KeepAwake.allowSleep().catch(() => {});
      } else if (wakeLock.current) {
        wakeLock.current.release().catch(() => {});
      }
    };
  }, []);

  return { isActive, request, release };
}

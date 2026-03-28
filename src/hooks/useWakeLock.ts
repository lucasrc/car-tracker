import { useEffect, useRef, useState, useCallback } from "react";

interface WakeLockState {
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

export function useWakeLock(): WakeLockState {
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);

  const request = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;

    try {
      wakeLock.current = await navigator.wakeLock.request("screen");
      wakeLock.current.addEventListener("release", () => {
        setIsActive(false);
      });
      setIsActive(true);
    } catch (err) {
      console.error("Wake Lock error:", err);
    }
  }, []);

  const release = useCallback(async () => {
    if (wakeLock.current) {
      try {
        await wakeLock.current.release();
        wakeLock.current = null;
        setIsActive(false);
      } catch (err) {
        console.error("Wake Lock release error:", err);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (wakeLock.current) {
        wakeLock.current.release().catch(() => {});
      }
    };
  }, []);

  return { isActive, request, release };
}

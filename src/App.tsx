import { HashRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { getSettings, saveCurrentTrip } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { BottomNav } from "@/components/layout/BottomNav";
import { Tracker } from "@/pages/Tracker";
import { History } from "@/pages/History";
import { TripDetail } from "@/pages/TripDetail";
import { Settings } from "@/pages/Settings";
import { NotFound } from "@/pages/NotFound";
import { useEffect, useState } from "react";
import { BackgroundTracker } from "@/services/backgroundTracker";
import { useTripStore } from "@/stores/useTripStore";
import { Capacitor } from "@capacitor/core";

export function App() {
  const [isReady, setIsReady] = useState(false);
  const loadCurrentTrip = useTripStore((s) => s.loadCurrentTrip);

  useEffect(() => {
    async function init() {
      await loadCurrentTrip();

      const currentStatus = useTripStore.getState().status;
      const currentTrip = useTripStore.getState().trip;

      console.log(
        "[App] init: currentStatus=",
        currentStatus,
        "hasTrip=",
        !!currentTrip,
      );

      if (currentStatus === "idle" && Capacitor.isNativePlatform()) {
        try {
          const state = await BackgroundTracker.getTrackingState();
          console.log("[App] getTrackingState:", state);

          if (state.isTracking && state.startTime && !currentTrip) {
            const startTime = new Date(state.startTime).toISOString();

            const settings = await getSettings();

            const trip = {
              id: generateId(),
              startTime,
              distanceMeters: 0,
              maxSpeed: 0,
              avgSpeed: 0,
              path: [],
              status: "recording" as const,
              driveMode: "city" as const,
              consumption: settings.manualCityKmPerLiter,
              fuelCapacity: settings.fuelCapacity,
              fuelUsed: 0,
              fuelPrice: settings.fuelPrice,
              totalCost: 0,
              elapsedTime: 0,
              totalFuelUsed: 0,
              stops: [],
            };

            useTripStore.setState({
              trip,
              status: "recording",
            });

            await saveCurrentTrip(trip);
          }
        } catch (err) {
          console.warn("Failed to check background tracking state:", err);
        }
      }

      setIsReady(true);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Tracker />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<TripDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;

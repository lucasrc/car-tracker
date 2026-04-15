import { HashRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BottomNav } from "@/components/layout/BottomNav";
import { Tracker } from "@/pages/Tracker";
import { History } from "@/pages/History";
import { TripDetail } from "@/pages/TripDetail";
import { Settings } from "@/pages/Settings";
import { NotFound } from "@/pages/NotFound";
import { CalibrationTest } from "@/pages/CalibrationTest";
import { RefuelPage } from "@/pages/Refuel";
import { useEffect, useState } from "react";
import { useTripStore } from "@/stores/useTripStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useFuelInventoryStore } from "@/stores/useFuelInventoryStore";

export function App() {
  const [isReady, setIsReady] = useState(false);
  const loadCurrentTrip = useTripStore((s) => s.loadCurrentTrip);
  const initializeVehicles = useVehicleStore((s) => s.initialize);

  useEffect(() => {
    async function init() {
      await initializeVehicles();
      await loadCurrentTrip();

      const currentStatus = useTripStore.getState().status;
      const currentTrip = useTripStore.getState().trip;

      console.log(
        "[App] init: currentStatus=",
        currentStatus,
        "hasTrip=",
        !!currentTrip,
      );

      if (currentStatus === "recording" || currentStatus === "paused") {
        console.log("[App] Incomplete trip detected, replaying WAL...");
        await useFuelInventoryStore.getState().replayWal();
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
          <Route path="/refuel" element={<RefuelPage />} />
          <Route path="/test-calibration" element={<CalibrationTest />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;

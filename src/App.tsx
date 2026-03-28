import { HashRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BottomNav } from "@/components/layout/BottomNav";
import { Tracker } from "@/pages/Tracker";
import { History } from "@/pages/History";
import { TripDetail } from "@/pages/TripDetail";
import { Settings } from "@/pages/Settings";
import { NotFound } from "@/pages/NotFound";

export function App() {
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

import { NavLink, useLocation } from "react-router-dom";

export function BottomNav() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isHistoryRoute = location.pathname.startsWith("/history");
  const isReportTab = isHistoryRoute && searchParams.get("tab") === "report";
  const isHistoryTab = isHistoryRoute && !isReportTab;

  const iconClassName = "h-6 w-6";

  const getIconContainerClassName = (isActive: boolean) =>
    `rounded-full p-2.5 transition-colors ${
      isActive ? "bg-emerald-200/85 text-emerald-700" : "bg-white/65 text-slate-500"
    }`;

  const getLabelClassName = (isActive: boolean) =>
    `text-xs ${isActive ? "font-semibold text-emerald-700" : "font-medium text-slate-600"}`;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-3 pb-2">
      <nav className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-around rounded-[24px] border border-white/70 bg-[#e4ecef]/88 px-2 py-1.5 shadow-[0_16px_34px_rgba(15,23,42,0.15)] backdrop-blur-xl">
        <NavLink to="/tracker">
          {({ isActive }) => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={getIconContainerClassName(isActive)}>
                <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <span className={getLabelClassName(isActive)}>
                Rastrear
              </span>
            </div>
          )}
        </NavLink>

        <NavLink to="/history">
          {() => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={getIconContainerClassName(isHistoryTab)}>
                <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className={getLabelClassName(isHistoryTab)}>Historico</span>
            </div>
          )}
        </NavLink>

        <NavLink to="/history?tab=report">
          {() => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={getIconContainerClassName(isReportTab)}>
                <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <span className={getLabelClassName(isReportTab)}>Relatorio</span>
            </div>
          )}
        </NavLink>

        <NavLink to="/settings">
          {({ isActive }) => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={getIconContainerClassName(isActive)}>
                <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <span className={getLabelClassName(isActive)}>
                Config
              </span>
            </div>
          )}
        </NavLink>
      </nav>
    </div>
  );
}

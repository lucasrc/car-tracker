import { NavLink } from "react-router-dom";

export function BottomNav() {
  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-3 pb-2">
      <nav className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-around rounded-[24px] border border-white/70 bg-[#e4ecef]/88 px-2 py-1.5 shadow-[0_16px_34px_rgba(15,23,42,0.15)] backdrop-blur-xl">
        <NavLink to="/tracker">
          {({ isActive }) => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={`rounded-full p-2.5 transition-colors ${isActive ? "bg-emerald-200/85 text-emerald-700" : "bg-white/65 text-slate-500"}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <span className={`text-xs ${isActive ? "font-semibold text-emerald-700" : "font-medium text-slate-600"}`}>
                Rastrear
              </span>
            </div>
          )}
        </NavLink>

        <NavLink to="/history">
          {({ isActive }) => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={`rounded-full p-2.5 transition-colors ${isActive ? "bg-emerald-200/85 text-emerald-700" : "bg-white/65 text-slate-500"}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className={`text-xs ${isActive ? "font-semibold text-emerald-700" : "font-medium text-slate-600"}`}>
                Histórico
              </span>
            </div>
          )}
        </NavLink>

        <NavLink to="/settings">
          {({ isActive }) => (
            <div className="flex min-w-[84px] flex-col items-center gap-0.5 px-2 py-0.5">
              <div className={`rounded-full p-2.5 transition-colors ${isActive ? "bg-emerald-200/85 text-emerald-700" : "bg-white/65 text-slate-500"}`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <span className={`text-xs ${isActive ? "font-semibold text-emerald-700" : "font-medium text-slate-600"}`}>
                Config
              </span>
            </div>
          )}
        </NavLink>
      </nav>
    </div>
  );
}

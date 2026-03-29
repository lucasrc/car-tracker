import { Link } from "react-router-dom";

export function TrackerHeader() {
  return (
    <header className="pointer-events-none fixed left-0 right-0 top-2 z-40 px-3">
      <div className="pointer-events-auto relative flex h-[78px] items-end justify-center rounded-[24px] border border-white/70 bg-[#d9e8ec]/88 px-4 pb-3 shadow-[0_10px_26px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <h1 className="font-semibold tracking-[-0.025em] text-slate-900 [font-size:clamp(1.85rem,6.8vw,2.35rem)]">
          TripTrack
        </h1>
        <Link
          to="/settings"
          aria-label="Configurações"
          className="absolute bottom-2.5 right-3 rounded-full p-2 text-slate-700 transition-colors hover:bg-white/60 hover:text-slate-900"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>
      </div>
    </header>
  );
}

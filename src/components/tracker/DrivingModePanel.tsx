import { useState } from "react";
import type { DrivingStyle } from "@/lib/driving-style-detector";

interface DrivingStyleBadgeProps {
  style?: DrivingStyle;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DrivingStyleBadge({
  style = "eco",
  size = "md",
  className = "",
}: DrivingStyleBadgeProps) {
  const labels: Record<DrivingStyle, string> = {
    eco: "ECO",
    normal: "NORMAL",
    sport: "SPORT",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  };

  const variantClasses = {
    eco: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    normal: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    sport: "bg-red-500/20 text-red-400 border border-red-500/30",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-medium transition-colors ${sizeClasses[size]} ${variantClasses[style]} ${className}`}
    >
      {labels[style]}
    </span>
  );
}

interface DrivingModePanelProps {
  drivingStyle?: DrivingStyle;
  acOn: boolean;
  onAcChange: (acOn: boolean) => void;
  onDrivingStyleChange?: (style: DrivingStyle) => void;
  isVisible?: boolean;
}

export function DrivingModePanel({
  drivingStyle = "eco",
  acOn,
  onAcChange,
  onDrivingStyleChange,
  isVisible = true,
}: DrivingModePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [manualStyle, setManualStyle] = useState<DrivingStyle | null>(null);
  const activeStyle = manualStyle ?? drivingStyle;

  const handleStyleClick = (style: DrivingStyle) => {
    setManualStyle(style);
    onDrivingStyleChange?.(style);
    setExpanded(false);
  };

  const handleAcClick = () => {
    onAcChange(!acOn);
    setExpanded(false);
  };

  if (!isVisible) return null;

  const styleColors: Record<DrivingStyle, string> = {
    eco: "bg-emerald-500",
    normal: "bg-amber-500",
    sport: "bg-red-500",
  };

  return (
    <div className="relative">
      {expanded ? (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 p-2 shadow-xl">
          <div className="flex gap-1">
            {(["eco", "normal", "sport"] as DrivingStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => handleStyleClick(style)}
                className={
                  "flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all " +
                  (activeStyle === style
                    ? styleColors[style] + " text-white"
                    : "bg-slate-700 text-slate-400 hover:bg-slate-600")
                }
              >
                {style.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={handleAcClick}
            className={
              "w-full py-1 rounded-full text-xs font-medium transition-all " +
              (acOn
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-700 text-slate-400")
            }
          >
            AR {acOn ? "ON" : "OFF"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className={
            "flex h-10 w-10 items-center justify-center rounded-full shadow-xl active:scale-95 transition-transform " +
            styleColors[activeStyle]
          }
        >
          <span className="text-white text-xs font-bold">
            {activeStyle === "eco" ? "E" : activeStyle === "normal" ? "N" : "S"}
          </span>
        </button>
      )}
    </div>
  );
}

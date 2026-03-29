import { useId } from "react";

const CX = 140;
const CY = 140;
const ARC_R = 114;
const ARC_STROKE = 14;
const START_DEG = 136;
const SWEEP = 268;
const MAX_SPEED = 180;
const NUM_SEGS = 52;
const SEG_DEG = SWEEP / NUM_SEGS;
const TICK_LABEL_R = ARC_R + 12;

const KEY_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function gradientColor(ratio: number): string {
  const scaled = Math.min(ratio, 0.9999) * (KEY_COLORS.length - 1);
  const idx = Math.floor(scaled);
  return lerpColor(KEY_COLORS[idx], KEY_COLORS[idx + 1], scaled - idx);
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

function polar(r: number, deg: number): { x: number; y: number } {
  return { x: CX + r * Math.cos(deg2rad(deg)), y: CY + r * Math.sin(deg2rad(deg)) };
}

function arcPath(r: number, startDeg: number, endDeg: number): string {
  const s = polar(r, startDeg);
  const e = polar(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${s.x.toFixed(3)},${s.y.toFixed(3)} A${r},${r} 0 ${large},1 ${e.x.toFixed(3)},${e.y.toFixed(3)}`;
}

function speedToAngle(speed: number): number {
  return START_DEG + (Math.min(Math.max(speed, 0), MAX_SPEED) / MAX_SPEED) * SWEEP;
}

function speedColor(speed: number): string {
  return gradientColor(Math.min(speed, MAX_SPEED) / MAX_SPEED);
}

const SEGMENTS = Array.from({ length: NUM_SEGS }, (_, i) => ({
  segStart: START_DEG + i * SEG_DEG,
  segEnd: START_DEG + i * SEG_DEG + SEG_DEG + 0.1,
  color: gradientColor(i / NUM_SEGS),
}));

const TICK_VALUES = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180];
const FRACTION_TICK_VALUES = Array.from({ length: MAX_SPEED / 5 + 1 }, (_, i) => i * 5);

const TICKS = TICK_VALUES.map((val) => {
  const deg = speedToAngle(val);
  return {
    val,
    label: polar(TICK_LABEL_R, deg),
  };
});

const FRACTION_TICKS = FRACTION_TICK_VALUES.map((val) => {
  const deg = speedToAngle(val);
  const isMain = val % 20 === 0;

  return {
    val,
    outer: polar(ARC_R - 3, deg),
    inner: polar(ARC_R - (isMain ? 11 : 8), deg),
    isMain,
  };
});

interface SpeedometerProps {
  currentSpeed: number;
  maxSpeed: number;
  avgSpeed: number;
}

export function Speedometer({ currentSpeed, maxSpeed, avgSpeed }: SpeedometerProps) {
  const svgId = useId();
  const color = speedColor(currentSpeed);
  const markerAngle = speedToAngle(currentSpeed);
  const markerPoint = polar(ARC_R, markerAngle);

  // Curved helper paths for labels that should track the inner ring.
  const avgLabelPath = arcPath(88, 146, 212);
  const maxLabelPath = arcPath(88, 328, 394);

  return (
    <div className="flex items-center justify-center">
      <div
        className="relative rounded-full border border-white/32 bg-black/32 shadow-[0_22px_48px_rgba(0,0,0,0.36)] backdrop-blur-[3px]"
        style={{ width: "min(84vw, 345px)", height: "min(84vw, 345px)" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.34)_72%,rgba(2,6,23,0.5)_100%)]" />
        <div className="pointer-events-none absolute inset-[11.5%] rounded-full border border-white/30 bg-black/18" />
        <svg viewBox="0 0 280 280" className="h-full w-full">
          <defs>
            <path id={`${svgId}-avg-path`} d={avgLabelPath} />
            <path id={`${svgId}-max-path`} d={maxLabelPath} />
            <filter id={`${svgId}-contrast-shadow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="rgba(0,0,0,0.95)" />
            </filter>
          </defs>

          <path
            d={arcPath(ARC_R, START_DEG, START_DEG + SWEEP)}
            fill="none"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth={13}
            strokeLinecap="round"
          />

          {SEGMENTS.map(({ segStart, segEnd, color: segColor }, i) => (
            <path
              key={i}
              d={arcPath(ARC_R, segStart, segEnd)}
              fill="none"
              stroke={segColor}
              strokeWidth={ARC_STROKE}
              strokeLinecap="round"
              opacity={0.94}
            />
          ))}

          <g filter={`url(#${svgId}-contrast-shadow)`}>
            {FRACTION_TICKS.map(({ val, outer, inner, isMain }) => (
            <line
              key={`fraction-${val}`}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="rgba(255,255,255,0.98)"
              strokeWidth={isMain ? 1.9 : 1.25}
              strokeLinecap="round"
              opacity={isMain ? 0.98 : 0.86}
            />
            ))}
          </g>

          {TICKS.map(({ val, label }) => (
            <text
              key={val}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="7.5"
              fill="rgba(255,255,255,0.98)"
              stroke="rgba(2,6,23,0.9)"
              strokeWidth="0.8"
              paintOrder="stroke"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
              filter={`url(#${svgId}-contrast-shadow)`}
            >
              {val}
            </text>
          ))}

          <text
            fontSize="8"
            fill="rgba(216,249,202,0.94)"
            stroke="rgba(2,6,23,0.9)"
            strokeWidth="0.6"
            paintOrder="stroke"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
            letterSpacing="0.3"
            filter={`url(#${svgId}-contrast-shadow)`}
          >
            <textPath href={`#${svgId}-avg-path`} startOffset="50%" textAnchor="middle">
              Vel. Media: {Math.round(avgSpeed)} km/h
            </textPath>
          </text>

          <text
            fontSize="8"
            fill="rgba(255,255,255,0.9)"
            stroke="rgba(2,6,23,0.9)"
            strokeWidth="0.6"
            paintOrder="stroke"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
            letterSpacing="0.3"
            filter={`url(#${svgId}-contrast-shadow)`}
          >
            <textPath href={`#${svgId}-max-path`} startOffset="50%" textAnchor="middle">
              Vel. Max: {Math.round(maxSpeed)} km/h
            </textPath>
          </text>

          <circle cx={markerPoint.x} cy={markerPoint.y} r="8" fill="rgba(255,255,255,0.18)" />
          <circle cx={markerPoint.x} cy={markerPoint.y} r="5.2" fill={color} stroke="rgba(255,255,255,0.92)" strokeWidth="1.8" />

          <circle cx={CX} cy={CY} r="71" fill="rgba(9,22,33,0.2)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.3" />

          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="84"
            fontWeight="bold"
            fill="rgba(255,255,255,0.98)"
            stroke="rgba(34,197,94,0.95)"
            strokeWidth="2.4"
            paintOrder="stroke"
            fontFamily="system-ui, sans-serif"
          >
            {Math.round(currentSpeed)}
          </text>

          <text
            x={CX}
            y={CY + 58}
            textAnchor="middle"
            fontSize="18"
            fill="rgba(255,255,255,0.88)"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            km/h
          </text>
        </svg>
      </div>
    </div>
  );
}

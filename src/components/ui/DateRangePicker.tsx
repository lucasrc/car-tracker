import { useState, useRef, useEffect } from "react";

type Preset = 7 | 30 | 90 | "custom";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>(30);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const now = new Date();
      const start = new Date(now.getTime() - p * 24 * 60 * 60 * 1000);
      onChange(start, now);
    }
    setIsOpen(false);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      day,
    );

    if (selecting === "start") {
      setTempStart(clickedDate);
      setSelecting("end");
    } else {
      if (tempStart && clickedDate >= tempStart) {
        setPreset("custom");
        onChange(tempStart, clickedDate);
        setIsOpen(false);
        setSelecting("start");
        setTempStart(null);
      } else if (tempStart && clickedDate < tempStart) {
        setTempStart(clickedDate);
        setSelecting("start");
      }
    }
  };

  const isSelected = (day: number) => {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    const d = date.getTime();
    const s = startDate.getTime();
    const e = endDate.getTime();
    return d >= s && d <= e;
  };

  const isInRange = (day: number) => {
    if (!tempStart) return false;
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    const d = date.getTime();
    const s = Math.min(tempStart.getTime(), endDate.getTime());
    const e = Math.max(tempStart.getTime(), startDate.getTime());
    return d >= s && d <= e;
  };

  const isStartOrEnd = (day: number) => {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    const d = date.toDateString();
    return d === startDate.toDateString() || d === endDate.toDateString();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelecting("start");
        setTempStart(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDateRange = () => {
    const format = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${format(startDate)} - ${format(endDate)}`;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        {([7, 30, 90] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              preset === p && !isOpen
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 shadow-md hover:bg-gray-50"
            }`}
          >
            {p} dias
          </button>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            preset === "custom" || isOpen
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 shadow-md hover:bg-gray-50"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {preset === "custom" ? formatDateRange() : "Personalizar"}
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1),
                )
              }
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="font-semibold text-gray-900">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </span>
            <button
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1),
                )
              }
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-xs font-medium text-gray-500">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDaysInMonth(viewMonth).firstDay }).map(
              (_, i) => (
                <div key={`empty-${i}`} />
              ),
            )}
            {Array.from({ length: getDaysInMonth(viewMonth).daysInMonth }).map(
              (_, i) => {
                const day = i + 1;
                const selected = isSelected(day);
                const inRange = isInRange(day);
                const isStartEnd = isStartOrEnd(day);

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`relative rounded-lg p-2 text-sm transition-colors ${
                      isStartEnd
                        ? "bg-blue-600 text-white font-bold"
                        : selected
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : inRange
                            ? "bg-blue-50 text-gray-700"
                            : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              },
            )}
          </div>

          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-xs text-gray-500">
              {selecting === "start"
                ? "Selecione a data inicial"
                : "Selecione a data final"}
            </p>
            <button
              onClick={() => {
                setPreset(30);
                const now = new Date();
                const start = new Date(
                  now.getTime() - 30 * 24 * 60 * 60 * 1000,
                );
                onChange(start, now);
                setIsOpen(false);
              }}
              className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Definir: Últimos 30 dias
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { formatDate } from "@/lib/utils";
import type { Refuel } from "@/types";

interface RefuelCardProps {
  refuel: Refuel;
  onDelete: () => void;
}

export function RefuelCard({ refuel, onDelete }: RefuelCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-md transition-all hover:shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-4 w-4 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
        <span className="text-sm text-gray-500">
          {formatDate(refuel.timestamp)}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-400">Litros</span>
            <span className="text-lg font-bold text-gray-900">
              {refuel.amount.toFixed(2)} L
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-400">Total</span>
            <span className="text-lg font-bold text-gray-900">
              R$ {refuel.totalCost.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TripCard } from "@/components/tracker/TripCard";
import { deleteTrip, getAllTrips } from "@/lib/db";
import type { Trip } from "@/types";

export function History() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      const allTrips = await getAllTrips();
      setTrips(allTrips.filter((t) => t.status === "completed"));
    } catch (err) {
      console.error("Error loading trips:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTripClick = (tripId: string) => {
    navigate(`/history/${tripId}`);
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (window.confirm("Tem certeza que deseja excluir esta viagem?")) {
      await deleteTrip(tripId);
      loadTrips();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 pb-6 pt-12 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Minhas Viagens</h1>
        <p className="mt-1 text-sm text-white/80">
          {trips.length}{" "}
          {trips.length === 1 ? "viagem registrada" : "viagens registradas"}
        </p>
      </header>

      <main className="-mt-4 flex-1 overflow-auto p-4 pt-6">
        {trips.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-lg">
            <div className="mb-4 rounded-full bg-blue-50 p-4">
              <svg
                className="h-16 w-16 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <p className="mb-2 text-lg font-semibold text-gray-900">
              Nenhuma viagem ainda
            </p>
            <p className="text-center text-sm text-gray-500">
              Inicie o rastreamento para registrar sua primeira viagem
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onClick={() => handleTripClick(trip.id)}
                onDelete={() => handleDeleteTrip(trip.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

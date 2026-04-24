"use client";

import { isAndroid } from "@/lib/platform";
import { Tabs } from "@/components/ui/Tabs";
import { CarTab } from "@/components/settings/CarTab";
import { BluetoothTab } from "@/components/settings/BluetoothTab";
import { GpsTab } from "@/components/settings/GpsTab";
import { DeveloperTab } from "@/components/settings/DeveloperTab";
import { AboutTab } from "@/components/settings/AboutTab";
import {
  TruckIcon,
  CpuChipIcon,
  InformationCircleIcon,
  MapPinIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

export function Settings() {
  const tabs = [
    {
      id: "carro",
      label: "Carro",
      icon: <TruckIcon className="w-5 h-5" />,
      content: <CarTab />,
    },
    {
      id: "gps",
      label: "GPS",
      icon: <MapPinIcon className="w-5 h-5" />,
      content: <GpsTab />,
    },
    ...(isAndroid
      ? [
          {
            id: "bluetooth" as const,
            label: "Bluetooth",
            icon: <CpuChipIcon className="w-5 h-5" />,
            content: <BluetoothTab />,
          },
        ]
      : []),
    {
      id: "desenvolvedor",
      label: "Dev",
      icon: <BeakerIcon className="w-5 h-5" />,
      content: <DeveloperTab />,
    },
    {
      id: "sobre",
      label: "Sobre",
      icon: <InformationCircleIcon className="w-5 h-5" />,
      content: <AboutTab />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 pb-6 pt-12 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-white/80">
          Gerencie seus carros e configurações
        </p>
      </header>

      <main className="-mt-4 flex-1 overflow-auto p-4 pt-6">
        <Tabs tabs={tabs} defaultTab="carro" className="mb-4" />
      </main>
    </div>
  );
}
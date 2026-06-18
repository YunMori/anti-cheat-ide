"use client";

import type { Alert } from "../lib/types";

export function AlertStack({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="fixed right-4 top-20 z-50 flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="rounded border border-cyan-700 bg-gray-800 px-4 py-3 text-sm text-cyan-100 shadow-lg"
        >
          {alert.message}
        </div>
      ))}
    </div>
  );
}

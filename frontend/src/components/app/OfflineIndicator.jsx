import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { pendingCount, subscribe, drainQueue } from "@/lib/offlineQueue";
import api from "@/lib/api";
import { toast } from "sonner";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    const refresh = () => pendingCount().then(setPending).catch(() => {});
    refresh();
    const unsub = subscribe(setPending);
    const handler = () => refresh();
    window.addEventListener("khalaba:sync", handler);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("khalaba:sync", handler);
      unsub();
    };
  }, []);

  const manualSync = async () => {
    if (!navigator.onLine) {
      toast.error("Toujours hors ligne — synchronisation impossible");
      return;
    }
    setDraining(true);
    try {
      const res = await drainQueue(api);
      if (res.drained > 0) {
        toast.success(`${res.drained} requête(s) synchronisée(s)`);
      } else if (pending === 0) {
        toast.info("Aucune requête en attente");
      } else {
        toast.warning(`Synchronisation partielle (${res.failed} échec(s))`);
      }
    } finally {
      setDraining(false);
    }
  };

  if (online && pending === 0) {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-[11px] text-[#4A7C59] px-2 py-1 rounded-full bg-[#4A7C59]/10"
        data-testid="offline-indicator-online"
        title="Connecté"
      >
        <Wifi size={12} /> En ligne
      </div>
    );
  }

  if (!online) {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-[11px] text-[#B83A2E] px-2 py-1 rounded-full bg-[#B83A2E]/10"
        data-testid="offline-indicator-offline"
        title={pending > 0 ? `${pending} requête(s) en attente` : "Hors ligne"}
      >
        <WifiOff size={12} /> Hors ligne {pending > 0 && <span className="font-semibold">· {pending}</span>}
      </div>
    );
  }

  // Online but pending > 0 → sync available
  return (
    <button
      onClick={manualSync}
      disabled={draining}
      data-testid="offline-indicator-sync"
      className="inline-flex items-center gap-1.5 text-[11px] text-[#3E2723] px-2 py-1 rounded-full bg-[#F2C94C]/30 hover:bg-[#F2C94C]/50 transition-colors disabled:opacity-50"
      title="Synchroniser les modifications en attente"
    >
      {draining ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
      Synchroniser <span className="font-semibold">{pending}</span>
    </button>
  );
}

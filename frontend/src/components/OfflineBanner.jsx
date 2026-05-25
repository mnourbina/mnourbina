import React, { useEffect, useState } from "react";
import { useNetwork } from "@/lib/network";
import { countPending } from "@/lib/localDb";
import { drainQueue } from "@/lib/syncQueue";
import { useLanguage } from "@/lib/language";
import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { toast } from "sonner";

const LABELS = {
  fr: {
    offline: "Mode hors-ligne activé — vos saisies sont stockées localement et synchronisées dès que le réseau revient.",
    pending: (n) => `${n} action${n > 1 ? "s" : ""} en attente de synchronisation`,
    sync: "Synchroniser",
    syncing: "Synchronisation...",
    synced: (n) => `${n} action${n > 1 ? "s" : ""} synchronisée${n > 1 ? "s" : ""}`,
    failed: (n) => `${n} échec${n > 1 ? "s" : ""}`,
  },
  ar: {
    offline: "وضع عدم الاتصال مفعّل — يتم حفظ بياناتك محلياً ومزامنتها عند عودة الشبكة.",
    pending: (n) => `${n} في انتظار المزامنة`,
    sync: "مزامنة",
    syncing: "جارٍ المزامنة...",
    synced: (n) => `تمت مزامنة ${n}`,
    failed: (n) => `${n} فشل`,
  },
};

export default function OfflineBanner() {
  const isOnline = useNetwork((s) => s.isOnline);
  const lang = useLanguage((s) => s.lang);
  const t = LABELS[lang] || LABELS.fr;
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    const n = await countPending();
    setPending(n);
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, []);

  // Auto-drain when back online
  useEffect(() => {
    if (isOnline && pending > 0 && !syncing) {
      doSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const doSync = async () => {
    setSyncing(true);
    try {
      const { sent, failed } = await drainQueue();
      if (sent > 0) toast.success(t.synced(sent));
      if (failed > 0) toast.error(t.failed(failed));
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  if (isOnline && pending === 0) return null;

  return (
    <div
      data-testid="offline-banner"
      className={`w-full text-sm font-medium ${isOnline ? "bg-secondary text-foreground" : "bg-[#FFB300] text-foreground"} px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? <CloudUpload size={16} /> : <WifiOff size={16} />}
        <span>{isOnline ? t.pending(pending) : t.offline}</span>
      </div>
      <div className="flex items-center gap-3">
        {pending > 0 && !isOnline && (
          <span className="text-xs px-2 py-0.5 rounded bg-foreground/10 font-semibold" data-testid="offline-pending-count">{pending}</span>
        )}
        {isOnline && pending > 0 && (
          <button
            onClick={doSync}
            disabled={syncing}
            data-testid="offline-sync-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
            {syncing ? t.syncing : t.sync}
          </button>
        )}
      </div>
    </div>
  );
}

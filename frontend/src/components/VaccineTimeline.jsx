import React from "react";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default function VaccineTimeline({ doses = [], onAdminister }) {
  if (!doses?.length) {
    return <div className="text-sm text-muted-foreground py-6" data-testid="vaccine-empty">Aucune dose programmee pour le moment.</div>;
  }
  return (
    <ol className="relative border-l-2 border-border ml-3 space-y-4" data-testid="vaccine-timeline">
      {doses.map((d) => {
        const status = d.status;
        const isDone = status === "administered";
        const isLate = status === "late";
        const iconBg = isDone ? "bg-[#2D7D46] text-white" : isLate ? "bg-destructive text-white" : "bg-secondary text-muted-foreground";
        const containerClass = isDone
          ? "border-[#2D7D46]/40 bg-[#2D7D46]/5"
          : isLate
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-background";
        return (
          <li key={d.id} className="ml-6" data-testid={`vaccine-${d.vaccine_code}`}>
            <span className={`absolute -left-[14px] flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-background ${iconBg}`}>
              {isDone ? <CheckCircle2 size={14} /> : isLate ? <AlertTriangle size={14} /> : <Clock size={14} />}
            </span>
            <div className={`p-4 rounded-lg border ${containerClass}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-foreground">{d.vaccine_label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prevue le {new Date(d.scheduled_date).toLocaleDateString("fr-FR")}
                    {d.administered_date && ` · Administree le ${new Date(d.administered_date).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                {!isDone && onAdminister && (
                  <button
                    type="button"
                    onClick={() => onAdminister(d)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    data-testid={`vaccine-administer-${d.id}`}
                  >
                    Marquer fait
                  </button>
                )}
                {isDone && <span className="text-xs font-semibold text-[#2D7D46]">Administre</span>}
                {isLate && !isDone && <span className="text-xs font-semibold text-destructive">En retard</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

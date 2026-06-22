// Pregnancy / CPN clinical calculations (WHO standards)

/**
 * Naegele's rule: EDD = LMP + 7 days - 3 months + 1 year
 */
export function calculateDDR(lmpStr) {
  if (!lmpStr) return null;
  const lmp = new Date(lmpStr);
  const ddr = new Date(lmp);
  ddr.setDate(ddr.getDate() + 7);
  ddr.setMonth(ddr.getMonth() - 3);
  ddr.setFullYear(ddr.getFullYear() + 1);
  return ddr;
}

/**
 * Gestational age in weeks + days from LMP to reference date
 */
export function calculateGestationalAge(lmpStr, refDate = new Date()) {
  if (!lmpStr) return null;
  const lmp = new Date(lmpStr);
  const diff = refDate.getTime() - lmp.getTime();
  if (diff < 0) return null;
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    totalDays,
  };
}

/**
 * WHO 8-contact ANC schedule (week of pregnancy when contact n should occur)
 */
export const WHO_CPN_SCHEDULE = [
  { num: 1, weekMin: 0,  label: "CPN1 — Inscription / 1er trimestre" },
  { num: 2, weekMin: 20, label: "CPN2 — 20 SA" },
  { num: 3, weekMin: 26, label: "CPN3 — 26 SA" },
  { num: 4, weekMin: 30, label: "CPN4 — 30 SA" },
  { num: 5, weekMin: 34, label: "CPN5 — 34 SA" },
  { num: 6, weekMin: 36, label: "CPN6 — 36 SA" },
  { num: 7, weekMin: 38, label: "CPN7 — 38 SA" },
  { num: 8, weekMin: 40, label: "CPN8 — 40 SA" },
];

/**
 * Given the LMP and current CPN number just done, returns the date
 * recommended for the NEXT contact (CPN n+1) per WHO.
 */
export function getNextCPNDate(lmpStr, currentCpn) {
  if (!lmpStr) return null;
  const lmp = new Date(lmpStr);
  const next = WHO_CPN_SCHEDULE.find(s => s.num === currentCpn + 1);
  if (!next) {
    // After CPN8 → estimated delivery day
    const due = new Date(lmp);
    due.setDate(due.getDate() + 280);
    return due;
  }
  const d = new Date(lmp);
  d.setDate(d.getDate() + next.weekMin * 7);
  return { date: d, label: next.label };
}

export function formatDateFr(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateIso(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

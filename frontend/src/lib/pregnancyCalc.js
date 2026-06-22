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
 * WHO 8-contact ANC schedule with windows (weekMin / weekMax).
 * Used by `getNextCPN()` for window-aware scheduling (Brique 6).
 */
export const CPN_SCHEDULE_OMS = [
  { number: 1, weekMin: 0,  weekMax: 12, label: "CPN1 — 1er trimestre" },
  { number: 2, weekMin: 20, weekMax: 24, label: "CPN2 — 2ème trimestre" },
  { number: 3, weekMin: 26, weekMax: 30, label: "CPN3 — 2ème trimestre" },
  { number: 4, weekMin: 30, weekMax: 34, label: "CPN4 — 3ème trimestre" },
  { number: 5, weekMin: 34, weekMax: 36, label: "CPN5 — 3ème trimestre" },
  { number: 6, weekMin: 36, weekMax: 38, label: "CPN6 — 3ème trimestre" },
  { number: 7, weekMin: 38, weekMax: 40, label: "CPN7 — 3ème trimestre" },
  { number: 8, weekMin: 40, weekMax: 42, label: "CPN8 — Post-terme" },
];

/**
 * Window-aware next CPN selector (Brique 6).
 * @param {string} lmpStr - LMP ISO date
 * @param {number[]} doneCpnNumbers - numbers of CPNs already done
 * @returns {object|null} {number, label, weekMin, weekMax, recommendedDate, currentWeek, daysLate}
 */
export function getNextCPN(lmpStr, doneCpnNumbers = []) {
  if (!lmpStr) return null;
  const ga = calculateGestationalAge(lmpStr);
  if (!ga) return null;
  const weeks = ga.weeks;
  const done = new Set(doneCpnNumbers);

  // 1. Prefer the contact whose window contains current GA and that isn't done.
  let next = CPN_SCHEDULE_OMS.find(
    cpn => weeks >= cpn.weekMin && weeks <= cpn.weekMax && !done.has(cpn.number)
  );

  // 2. Fallback: next undone contact after current week
  if (!next) {
    next = CPN_SCHEDULE_OMS.find(cpn => !done.has(cpn.number) && cpn.weekMin >= weeks);
  }
  // 3. Fallback: any undone (we're past schedule)
  if (!next) {
    next = CPN_SCHEDULE_OMS.find(cpn => !done.has(cpn.number));
  }
  if (!next) return null;

  const lmp = new Date(lmpStr);
  const midWeek = Math.floor((next.weekMin + next.weekMax) / 2);
  const recommendedDate = new Date(lmp);
  recommendedDate.setDate(recommendedDate.getDate() + midWeek * 7);

  return {
    ...next,
    recommendedDate,
    currentWeek: weeks,
    daysLate: weeks > next.weekMax ? (weeks - next.weekMax) * 7 : 0,
  };
}

export function isCPNOverdue(nextCPN) {
  return !!(nextCPN && nextCPN.daysLate > 7);
}

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

import React from "react";

/**
 * Khalaba official logo: a mother enveloping her baby in her arms.
 * The curve of the mother's back and arm subtly draws the letter 'K'.
 * A golden heart at the center symbolizes life and clinical attention.
 */
export default function Logo({ size = 36, className = "", withText = true }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Khalaba">
        {/* circular sand background */}
        <circle cx="32" cy="32" r="30" fill="#A95C42" />
        {/* Mother silhouette - back/arm forming K */}
        <path
          d="M18 50 V22 Q18 12 28 12 Q36 12 38 22 L38 32 Q38 38 32 38 Q26 38 26 32"
          stroke="#F9F5F0"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Baby head nestled in arm */}
        <circle cx="33" cy="40" r="5" fill="#D49B7A" stroke="#F9F5F0" strokeWidth="2" />
        {/* Golden heart at center */}
        <path
          d="M42 26 c -2 -3 -6 -3 -6 1 c 0 3 3 5 6 7 c 3 -2 6 -4 6 -7 c 0 -4 -4 -4 -6 -1 z"
          fill="#FFB300"
        />
      </svg>
      {withText && (
        <span className="font-display text-xl font-bold tracking-tight text-foreground">Khalaba</span>
      )}
    </div>
  );
}

import React from "react";

/**
 * Khalaba official logo: mother enveloping baby inside a glowing golden heart.
 * Uses the official PNG artwork hosted in /public.
 */
export default function Logo({ size = 36, className = "", withText = true }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/khalaba-mark.png"
        alt="Khalaba"
        width={size}
        height={size}
        className="rounded-md object-contain"
        style={{ height: size, width: size }}
      />
      {withText && (
        <span className="font-display text-xl font-bold tracking-tight text-foreground">Khalaba</span>
      )}
    </div>
  );
}

import React from "react";

export default function Logo({ size = 40, withText = true }) {
  return (
    <div className="flex items-center gap-3" data-testid="khalaba-logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="KHALABA"
      >
        {/* Mother cradling child silhouette forming 'K' shape */}
        <defs>
          <linearGradient id="khlGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#C85A48" />
            <stop offset="100%" stopColor="#D99A5A" />
          </linearGradient>
          <radialGradient id="khlHeart" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#F2C94C" stopOpacity="1" />
            <stop offset="100%" stopColor="#F2C94C" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Vertical stroke of K (mother body) */}
        <path
          d="M14 8 Q12 10 12 14 L12 50 Q12 54 14 56 L20 56 Q22 54 22 50 L22 14 Q22 10 20 8 Z"
          fill="url(#khlGrad)"
        />
        {/* Curved arm cradling - upper diagonal of K */}
        <path
          d="M22 30 Q34 18 50 8 Q54 8 52 14 Q44 22 34 30 Q44 38 52 50 Q54 56 50 56 Q34 46 22 34 Z"
          fill="url(#khlGrad)"
        />
        {/* Baby head */}
        <circle cx="36" cy="32" r="6" fill="#3E2723" opacity="0.85" />
        {/* Radiant heart */}
        <circle cx="36" cy="32" r="14" fill="url(#khlHeart)" opacity="0.55" />
        <path
          d="M36 36 L33 33 Q31 31 33 29 Q35 28 36 30 Q37 28 39 29 Q41 31 39 33 Z"
          fill="#F2C94C"
        />
      </svg>
      {withText && (
        <span className="font-heading text-[1.45rem] font-semibold tracking-tight text-[#3E2723]">
          KHALABA
        </span>
      )}
    </div>
  );
}

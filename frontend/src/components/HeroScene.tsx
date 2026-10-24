// SPDX-License-Identifier: MIT

/**
 * Hero scene — original artwork: a glowing Bitcoin coin inside an orbital field,
 * over a ridged horizon and a star field. Pure SVG + CSS, no image assets.
 */
export function HeroScene() {
  const stars = [
    [120, 90, 1.6, 0],
    [220, 180, 1.1, 1.4],
    [330, 70, 2.1, 2.6],
    [430, 220, 1.3, 0.7],
    [520, 130, 1.8, 3.2],
    [610, 260, 1.2, 1.9],
    [700, 60, 1.5, 2.2],
    [790, 200, 2.2, 0.4],
    [880, 110, 1.1, 3.6],
    [980, 240, 1.7, 1.1],
    [1060, 80, 1.3, 2.9],
    [1150, 190, 1.9, 0.9],
    [1240, 140, 1.2, 3.3],
    [1330, 250, 1.6, 1.6],
    [70, 320, 1.4, 2.4],
    [1420, 120, 1.5, 0.6],
    [960, 330, 1.1, 3.8],
    [260, 300, 1.5, 2.1],
  ]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#030412]" />

      {/* stars */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice">
        {stars.map(([x, y, r, delay], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill="#ffffff"
            className="animate-twinkle"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </svg>

      {/* orbital field */}
      <svg
        className="animate-spin-slow absolute top-[46%] left-[72%] h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 opacity-45 max-lg:left-1/2"
        viewBox="0 0 200 200"
      >
        <ellipse
          cx="100"
          cy="100"
          rx="96"
          ry="34"
          fill="none"
          stroke="#f7931a"
          strokeOpacity="0.35"
          strokeWidth="0.6"
        />
        <ellipse
          cx="100"
          cy="100"
          rx="78"
          ry="58"
          fill="none"
          stroke="#ffb454"
          strokeOpacity="0.18"
          strokeWidth="0.5"
          transform="rotate(28 100 100)"
        />
        <circle cx="196" cy="100" r="2.4" fill="#ffb454" />
      </svg>

      <svg
        className="animate-spin-slower absolute top-[46%] left-[72%] h-[980px] w-[980px] -translate-x-1/2 -translate-y-1/2 opacity-30 max-lg:left-1/2"
        viewBox="0 0 200 200"
      >
        <ellipse
          cx="100"
          cy="100"
          rx="98"
          ry="40"
          fill="none"
          stroke="#f7931a"
          strokeOpacity="0.3"
          strokeWidth="0.5"
          transform="rotate(-18 100 100)"
        />
        <circle cx="100" cy="2" r="1.8" fill="#f7931a" />
      </svg>

      {/* the coin */}
      <div className="animate-float-slower absolute top-[44%] left-[72%] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 max-lg:left-1/2 max-lg:opacity-70">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <radialGradient id="btc-coin" cx="35%" cy="28%" r="78%">
              <stop offset="0%" stopColor="#ffd9a0" />
              <stop offset="42%" stopColor="#f7931a" />
              <stop offset="100%" stopColor="#8a4c05" />
            </radialGradient>
            <radialGradient id="btc-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f7931a" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#f7931a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#f7931a" stopOpacity="0" />
            </radialGradient>
            <filter id="btc-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="100" cy="100" r="98" fill="url(#btc-halo)" />
          <circle
            cx="100"
            cy="100"
            r="62"
            fill="url(#btc-coin)"
            filter="url(#btc-glow)"
          />
          <circle cx="100" cy="100" r="62" fill="none" stroke="#ffd9a0" strokeOpacity="0.5" strokeWidth="1.4" />
          <circle cx="100" cy="100" r="54" fill="none" stroke="#7a3f02" strokeOpacity="0.4" strokeWidth="0.8" />
          <text
            x="100"
            y="100"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#120a01"
            fontSize="68"
            fontWeight="700"
            fontFamily="Outfit, sans-serif"
          >
            ₿
          </text>
        </svg>
      </div>

      {/* ridged horizon */}
      <svg
        className="absolute bottom-0 left-0 h-[260px] w-full opacity-90"
        viewBox="0 0 1440 260"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ridge-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141634" />
            <stop offset="100%" stopColor="#06061a" />
          </linearGradient>
          <linearGradient id="ridge-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0b1f" />
            <stop offset="100%" stopColor="#030412" />
          </linearGradient>
        </defs>
        <path
          d="M0 168 L120 120 L210 158 L330 92 L430 150 L540 108 L660 158 L790 104 L900 150 L1020 112 L1140 160 L1280 118 L1440 156 L1440 260 L0 260 Z"
          fill="url(#ridge-back)"
        />
        <path
          d="M0 214 L150 176 L280 210 L410 168 L540 206 L680 174 L820 212 L960 180 L1100 214 L1250 182 L1440 210 L1440 260 L0 260 Z"
          fill="url(#ridge-front)"
        />
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(3,4,18,0.94) 0%, rgba(3,4,18,0.72) 34%, rgba(3,4,18,0.18) 62%, rgba(3,4,18,0.66) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 72% 45%, transparent 25%, rgba(3,4,18,0.6) 100%)',
        }}
      />
    </div>
  )
}

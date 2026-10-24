// SPDX-License-Identifier: MIT
import { useMemo } from 'react'

import type { CurvePoint } from '../hooks/usePriceCurve'

/**
 * AMM price curve: marginal price of the traded side (cents) against trade size.
 * Points come from the contract's own `getBuyQuote`, batched in one multicall.
 * Pure SVG, no chart dependency.
 */
export function PriceCurve({
  points,
  markerAmount,
  markerCents,
  className = '',
}: {
  points: CurvePoint[]
  markerAmount: number
  markerCents: number | null
  className?: string
}) {
  const { path, area, markerX, markerY, maxAmount } = useMemo(() => {
    const width = 100
    const height = 44
    const maxPrice = 100

    if (points.length === 0) {
      return { path: '', area: '', markerX: 0, markerY: height, maxAmount: 0 }
    }

    const cap = points[points.length - 1].amount || 1

    const coords = points.map((point) => {
      const px = (point.amount / cap) * width
      const py = height - (Math.min(point.cents, maxPrice) / maxPrice) * height
      return [px, py] as [number, number]
    })

    const line = coords
      .map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`)
      .join(' ')

    const mx = Math.min((markerAmount / cap) * width, width)
    const my =
      markerCents === null
        ? height
        : height - (Math.min(markerCents, maxPrice) / maxPrice) * height

    return {
      path: line,
      area: `${line} L${width},${height} L0,${height} Z`,
      markerX: mx,
      markerY: my,
      maxAmount: cap,
    }
  }, [points, markerAmount, markerCents])

  return (
    <div className={className}>
      <svg
        viewBox="0 0 100 44"
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label="AMM price curve"
      >
        <defs>
          <linearGradient id="annex-curve" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f7931a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffb454" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="annex-curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7931a" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f7931a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[11, 22, 33].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.25"
          />
        ))}

        <path d={area} fill="url(#annex-curve-fill)" />
        <path
          d={path}
          fill="none"
          stroke="url(#annex-curve)"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />

        {markerCents !== null && (
          <>
            <line
              x1={markerX}
              y1="0"
              x2={markerX}
              y2="44"
              stroke="#ffb454"
              strokeWidth="0.35"
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={markerX} cy={markerY} r="1.1" fill="#ffb454" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-annex-muted">
        <span>0 MUSD</span>
        <span>{maxAmount.toFixed(0)} MUSD</span>
      </div>
    </div>
  )
}

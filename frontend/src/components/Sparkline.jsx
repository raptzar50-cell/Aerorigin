import React from 'react'

/**
 * Sparkline
 * Mini trend indicator matching Mantis's stat-card pattern:
 * - Smooth gradient-filled mini SVG area
 * - Directional color (Mantis green for positive, red for negative, blue for neutral)
 */
export default function Sparkline({
  data = [100, 102, 101, 103, 105, 104, 108],
  color = 'var(--color-mantis-primary, #1677FF)',
  gradientId = 'spark-grad',
  width = 96,
  height = 36,
  strokeWidth = 2,
}) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const paddingY = 4

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const y = height - paddingY - ((val - min) / range) * (height - paddingY * 2)
    return { x, y }
  })

  // Build SVG path
  const linePath = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`
  }, '')

  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`
  const uniqueId = `${gradientId}-${Math.random().toString(36).substring(2, 7)}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${uniqueId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

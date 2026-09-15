import React from 'react'
import Sparkline from './Sparkline'

/**
 * StatCard
 * - AdminKit Layout Structure: clean card container, padding, border-radius, subtle shadow
 * - Mantis Visual Chart Styling: sparkline trend indicator inside card with directional gradient
 */
export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  sparklineData,
  delay = 0,
}) {
  const isPositive = typeof change === 'number' ? change > 0 : String(change).startsWith('+')
  const isNegative = typeof change === 'number' ? change < 0 : String(change).startsWith('-')

  // Generate directional micro-trend for sparkline if not explicitly provided
  const sparkPoints = sparklineData || (
    isPositive
      ? [100, 101.5, 101, 102.8, 102.2, 104, 105.5]
      : isNegative
      ? [105, 104.2, 104.8, 102.5, 103, 101.2, 100]
      : [100, 100.8, 100.2, 101, 100.5, 100.9, 101]
  )

  const sparkColor = isPositive
    ? 'var(--color-mantis-success, #52c41a)'
    : isNegative
    ? 'var(--color-mantis-danger, #ff4d4f)'
    : 'var(--color-mantis-primary, #1677ff)'

  return (
    <div
      className="adminkit-card animate-fade-in-up relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </span>
        {icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
            style={{ background: 'var(--color-surface-hover, rgba(0,0,0,0.04))' }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 mt-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: 'var(--color-text)' }}>
          {value ?? <span className="skeleton inline-block w-20 h-7" />}
        </div>

        {/* Mantis-style micro-sparkline */}
        <div className="hidden sm:block pb-1 opacity-90">
          <Sparkline
            data={sparkPoints}
            color={sparkColor}
            width={80}
            height={32}
            strokeWidth={2}
          />
        </div>
      </div>

      {change !== undefined && change !== null && (
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100 dark:border-[#282824]">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums"
            style={{
              backgroundColor: isPositive
                ? 'rgba(82, 196, 26, 0.12)'
                : isNegative
                ? 'rgba(255, 77, 79, 0.12)'
                : 'rgba(22, 119, 255, 0.12)',
              color: isPositive
                ? 'var(--color-mantis-success, #52c41a)'
                : isNegative
                ? 'var(--color-mantis-danger, #ff4d4f)'
                : 'var(--color-mantis-primary, #1677ff)',
            }}
          >
            {isPositive ? '↑ +' : isNegative ? '↓ ' : '• '}
            {typeof change === 'number' ? Math.abs(change).toFixed(2) : change}%
          </span>
          {changeLabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import React from 'react'

/**
 * MantisChartTooltip
 * Recharts custom tooltip styled to match the Mantis React Admin Template look:
 * - Rounded edges (border-radius: 8px)
 * - Subtle floating shadow
 * - Clean typography and contrast
 * - Colored indicator circle for each series
 */
export default function MantisChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (val) => (typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val),
  labelFormatter = (lbl) => lbl,
}) {
  if (!active || !payload || !payload.length) {
    return null
  }

  return (
    <div className="mantis-chart-tooltip animate-fade-in">
      {label && (
        <div className="mantis-chart-tooltip-header">
          {labelFormatter(label)}
        </div>
      )}
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          if (item.value === undefined || item.value === null) return null
          const color = item.color || item.stroke || item.fill || 'var(--color-mantis-primary)'
          return (
            <div key={`item-${index}`} className="mantis-chart-tooltip-row">
              <div className="flex items-center">
                <span
                  className="mantis-chart-tooltip-dot"
                  style={{ backgroundColor: color }}
                />
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {item.name || 'Value'}:
                </span>
              </div>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
                {valueFormatter(item.value, item.dataKey)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

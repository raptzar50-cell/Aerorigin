import React from 'react'

/**
 * ChartCard
 * - AdminKit Layout Structure: Standard card container (padding, shadow depth, border-radius, card-header rhythm)
 * - Encapsulates Recharts components with unified spacing and presentation
 */
export default function ChartCard({
  title,
  subtitle,
  children,
  actions,
  delay = 0,
  className = '',
}) {
  return (
    <div
      className={`adminkit-card animate-fade-in-up flex flex-col justify-between ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || actions) && (
        <div className="adminkit-card-header">
          <div>
            {title && <h3 className="adminkit-card-title">{title}</h3>}
            {subtitle && <p className="adminkit-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="w-full flex-1">
        {children}
      </div>
    </div>
  )
}

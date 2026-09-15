export default function PeriodToggle({ value, onChange }) {
  const periods = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ]

  return (
    <div className="period-toggle">
      {periods.map(p => (
        <button
          key={p.key}
          className={value === p.key ? 'active' : ''}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

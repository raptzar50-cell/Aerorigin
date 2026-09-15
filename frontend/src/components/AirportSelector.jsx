import { useState, useRef, useEffect, useMemo } from 'react'

// ─── Comprehensive airport list: India (domestic) + 70+ international ───
export const POPULAR_AIRPORTS = [
  // ── India ──
  { code: 'DEL', city: 'New Delhi', name: 'Indira Gandhi Intl', country: 'India', region: 'India' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj Intl', country: 'India', region: 'India' },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda Intl', country: 'India', region: 'India' },
  { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi Intl', country: 'India', region: 'India' },
  { code: 'MAA', city: 'Chennai', name: 'Chennai Intl', country: 'India', region: 'India' },
  { code: 'CCU', city: 'Kolkata', name: 'Netaji Subhash Chandra Bose Intl', country: 'India', region: 'India' },
  { code: 'GOI', city: 'Goa', name: 'Manohar Intl', country: 'India', region: 'India' },
  { code: 'PNQ', city: 'Pune', name: 'Pune Intl', country: 'India', region: 'India' },
  { code: 'AMD', city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel Intl', country: 'India', region: 'India' },
  { code: 'JAI', city: 'Jaipur', name: 'Jaipur Intl', country: 'India', region: 'India' },
  { code: 'COK', city: 'Kochi', name: 'Cochin Intl', country: 'India', region: 'India' },
  { code: 'LKO', city: 'Lucknow', name: 'Chaudhary Charan Singh Intl', country: 'India', region: 'India' },
  { code: 'GAU', city: 'Guwahati', name: 'Lokpriya Gopinath Bordoloi Intl', country: 'India', region: 'India' },
  { code: 'PAT', city: 'Patna', name: 'Jay Prakash Narayan Airport', country: 'India', region: 'India' },
  { code: 'BBI', city: 'Bhubaneswar', name: 'Biju Patnaik Airport', country: 'India', region: 'India' },
  { code: 'TRV', city: 'Thiruvananthapuram', name: 'Trivandrum Intl', country: 'India', region: 'India' },
  { code: 'IXC', city: 'Chandigarh', name: 'Shaheed Bhagat Singh Intl', country: 'India', region: 'India' },
  { code: 'VNS', city: 'Varanasi', name: 'Lal Bahadur Shastri Intl', country: 'India', region: 'India' },
  { code: 'ATQ', city: 'Amritsar', name: 'Sri Guru Ram Dass Jee Intl', country: 'India', region: 'India' },
  { code: 'SXR', city: 'Srinagar', name: 'Sheikh ul-Alam Intl', country: 'India', region: 'India' },
  { code: 'IXB', city: 'Bagdogra', name: 'Bagdogra Airport', country: 'India', region: 'India' },
  { code: 'IDR', city: 'Indore', name: 'Devi Ahilyabai Holkar Airport', country: 'India', region: 'India' },
  { code: 'NAG', city: 'Nagpur', name: 'Dr. Babasaheb Ambedkar Intl', country: 'India', region: 'India' },
  { code: 'IXR', city: 'Ranchi', name: 'Birsa Munda Airport', country: 'India', region: 'India' },
  { code: 'RPR', city: 'Raipur', name: 'Swami Vivekananda Airport', country: 'India', region: 'India' },
  { code: 'UDR', city: 'Udaipur', name: 'Maharana Pratap Airport', country: 'India', region: 'India' },
  { code: 'DED', city: 'Dehradun', name: 'Jolly Grant Airport', country: 'India', region: 'India' },
  { code: 'VTZ', city: 'Visakhapatnam', name: 'Visakhapatnam Airport', country: 'India', region: 'India' },
  { code: 'IXM', city: 'Madurai', name: 'Madurai Airport', country: 'India', region: 'India' },
  { code: 'CJB', city: 'Coimbatore', name: 'Coimbatore Intl', country: 'India', region: 'India' },
  { code: 'IXE', city: 'Mangalore', name: 'Mangalore Intl', country: 'India', region: 'India' },
  { code: 'TRZ', city: 'Tiruchirappalli', name: 'Trichy Intl', country: 'India', region: 'India' },
  { code: 'JDH', city: 'Jodhpur', name: 'Jodhpur Airport', country: 'India', region: 'India' },
  { code: 'IXL', city: 'Leh', name: 'Kushok Bakula Rimpochee Airport', country: 'India', region: 'India' },
  { code: 'STV', city: 'Surat', name: 'Surat Airport', country: 'India', region: 'India' },
  { code: 'RAJ', city: 'Rajkot', name: 'Rajkot Airport', country: 'India', region: 'India' },
  { code: 'BDQ', city: 'Vadodara', name: 'Vadodara Airport', country: 'India', region: 'India' },
  { code: 'IXA', city: 'Agartala', name: 'Maharaja Bir Bikram Airport', country: 'India', region: 'India' },
  { code: 'IMF', city: 'Imphal', name: 'Bir Tikendrajit Intl', country: 'India', region: 'India' },
  { code: 'DIB', city: 'Dibrugarh', name: 'Dibrugarh Airport', country: 'India', region: 'India' },
  { code: 'IXJ', city: 'Jammu', name: 'Jammu Airport', country: 'India', region: 'India' },
  { code: 'HBX', city: 'Hubli', name: 'Hubli Airport', country: 'India', region: 'India' },
  { code: 'KLR', city: 'Kolhapur', name: 'Kolhapur Airport', country: 'India', region: 'India' },
  { code: 'BHO', city: 'Bhopal', name: 'Raja Bhoj Airport', country: 'India', region: 'India' },
  { code: 'JLR', city: 'Jabalpur', name: 'Jabalpur Airport', country: 'India', region: 'India' },
  { code: 'GWL', city: 'Gwalior', name: 'Gwalior Airport', country: 'India', region: 'India' },
  { code: 'IXZ', city: 'Port Blair', name: 'Veer Savarkar Intl', country: 'India', region: 'India' },
  { code: 'DHM', city: 'Dharamshala', name: 'Gaggal Airport', country: 'India', region: 'India' },
  { code: 'KQH', city: 'Kishangarh', name: 'Kishangarh Airport (Ajmer)', country: 'India', region: 'India' },

  // ── South Asia ──
  { code: 'DAC', city: 'Dhaka', name: 'Hazrat Shahjalal Intl', country: 'Bangladesh', region: 'South Asia' },
  { code: 'KTM', city: 'Kathmandu', name: 'Tribhuvan Intl', country: 'Nepal', region: 'South Asia' },
  { code: 'CMB', city: 'Colombo', name: 'Bandaranaike Intl', country: 'Sri Lanka', region: 'South Asia' },
  { code: 'MLE', city: 'Malé', name: 'Velana Intl', country: 'Maldives', region: 'South Asia' },
  { code: 'ISB', city: 'Islamabad', name: 'Islamabad Intl', country: 'Pakistan', region: 'South Asia' },
  { code: 'KHI', city: 'Karachi', name: 'Jinnah Intl', country: 'Pakistan', region: 'South Asia' },
  { code: 'LHE', city: 'Lahore', name: 'Allama Iqbal Intl', country: 'Pakistan', region: 'South Asia' },

  // ── Middle East ──
  { code: 'DXB', city: 'Dubai', name: 'Dubai Intl', country: 'UAE', region: 'Middle East' },
  { code: 'AUH', city: 'Abu Dhabi', name: 'Zayed Intl', country: 'UAE', region: 'Middle East' },
  { code: 'SHJ', city: 'Sharjah', name: 'Sharjah Intl', country: 'UAE', region: 'Middle East' },
  { code: 'DOH', city: 'Doha', name: 'Hamad Intl', country: 'Qatar', region: 'Middle East' },
  { code: 'RUH', city: 'Riyadh', name: 'King Khalid Intl', country: 'Saudi Arabia', region: 'Middle East' },
  { code: 'JED', city: 'Jeddah', name: 'King Abdulaziz Intl', country: 'Saudi Arabia', region: 'Middle East' },
  { code: 'DMM', city: 'Dammam', name: 'King Fahd Intl', country: 'Saudi Arabia', region: 'Middle East' },
  { code: 'MCT', city: 'Muscat', name: 'Muscat Intl', country: 'Oman', region: 'Middle East' },
  { code: 'BAH', city: 'Bahrain', name: 'Bahrain Intl', country: 'Bahrain', region: 'Middle East' },
  { code: 'KWI', city: 'Kuwait City', name: 'Kuwait Intl', country: 'Kuwait', region: 'Middle East' },
  { code: 'TLV', city: 'Tel Aviv', name: 'Ben Gurion Intl', country: 'Israel', region: 'Middle East' },

  // ── Southeast Asia ──
  { code: 'SIN', city: 'Singapore', name: 'Changi Airport', country: 'Singapore', region: 'Southeast Asia' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi Intl', country: 'Thailand', region: 'Southeast Asia' },
  { code: 'KUL', city: 'Kuala Lumpur', name: 'KL Intl (KLIA)', country: 'Malaysia', region: 'Southeast Asia' },
  { code: 'CGK', city: 'Jakarta', name: 'Soekarno–Hatta Intl', country: 'Indonesia', region: 'Southeast Asia' },
  { code: 'DPS', city: 'Bali', name: 'Ngurah Rai Intl', country: 'Indonesia', region: 'Southeast Asia' },
  { code: 'SGN', city: 'Ho Chi Minh City', name: 'Tan Son Nhat Intl', country: 'Vietnam', region: 'Southeast Asia' },
  { code: 'HAN', city: 'Hanoi', name: 'Noi Bai Intl', country: 'Vietnam', region: 'Southeast Asia' },
  { code: 'MNL', city: 'Manila', name: 'Ninoy Aquino Intl', country: 'Philippines', region: 'Southeast Asia' },
  { code: 'RGN', city: 'Yangon', name: 'Yangon Intl', country: 'Myanmar', region: 'Southeast Asia' },
  { code: 'PNH', city: 'Phnom Penh', name: 'Phnom Penh Intl', country: 'Cambodia', region: 'Southeast Asia' },

  // ── East Asia ──
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong Intl', country: 'Hong Kong', region: 'East Asia' },
  { code: 'ICN', city: 'Seoul', name: 'Incheon Intl', country: 'South Korea', region: 'East Asia' },
  { code: 'NRT', city: 'Tokyo', name: 'Narita Intl', country: 'Japan', region: 'East Asia' },
  { code: 'HND', city: 'Tokyo', name: 'Haneda Airport', country: 'Japan', region: 'East Asia' },
  { code: 'KIX', city: 'Osaka', name: 'Kansai Intl', country: 'Japan', region: 'East Asia' },
  { code: 'PEK', city: 'Beijing', name: 'Capital Intl', country: 'China', region: 'East Asia' },
  { code: 'PVG', city: 'Shanghai', name: 'Pudong Intl', country: 'China', region: 'East Asia' },
  { code: 'TPE', city: 'Taipei', name: 'Taiwan Taoyuan Intl', country: 'Taiwan', region: 'East Asia' },

  // ── Europe ──
  { code: 'LHR', city: 'London', name: 'Heathrow', country: 'United Kingdom', region: 'Europe' },
  { code: 'LGW', city: 'London', name: 'Gatwick', country: 'United Kingdom', region: 'Europe' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France', region: 'Europe' },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt Airport', country: 'Germany', region: 'Europe' },
  { code: 'AMS', city: 'Amsterdam', name: 'Schiphol', country: 'Netherlands', region: 'Europe' },
  { code: 'ZRH', city: 'Zurich', name: 'Zurich Airport', country: 'Switzerland', region: 'Europe' },
  { code: 'FCO', city: 'Rome', name: 'Leonardo da Vinci–Fiumicino', country: 'Italy', region: 'Europe' },
  { code: 'IST', city: 'Istanbul', name: 'Istanbul Airport', country: 'Turkey', region: 'Europe' },
  { code: 'BCN', city: 'Barcelona', name: 'El Prat', country: 'Spain', region: 'Europe' },
  { code: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid–Barajas', country: 'Spain', region: 'Europe' },
  { code: 'MUC', city: 'Munich', name: 'Munich Airport', country: 'Germany', region: 'Europe' },
  { code: 'VIE', city: 'Vienna', name: 'Vienna Intl', country: 'Austria', region: 'Europe' },
  { code: 'CPH', city: 'Copenhagen', name: 'Copenhagen Airport', country: 'Denmark', region: 'Europe' },
  { code: 'HEL', city: 'Helsinki', name: 'Helsinki-Vantaa', country: 'Finland', region: 'Europe' },

  // ── Americas ──
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy Intl', country: 'United States', region: 'Americas' },
  { code: 'EWR', city: 'Newark', name: 'Newark Liberty Intl', country: 'United States', region: 'Americas' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles Intl', country: 'United States', region: 'Americas' },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco Intl', country: 'United States', region: 'Americas' },
  { code: 'ORD', city: 'Chicago', name: "O'Hare Intl", country: 'United States', region: 'Americas' },
  { code: 'IAD', city: 'Washington D.C.', name: 'Dulles Intl', country: 'United States', region: 'Americas' },
  { code: 'YYZ', city: 'Toronto', name: 'Pearson Intl', country: 'Canada', region: 'Americas' },
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver Intl', country: 'Canada', region: 'Americas' },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos Intl', country: 'Brazil', region: 'Americas' },

  // ── Oceania ──
  { code: 'SYD', city: 'Sydney', name: 'Kingsford Smith', country: 'Australia', region: 'Oceania' },
  { code: 'MEL', city: 'Melbourne', name: 'Melbourne Airport', country: 'Australia', region: 'Oceania' },
  { code: 'AKL', city: 'Auckland', name: 'Auckland Airport', country: 'New Zealand', region: 'Oceania' },
  { code: 'PER', city: 'Perth', name: 'Perth Airport', country: 'Australia', region: 'Oceania' },

  // ── Africa ──
  { code: 'JNB', city: 'Johannesburg', name: 'O.R. Tambo Intl', country: 'South Africa', region: 'Africa' },
  { code: 'NBO', city: 'Nairobi', name: 'Jomo Kenyatta Intl', country: 'Kenya', region: 'Africa' },
  { code: 'ADD', city: 'Addis Ababa', name: 'Bole Intl', country: 'Ethiopia', region: 'Africa' },
  { code: 'CAI', city: 'Cairo', name: 'Cairo Intl', country: 'Egypt', region: 'Africa' },
  { code: 'DSS', city: 'Dakar', name: 'Blaise Diagne Intl', country: 'Senegal', region: 'Africa' },

  // ── Central Asia ──
  { code: 'TAS', city: 'Tashkent', name: 'Islam Karimov Tashkent Intl', country: 'Uzbekistan', region: 'Central Asia' },
  { code: 'ALA', city: 'Almaty', name: 'Almaty Intl', country: 'Kazakhstan', region: 'Central Asia' },
]

// Region display order for grouped view
const REGION_ORDER = ['India', 'South Asia', 'Middle East', 'Southeast Asia', 'East Asia', 'Europe', 'Americas', 'Oceania', 'Africa', 'Central Asia']
const REGION_ICONS = {
  'India': '🇮🇳',
  'South Asia': '🌏',
  'Middle East': '🏜️',
  'Southeast Asia': '🌴',
  'East Asia': '🏯',
  'Europe': '🏰',
  'Americas': '🗽',
  'Oceania': '🦘',
  'Africa': '🌍',
  'Central Asia': '🏔️',
}

export default function AirportSelector({ value, onChange, label, placeholder = 'Select Airport', excludeCode = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  const selectedAirport = POPULAR_AIRPORTS.find(a => a.code === value) || { code: value, city: value, name: '', country: '', region: '' }

  const filtered = useMemo(() => {
    return POPULAR_AIRPORTS.filter(a => {
      if (excludeCode && a.code === excludeCode) return false
      if (!query) return true
      const q = query.toLowerCase()
      return a.code.toLowerCase().includes(q) ||
             a.city.toLowerCase().includes(q) ||
             a.name.toLowerCase().includes(q) ||
             (a.country && a.country.toLowerCase().includes(q)) ||
             (a.region && a.region.toLowerCase().includes(q))
    })
  }, [query, excludeCode])

  // Group filtered results by region
  const grouped = useMemo(() => {
    const groups = {}
    for (const apt of filtered) {
      const region = apt.region || 'Other'
      if (!groups[region]) groups[region] = []
      groups[region].push(apt)
    }
    // Sort by region order
    return REGION_ORDER
      .filter(r => groups[r])
      .map(r => ({ region: r, airports: groups[r] }))
  }, [filtered])

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isInternational = selectedAirport.region && selectedAirport.region !== 'India'

  return (
    <div className="relative flex-1 min-w-[160px]" ref={containerRef}>
      {label && (
        <label className="text-xs font-semibold mb-1 block uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}

      {/* Selector trigger button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all"
        style={{
          background: 'var(--color-surface)',
          borderColor: open ? 'var(--color-brand-yellow)' : 'var(--color-border)',
          boxShadow: open ? '0 0 0 2px rgba(245, 166, 35, 0.2)' : 'none',
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-base font-bold font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(245, 166, 35, 0.15)', color: 'var(--color-brand-yellow)' }}>
            {selectedAirport.code || '---'}
          </span>
          <div className="truncate">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--color-text)' }}>
              {selectedAirport.city || placeholder}
              {isInternational && <span className="ml-1 text-[10px]">🌍</span>}
            </p>
            {selectedAirport.name && (
              <p className="text-xs truncate leading-tight" style={{ color: 'var(--color-text-light)' }}>
                {selectedAirport.name}{selectedAirport.country && selectedAirport.country !== 'India' ? ` · ${selectedAirport.country}` : ''}
              </p>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-secondary)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Autocomplete Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border overflow-hidden animate-fade-in-up"
          style={{
            background: 'var(--color-bg-card, #1A1A18)',
            backgroundColor: 'var(--color-bg-card, #1A1A18)',
            borderColor: 'var(--color-border)',
            minWidth: '320px',
            maxHeight: '380px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px var(--color-border)',
          }}
        >
          <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card, #1A1A18)', backgroundColor: 'var(--color-bg-card, #1A1A18)' }}>
            <input
              type="text"
              autoFocus
              placeholder="Search city, airport, or country..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 rounded-lg border outline-none"
              style={{
                background: 'var(--color-bg, #0F0F0E)',
                backgroundColor: 'var(--color-bg, #0F0F0E)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div className="overflow-y-auto max-h-[310px] p-1" style={{ background: 'var(--color-bg-card, #1A1A18)', backgroundColor: 'var(--color-bg-card, #1A1A18)' }}>
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                No airports found — try a city name or IATA code
              </div>
            ) : (
              grouped.map(group => (
                <div key={group.region}>
                  {/* Region header */}
                  <div className="px-2.5 pt-2.5 pb-1 flex items-center gap-1.5 sticky top-0 z-10"
                       style={{ background: 'var(--color-bg-card, #1A1A18)', backgroundColor: 'var(--color-bg-card, #1A1A18)' }}>
                    <span className="text-[11px]">{REGION_ICONS[group.region] || '✈️'}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: group.region === 'India' ? 'var(--color-brand-yellow)' : 'var(--color-text-secondary)' }}>
                      {group.region}
                    </span>
                    <span className="text-[9px] font-medium ml-auto"
                          style={{ color: 'var(--color-text-light)' }}>
                      {group.airports.length}
                    </span>
                  </div>

                  {group.airports.map(apt => {
                    const isIntl = apt.region !== 'India'
                    return (
                      <button
                        key={apt.code}
                        type="button"
                        onClick={() => {
                          onChange(apt.code)
                          setOpen(false)
                          setQuery('')
                        }}
                        className="w-full text-left p-2.5 rounded-lg flex items-center justify-between hover:opacity-90 transition-colors"
                        style={{
                          background: apt.code === value ? 'rgba(245, 166, 35, 0.12)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (apt.code !== value) e.currentTarget.style.background = 'var(--color-surface-hover, rgba(255,255,255,0.05))'
                        }}
                        onMouseLeave={(e) => {
                          if (apt.code !== value) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  background: apt.code === value ? 'var(--color-brand-yellow)' : 'var(--color-bg)',
                                  color: apt.code === value ? '#000' : 'var(--color-text)',
                                }}>
                            {apt.code}
                          </span>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                              {apt.city}
                              {isIntl && <span className="ml-1 text-[9px] opacity-70">🌍</span>}
                            </p>
                            <p className="text-[11px] truncate max-w-[180px]" style={{ color: 'var(--color-text-secondary)' }}>
                              {apt.name}{isIntl ? ` · ${apt.country}` : ''}
                            </p>
                          </div>
                        </div>
                        {apt.code === value && (
                          <span className="text-xs font-bold" style={{ color: 'var(--color-brand-yellow)' }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

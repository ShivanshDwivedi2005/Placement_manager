import { Search, Filter, X } from 'lucide-react'

export default function FilterBar({ filters, setFilters, departments = [], onReset }) {
  const inputCls = `
    w-full px-3 py-2 rounded-xl text-sm outline-none transition-all
    focus:ring-1 focus:ring-green-500/40
  `
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>
          <Filter size={14} />
          Filters
        </div>
        <button onClick={onReset} className="text-xs flex items-center gap-1 transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>
          <X size={12} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            className={inputCls}
            style={{ ...inputStyle, paddingLeft: '2rem' }}
            placeholder="Search name / BT-ID…"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>

        {/* Department */}
        <select
          className={inputCls}
          style={inputStyle}
          value={filters.department}
          onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* CGPA Range */}
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" max="10" step="0.1"
            className={inputCls} style={inputStyle}
            placeholder="CGPA min"
            value={filters.cgpa_min}
            onChange={(e) => setFilters(f => ({ ...f, cgpa_min: e.target.value }))}
          />
          <span style={{ color: 'var(--muted)' }}>–</span>
          <input
            type="number" min="0" max="10" step="0.1"
            className={inputCls} style={inputStyle}
            placeholder="max"
            value={filters.cgpa_max}
            onChange={(e) => setFilters(f => ({ ...f, cgpa_max: e.target.value }))}
          />
        </div>

        {/* Max Backlogs */}
        <select
          className={inputCls}
          style={inputStyle}
          value={filters.max_backlogs}
          onChange={(e) => setFilters(f => ({ ...f, max_backlogs: e.target.value }))}
        >
          <option value="">Any Backlogs</option>
          <option value="0">No Backlogs</option>
          <option value="1">Max 1</option>
          <option value="2">Max 2</option>
          <option value="3">Max 3</option>
        </select>
      </div>
    </div>
  )
}

export default function StatCard({ label, value, icon: Icon, color = '#22c55e', sub }) {
  return (
    <div className="rounded-2xl p-5 flex items-start gap-4 transition-all hover:scale-[1.01]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-semibold text-white leading-none">{value ?? '—'}</div>
        <div className="text-xs mt-1.5 font-medium" style={{ color: 'var(--muted)' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)', opacity: 0.6 }}>{sub}</div>}
      </div>
    </div>
  )
}

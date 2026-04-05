export default function Table({ columns, rows, emptyMsg = 'No data', loading = false }) {
  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 shimmer" style={{ borderBottom: '1px solid var(--border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap"
                  style={{ color: 'var(--muted)' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : (
                        <span style={{ color: row[col.key] ? 'var(--text)' : 'var(--muted)' }}>
                          {row[col.key] ?? '—'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

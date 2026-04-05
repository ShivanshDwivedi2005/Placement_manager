import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Minus, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

import Table from '../components/Table'
import DatasetUploadCard from '../components/upload/DatasetUploadCard'
import api from '../utils/api'

const GRID_COLUMNS = [
  { key: 'bt_id', label: 'BT-ID *', placeholder: 'BT21CS001' },
  { key: 'name', label: 'Name', placeholder: 'Full name' },
  { key: 'company', label: 'Company', placeholder: 'Google' },
  { key: 'job_profile', label: 'Job Profile', placeholder: 'SDE Intern' },
  { key: 'duration', label: 'Duration', placeholder: '6 months' },
  { key: 'stipend', label: 'Stipend', placeholder: '25000' },
]

const EMPTY_ROW = Object.fromEntries(GRID_COLUMNS.map((column) => [column.key, '']))

function createRows(count = 8) {
  return Array.from({ length: count }, () => ({ ...EMPTY_ROW }))
}

function hasValue(row) {
  return Object.values(row).some((value) => String(value || '').trim() !== '')
}

function hasAddRequiredValue(row) {
  return String(row.bt_id || '').trim() && String(row.name || '').trim()
}

function hasRemoveRequiredValue(row) {
  return String(row.bt_id || '').trim()
}

function normalizeGridRows(rows, minRows = 8) {
  const filledRows = rows.filter((row) => hasValue(row))
  const blankRowsNeeded = Math.max(minRows - filledRows.length, 2)
  return [...filledRows, ...createRows(blankRowsNeeded)]
}

function GridPanel({
  title,
  helper,
  rows,
  setRows,
  onClose,
  onSave,
  saving,
  accent,
  actionLabel,
  readyCount,
}) {
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }

  const updateCell = (rowIndex, key, value) => {
    setRows((current) => {
      const next = current.map((row, index) => index === rowIndex ? { ...row, [key]: value } : row)
      return normalizeGridRows(next)
    })
  }

  const handleGridPaste = (event, rowIndex, columnIndex) => {
    const pastedText = event.clipboardData.getData('text')
    if (!pastedText.includes('\t') && !pastedText.includes('\n')) return

    event.preventDefault()
    const parsedRows = pastedText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'))

    setRows((current) => {
      const next = [...current]
      const requiredLength = rowIndex + parsedRows.length + 2
      while (next.length < requiredLength) next.push({ ...EMPTY_ROW })

      parsedRows.forEach((cells, rowOffset) => {
        const targetIndex = rowIndex + rowOffset
        const nextRow = { ...next[targetIndex] }
        cells.forEach((cellValue, cellOffset) => {
          const targetColumn = GRID_COLUMNS[columnIndex + cellOffset]
          if (targetColumn) nextRow[targetColumn.key] = cellValue.trim()
        })
        next[targetIndex] = nextRow
      })

      return normalizeGridRows(next)
    })
  }

  return (
    <div className="rounded-2xl p-5 space-y-4 fade-up" style={{ background: 'var(--surface)', border: `1px solid ${accent}` }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{helper}</p>
        </div>
        <button type="button" onClick={onClose} style={{ color: 'var(--muted)' }}>
          <X size={14} />
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {GRID_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="text-left px-3 py-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap"
                    style={{ color: 'var(--muted)' }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: '1px solid var(--border)' }}>
                  {GRID_COLUMNS.map((column, columnIndex) => (
                    <td key={column.key} className="p-1.5 min-w-40">
                      <input
                        value={row[column.key]}
                        onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                        onPaste={(event) => handleGridPaste(event, rowIndex, columnIndex)}
                        placeholder={column.placeholder}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-green-500/30"
                        style={inputStyle}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {readyCount} row(s) ready
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRows(createRows())}
            className="text-sm px-4 py-2 rounded-xl transition-all hover:bg-white/5"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            Clear Grid
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            style={{ background: `${accent}20`, color: accent === 'rgba(244,63,94,0.35)' ? '#fb7185' : '#4ade80', border: `1px solid ${accent}` }}
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? 'Processing...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlacedStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddGrid, setShowAddGrid] = useState(false)
  const [addGridRows, setAddGridRows] = useState(createRows())
  const [savingAddGrid, setSavingAddGrid] = useState(false)
  const [showRemoveGrid, setShowRemoveGrid] = useState(false)
  const [removeGridRows, setRemoveGridRows] = useState(createRows())
  const [savingRemoveGrid, setSavingRemoveGrid] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [sourceFilename, setSourceFilename] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [placementQuery, setPlacementQuery] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/placed/')
      setStudents(data.students)
      setLastSync(data.last_sync)
      setSourceFilename(data.source_filename)
    } catch (_) {
      toast.error('Failed to load placed students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filledAddGridRows = useMemo(() => addGridRows.filter((row) => hasValue(row)), [addGridRows])
  const filledRemoveGridRows = useMemo(() => removeGridRows.filter((row) => hasValue(row)), [removeGridRows])
  const normalizedPlacementQuery = placementQuery.trim().toLowerCase()
  const visibleStudents = useMemo(() => {
    if (!normalizedPlacementQuery) return students
    return students.filter((student) => {
      const btId = String(student['BT-ID'] || '').toLowerCase()
      const name = String(student.Name || '').toLowerCase()
      return btId.includes(normalizedPlacementQuery) || name.includes(normalizedPlacementQuery)
    })
  }, [normalizedPlacementQuery, students])

  const handleDelete = async (btId) => {
    if (!window.confirm(`Remove ${btId} from placed students?`)) return
    setDeleting(btId)
    try {
      await api.delete(`/placed/${btId}`)
      toast.success(`${btId} removed`)
      load()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove student')
    } finally {
      setDeleting(null)
    }
  }

  const handleSaveAddGrid = async () => {
    const rowsToSave = filledAddGridRows
      .filter((row) => hasAddRequiredValue(row))
      .map((row) => ({
        bt_id: row.bt_id.trim(),
        name: row.name.trim(),
        company: row.company.trim(),
        job_profile: row.job_profile.trim(),
        duration: row.duration.trim(),
        stipend: row.stipend.trim(),
      }))

    if (!rowsToSave.length) {
      toast.error('Paste or enter at least one row with BT-ID and Name')
      return
    }

    setSavingAddGrid(true)
    try {
      const { data } = await api.post('/placed/bulk', rowsToSave)
      toast.success(`${data.added} students saved`)
      setAddGridRows(createRows())
      setShowAddGrid(false)
      load()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save students')
    } finally {
      setSavingAddGrid(false)
    }
  }

  const handleSaveRemoveGrid = async () => {
    const rowsToRemove = filledRemoveGridRows
      .filter((row) => hasRemoveRequiredValue(row))
      .map((row) => ({
        bt_id: row.bt_id.trim(),
        name: row.name.trim(),
        company: row.company.trim(),
        job_profile: row.job_profile.trim(),
        duration: row.duration.trim(),
        stipend: row.stipend.trim(),
      }))

    if (!rowsToRemove.length) {
      toast.error('Paste or enter at least one row with BT-ID')
      return
    }

    setSavingRemoveGrid(true)
    try {
      const { data } = await api.post('/placed/bulk-remove', rowsToRemove)
      const summary = data.not_found
        ? `${data.removed} removed, ${data.not_found} not found`
        : `${data.removed} students removed`
      toast.success(summary)
      setRemoveGridRows(createRows())
      setShowRemoveGrid(false)
      load()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove students')
    } finally {
      setSavingRemoveGrid(false)
    }
  }

  const columns = [
    {
      key: 'BT-ID',
      label: 'BT-ID',
      render: (value) => (
        <span className="font-mono text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--surface2)', color: '#60a5fa' }}>
          {value}
        </span>
      ),
    },
    { key: 'Name', label: 'Name', render: (value) => <span className="font-medium text-white">{value}</span> },
    { key: 'Company', label: 'Company', render: (value) => <span style={{ color: '#4ade80' }}>{value || '—'}</span> },
    { key: 'Job Profile', label: 'Job Profile', render: (value) => <span style={{ color: 'var(--text)' }}>{value || '—'}</span> },
    { key: 'Duration', label: 'Duration', render: (value) => <span style={{ color: 'var(--text)' }}>{value || '—'}</span> },
    { key: 'Stipend', label: 'Stipend', render: (value) => value ? `₹ ${value}` : '—' },
    {
      key: 'BT-ID',
      label: '',
      render: (value) => (
        <button
          onClick={() => handleDelete(value)}
          disabled={deleting === value}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-40"
          style={{ color: 'var(--muted)' }}
        >
          {deleting === value ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Remove
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display text-white">Placed Students</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Persistent placed list stored in PostgreSQL and editable anytime
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddGrid((current) => !current)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <Plus size={14} /> Add Students
          </button>
          <button
            onClick={() => setShowRemoveGrid((current) => !current)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all"
            style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)' }}
          >
            <Minus size={14} /> Remove Students
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl transition-all hover:bg-white/5 disabled:opacity-50"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <DatasetUploadCard
        title="Initial Placed Students Import"
        description="Upload the placed file once. You can still paste rows below any time to add or remove in bulk."
        endpoint="/placed/upload"
        accent="#22c55e"
        buttonLabel="Import Placed Students File"
        onSuccess={load}
      />

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-sm font-semibold text-white">Quick Placement Check</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Type a BT-ID or name to confirm whether that student already exists in the placed list.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 rounded-xl" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <Search size={14} style={{ color: 'var(--muted)' }} />
          <input
            value={placementQuery}
            onChange={(event) => setPlacementQuery(event.target.value)}
            placeholder="Search by BT-ID or name"
            className="w-full bg-transparent py-3 text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>

        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: normalizedPlacementQuery
              ? visibleStudents.length > 0
                ? 'rgba(34,197,94,0.08)'
                : 'rgba(244,63,94,0.08)'
              : 'var(--surface2)',
            border: normalizedPlacementQuery
              ? visibleStudents.length > 0
                ? '1px solid rgba(34,197,94,0.25)'
                : '1px solid rgba(244,63,94,0.25)'
              : '1px solid var(--border)',
            color: normalizedPlacementQuery
              ? visibleStudents.length > 0
                ? '#4ade80'
                : '#fb7185'
              : 'var(--muted)',
          }}
        >
          {!normalizedPlacementQuery && 'Enter a BT-ID or name to check placement status.'}
          {normalizedPlacementQuery && visibleStudents.length > 0 && `${visibleStudents.length} matching student(s) found in the placed list.`}
          {normalizedPlacementQuery && visibleStudents.length === 0 && 'No student found in the placed list for this BT-ID or name.'}
        </div>
      </div>

      {showAddGrid && (
        <GridPanel
          title="Spreadsheet Add"
          helper="Paste directly from Excel into any cell. Rows without both BT-ID and Name will be ignored."
          rows={addGridRows}
          setRows={setAddGridRows}
          onClose={() => setShowAddGrid(false)}
          onSave={handleSaveAddGrid}
          saving={savingAddGrid}
          accent="rgba(34,197,94,0.35)"
          actionLabel="Save All Rows"
          readyCount={filledAddGridRows.length}
        />
      )}

      {showRemoveGrid && (
        <GridPanel
          title="Spreadsheet Remove"
          helper="Paste the same Excel-style rows here. Only the BT-ID column is used for removal, other columns are optional."
          rows={removeGridRows}
          setRows={setRemoveGridRows}
          onClose={() => setShowRemoveGrid(false)}
          onSave={handleSaveRemoveGrid}
          saving={savingRemoveGrid}
          accent="rgba(244,63,94,0.35)"
          actionLabel="Remove All Rows"
          readyCount={filledRemoveGridRows.length}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          <strong className="text-white">{visibleStudents.length}</strong> shown
          {normalizedPlacementQuery ? ` out of ${students.length} placed students` : ' placed students'}
        </span>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
          {sourceFilename && (
            <span className="flex items-center gap-1.5">
              <Upload size={11} />
              {sourceFilename}
            </span>
          )}
          {lastSync && (
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {new Date(lastSync).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        rows={visibleStudents}
        loading={loading}
        emptyMsg={normalizedPlacementQuery ? 'No placed student matched this BT-ID or name.' : 'No placed students uploaded yet'}
      />
    </div>
  )
}

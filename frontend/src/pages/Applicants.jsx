import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, Download, ExternalLink, RefreshCw, Search, Send } from 'lucide-react'
import toast from 'react-hot-toast'

import UploadZone from '../components/upload/UploadZone'
import Table from '../components/Table'
import api from '../utils/api'

const DEFAULT_FILTERS = {
  search: '',
  cgpaMin: '',
  removePlaced: true,
}

export default function Applicants() {
  const [uploaded, setUploaded] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [recentDownloads, setRecentDownloads] = useState([])
  const [recentPreview, setRecentPreview] = useState(null)
  const [recentLoading, setRecentLoading] = useState(false)
  const [selectedDownloadId, setSelectedDownloadId] = useState(null)
  const [status, setStatus] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const buildParams = (currentFilters, notify = false) => ({
    notify,
    search: currentFilters.search.trim() || undefined,
    cgpa_min: currentFilters.cgpaMin === '' ? undefined : Number(currentFilters.cgpaMin),
    remove_placed: currentFilters.removePlaced,
  })

  const fetchFiltered = async (notify = false, currentFilters = filters) => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/applicants/filter', { params: buildParams(currentFilters, notify) })
      setData(res)
      setStatus(res.database_status ?? null)
      setUploaded(true)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch filtered applicants')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentDownloads = async (selectLatest = false) => {
    try {
      const { data: res } = await api.get('/applicants/downloads/recent')
      const downloads = res.downloads ?? []
      setRecentDownloads(downloads)
      setSelectedDownloadId((current) => {
        if (downloads.length === 0) return null
        if (selectLatest) return downloads[0].id
        return downloads.some((entry) => entry.id === current) ? current : downloads[0].id
      })
    } catch (_) {}
  }

  const fetchRecentPreview = async (entryId) => {
    if (!entryId) {
      setRecentPreview(null)
      return
    }

    setRecentLoading(true)
    try {
      const { data: res } = await api.get(`/applicants/downloads/recent/${entryId}`)
      setRecentPreview(res)
    } catch (_) {
      setRecentPreview(null)
      toast.error('Failed to load saved CSV preview')
    } finally {
      setRecentLoading(false)
    }
  }

  const fetchStatus = async () => {
    try {
      const { data: res } = await api.get('/students/status')
      setStatus(res)
      if ((res.uploaded_applicants_count ?? 0) > 0) {
        setUploaded(true)
        await fetchFiltered(false, filters)
      }
    } catch (_) {}
  }

  useEffect(() => {
    fetchStatus()
    fetchRecentDownloads()
  }, [])

  useEffect(() => {
    fetchRecentPreview(selectedDownloadId)
  }, [selectedDownloadId])

  const handleUploaded = (result) => {
    setUploaded(true)
    setStatus(result?.database_status ?? null)
    fetchFiltered(false, filters)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/applicants/download', {
        params: buildParams(filters),
        responseType: 'blob',
      })
      const disposition = res.headers['content-disposition'] || ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/i)
      const filename = filenameMatch?.[1] || 'filtered_applicants.csv'
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      window.URL.revokeObjectURL(url)
      await fetchRecentDownloads(true)
      toast.success('CSV downloaded and email notification sent')
    } catch (_) {
      toast.error('Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleApplyFilters = () => {
    fetchFiltered(false, filters)
  }

  const handleResetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS })
    fetchFiltered(false, DEFAULT_FILTERS)
  }

  const buildColumns = (orderedColumns = []) => {
    return orderedColumns.map((column) => ({
      key: column,
      label: column === 'bt_id' ? 'BT-ID' : String(column).replaceAll('_', ' '),
      render: (value) => {
        if (column === 'bt_id') {
          return (
            <span className="font-mono text-xs px-2 py-0.5 rounded-lg" style={{ background: 'var(--surface2)', color: '#60a5fa' }}>
              {value}
            </span>
          )
        }

        const text = value == null ? '—' : String(value)
        const looksLikeLink = /^https?:\/\//i.test(text)
        if (looksLikeLink) {
          return (
            <a
              href={text}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs transition-colors hover:text-green-400"
              style={{ color: '#60a5fa' }}
            >
              <ExternalLink size={11} /> Open
            </a>
          )
        }

        return <span style={{ color: value ? 'var(--text)' : 'var(--muted)' }}>{text}</span>
      },
    }))
  }

  const columns = useMemo(() => buildColumns(data?.columns ?? []), [data?.columns])
  const recentColumns = useMemo(() => buildColumns(recentPreview?.columns ?? []), [recentPreview?.columns])

  const formatTimestamp = (value) => {
    if (!value) return 'Unknown time'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
  }

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display text-white">Applicants</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Upload any applicant sheet. The system only needs a BT-ID style column and can still apply search, CGPA, duplicate cleanup, and placed-student removal.
        </p>
      </div>

      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm text-white">
          <Database size={15} className="text-blue-400" />
          Filtering is based only on BT-ID matches against the placed list
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          <span className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            Master: {status?.master_count ?? 0}
          </span>
          <span className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
            Placed: {status?.placed_count ?? 0}
          </span>
        </div>
      </div>

      <UploadZone onUploaded={handleUploaded} />

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-white">Applicant Filters</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Duplicate BT-ID rows are removed automatically when you upload the sheet.
            </p>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: filters.removePlaced ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)',
              color: filters.removePlaced ? '#4ade80' : '#fbbf24',
              border: filters.removePlaced ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(251,191,36,0.25)',
            }}
          >
            {filters.removePlaced ? 'Placed removal is ON' : 'Placed removal is OFF'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Search Name / BT-ID
            </span>
            <div className="flex items-center gap-2 px-3 rounded-xl" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <Search size={14} style={{ color: 'var(--muted)' }} />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                onKeyDown={(event) => event.key === 'Enter' && handleApplyFilters()}
                placeholder="Type name or BT-ID"
                className="w-full bg-transparent py-3 text-sm outline-none"
                style={{ color: 'var(--text)' }}
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Minimum CGPA
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.cgpaMin}
              onChange={(event) => setFilters((current) => ({ ...current, cgpaMin: event.target.value }))}
              className="w-full px-3 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder="e.g. 8.00"
            />
          </label>

          <label className="rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={filters.removePlaced}
              onChange={(event) => setFilters((current) => ({ ...current, removePlaced: event.target.checked }))}
              className="h-4 w-4 rounded"
            />
            <div>
              <div className="text-sm text-white">Remove placed students</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Keep this enabled to guarantee BT-ID matches from the placed list are removed.
              </div>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleApplyFilters}
            disabled={loading || !uploaded}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            <Search size={14} />
            Apply Filters
          </button>
          <button
            onClick={handleResetFilters}
            disabled={loading || !uploaded}
            className="text-sm px-4 py-2 rounded-xl transition-all hover:bg-white/5 disabled:opacity-50"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {data?.warnings?.length > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#fbbf24' }}>
            <AlertTriangle size={15} />
            Upload and filter notes
          </div>
          <div className="space-y-1 text-xs" style={{ color: 'var(--text)' }}>
            {data.warnings.map((warning) => (
              <div key={warning}>- {warning}</div>
            ))}
          </div>
        </div>
      )}

      {data?.placed_in_upload_count > 0 && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm fade-in"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
        >
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>
            <strong>{data.placed_in_upload_count}</strong> uploaded student(s) matched the placed list by BT-ID.
            {filters.removePlaced ? ' They were removed from the result.' : ' Turn on "Remove placed students" to exclude them.'}
          </span>
        </div>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Total uploaded', val: data.total_uploaded, color: '#60a5fa' },
              { label: filters.removePlaced ? 'Placed removed' : 'Placed matches', val: data.placed_in_upload_count, color: '#fb7185' },
              { label: 'Unplaced base', val: data.unplaced_count, color: '#4ade80' },
              { label: 'Shown now', val: data.filtered_count, color: '#f59e0b' },
            ].map(({ label, val, color }) => (
              <span
                key={label}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}
              >
                {val} {label}
              </span>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => fetchFiltered(true, filters)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <Send size={12} />
              Notify Email
            </button>
            <button
              onClick={() => fetchFiltered(false, filters)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:bg-white/5 disabled:opacity-50"
              style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || !data?.filtered_count}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <Download size={12} />
              {downloading ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>
        </div>
      )}

      {uploaded && (
        <Table
          columns={columns}
          rows={data?.filtered ?? []}
          loading={loading}
          emptyMsg="No applicants matched the current BT-ID, CGPA, and search filters."
        />
      )}

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent CSV Downloads</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              The newest 5 downloaded filtered CSV files are stored here for spreadsheet-style viewing.
            </p>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            Saved: {recentDownloads.length}/5
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            {recentDownloads.length === 0 ? (
              <div className="rounded-xl px-4 py-6 text-sm text-center" style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                No downloaded CSV history yet.
              </div>
            ) : (
              recentDownloads.map((entry) => {
                const selected = entry.id === selectedDownloadId
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedDownloadId(entry.id)}
                    className="w-full text-left rounded-xl px-4 py-3 transition-all"
                    style={{
                      background: selected ? 'rgba(59,130,246,0.12)' : 'var(--surface2)',
                      border: selected ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: selected ? '#60a5fa' : 'var(--text)' }}>
                        CSV #{entry.id}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                        {entry.row_count} rows
                      </span>
                    </div>
                    <div className="text-xs mt-2 break-all" style={{ color: 'var(--muted)' }}>
                      {entry.filename}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {formatTimestamp(entry.created_at)}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="xl:col-span-3 space-y-4">
            {recentPreview && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-white">{recentPreview.filename}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      Saved on {formatTimestamp(recentPreview.created_at)}
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    {recentPreview.row_count} result row(s)
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap text-xs">
                  {Object.entries(recentPreview.filters ?? {}).map(([key, value]) => (
                    <span
                      key={key}
                      className="px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {recentPreview || recentLoading ? (
              <Table
                columns={recentColumns}
                rows={recentPreview?.rows ?? []}
                loading={recentLoading}
                emptyMsg="No rows were saved in this CSV snapshot."
              />
            ) : (
              <div className="rounded-2xl px-4 py-12 text-center text-sm" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Select a saved CSV to preview it here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

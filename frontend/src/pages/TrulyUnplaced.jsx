import { useEffect, useState } from 'react'
import { Clock, RefreshCw, Search, Upload, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

import Table from '../components/Table'
import DatasetUploadCard from '../components/upload/DatasetUploadCard'
import api from '../utils/api'

export default function TrulyUnplaced() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('')
  const [branchOptions, setBranchOptions] = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [sourceFilename, setSourceFilename] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (branch) params.branch = branch

      const [unplacedRes, masterRes] = await Promise.all([
        api.get('/students/unplaced', { params }),
        api.get('/students/master'),
      ])

      setStudents(unplacedRes.data.students)
      setLastSync(unplacedRes.data.last_sync)
      setSourceFilename(masterRes.data.source_filename)
      setBranchOptions(
        [...new Set((masterRes.data.students ?? []).map((student) => student.Branch).filter(Boolean))].sort()
      )
    } catch (_) {
      toast.error('Failed to load truly unplaced students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [search, branch])

  const inputCls = 'px-3 py-2 rounded-xl text-sm outline-none transition-all focus:ring-1 focus:ring-rose-500/30'
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }

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
    {
      key: 'Branch',
      label: 'Branch',
      render: (value) => value
        ? (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            {value}
          </span>
          )
        : '—',
    },
    {
      key: 'CGPA',
      label: 'CGPA',
      render: (value) => value != null && value !== ''
        ? (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${parseFloat(value) >= 9 ? 'tag-cgpa' : ''}`}
            style={parseFloat(value) >= 9 ? {} : { color: 'var(--text)' }}
          >
            {parseFloat(value).toFixed(2)} {parseFloat(value) >= 9 ? '⭐' : ''}
          </span>
          )
        : '—',
    },
  ]

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display text-white flex items-center gap-2">
            <UserX size={22} className="text-rose-400" />
            Truly Unplaced
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Master students minus placed students, with branch derived from BT-ID
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all hover:bg-white/5 disabled:opacity-50"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <DatasetUploadCard
        title="Master Students Import"
        description="Upload or replace the all-students sheet used to compute the truly unplaced list."
        endpoint="/students/master/upload"
        accent="#60a5fa"
        buttonLabel="Upload Master Students File"
        onSuccess={load}
      />

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            className={inputCls}
            style={{ ...inputStyle, paddingLeft: '2rem', width: '100%' }}
            placeholder="Search name / BT-ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className={inputCls}
          style={inputStyle}
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
        >
          <option value="">All Branches</option>
          {branchOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            <strong className="text-white">{students.length}</strong> unplaced students
          </span>
          {branch && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}
            >
              Branch: {branch}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(244,63,94,0.1)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}
          >
            Master - Placed
          </span>
        </div>
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

      <Table columns={columns} rows={students} loading={loading} emptyMsg="No unplaced students found yet" />
    </div>
  )
}

import { useState, useRef } from 'react'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const doUpload = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Only CSV or Excel files are supported')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await api.post('/applicants/upload', fd)
      setResult(data)
      onUploaded(data)
      toast.success(`${data.total} applicants loaded`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    doUpload(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 p-10 flex flex-col items-center gap-3 select-none"
        style={{
          borderColor: dragging ? '#22c55e' : 'var(--border)',
          background: dragging ? 'rgba(34,197,94,0.06)' : 'var(--surface)',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => doUpload(e.target.files[0])}
        />

        {uploading ? (
          <>
            <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Uploading & parsing…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <UploadCloud size={24} className="text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Drop file here or click to browse</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>CSV, XLSX, XLS — applicant data</p>
            </div>
          </>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div className="rounded-2xl p-4 space-y-3 fade-up" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-green-400" />
            <span className="text-sm font-medium text-white">{result.filename}</span>
            <button onClick={() => setResult(null)} className="ml-auto" style={{ color: 'var(--muted)' }}>
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
              {result.total} total
            </span>
            {result.already_placed_count > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full tag-backlog">
                ⚠ {result.already_placed_count} already placed
              </span>
            )}
          </div>

          {result.warnings?.length > 0 && (
            <div className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-xl px-3 py-2"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {result.warnings?.length === 0 && (
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
              <CheckCircle2 size={12} />
              File parsed successfully — no issues detected
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { FileSpreadsheet, RefreshCw, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '../../utils/api'

export default function DatasetUploadCard({
  title,
  description,
  endpoint,
  accent = '#60a5fa',
  buttonLabel = 'Upload File',
  helperText = 'CSV, XLSX, XLS',
  onSuccess,
}) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Only CSV or Excel files are supported')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)

    try {
      const { data } = await api.post(endpoint, formData)
      toast.success(data.message || `${file.name} uploaded`)
      onSuccess?.(data)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}
        >
          <FileSpreadsheet size={18} style={{ color: accent }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{description}</p>
        </div>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border border-dashed p-6 text-center cursor-pointer transition-all hover:bg-white/[0.03]"
        style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(event) => handleUpload(event.target.files?.[0])}
        />
        <div className="flex justify-center mb-3">
          {uploading ? (
            <RefreshCw size={18} className="animate-spin" style={{ color: accent }} />
          ) : (
            <UploadCloud size={18} style={{ color: accent }} />
          )}
        </div>
        <p className="text-sm font-medium text-white">{uploading ? 'Uploading...' : buttonLabel}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{helperText}</p>
      </div>
    </div>
  )
}

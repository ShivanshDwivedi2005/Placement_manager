import { useEffect, useState } from 'react'
import { Clock, Database, RefreshCw, Upload, UserCheck, UserX } from 'lucide-react'

import StatCard from '../components/StatCard'
import DatasetUploadCard from '../components/upload/DatasetUploadCard'
import api from '../utils/api'

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/students/status')
      setStatus(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const cards = [
    { label: 'Master Students', value: status?.master_count, icon: Database, color: '#60a5fa' },
    { label: 'Placed Students', value: status?.placed_count, icon: UserCheck, color: '#22c55e' },
    { label: 'Truly Unplaced', value: status?.truly_unplaced_count, icon: UserX, color: '#fb7185' },
    { label: 'Latest Applicant Upload', value: status?.uploaded_applicants_count, icon: Upload, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-8 fade-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display text-white">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            PostgreSQL-backed internship filtering with one-time master and placed imports
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} value={card.value ?? '0'} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DatasetUploadCard
          title="Master Students Database"
          description="Upload the full student list once. This becomes the persistent source for truly unplaced students."
          endpoint="/students/master/upload"
          accent="#60a5fa"
          buttonLabel="Upload Master File"
          onSuccess={load}
        />
        <DatasetUploadCard
          title="Placed Students Database"
          description="Upload the placed list once, then continue maintaining it from the admin panel."
          endpoint="/placed/upload"
          accent="#22c55e"
          buttonLabel="Upload Placed File"
          onSuccess={load}
        />
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold text-white mb-3">Current Database State</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl p-4" style={{ background: 'var(--surface2)' }}>
            <div style={{ color: 'var(--muted)' }}>Master file</div>
            <div className="text-white mt-1">{status?.master_source_filename || 'Not uploaded yet'}</div>
            {status?.master_updated_at && (
              <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: 'var(--muted)' }}>
                <Clock size={11} />
                {new Date(status.master_updated_at).toLocaleString()}
              </div>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--surface2)' }}>
            <div style={{ color: 'var(--muted)' }}>Placed file</div>
            <div className="text-white mt-1">{status?.placed_source_filename || 'Not uploaded yet'}</div>
            {status?.placed_updated_at && (
              <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: 'var(--muted)' }}>
                <Clock size={11} />
                {new Date(status.placed_updated_at).toLocaleString()}
              </div>
            )}
          </div>
          <div className="rounded-xl p-4 md:col-span-2" style={{ background: 'var(--surface2)' }}>
            <div style={{ color: 'var(--muted)' }}>Latest applicant upload</div>
            <div className="text-white mt-1">{status?.applicants_source_filename || 'No applicant file uploaded yet'}</div>
            {status?.applicants_updated_at && (
              <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: 'var(--muted)' }}>
                <Clock size={11} />
                {new Date(status.applicants_updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold text-white mb-3">How This Version Works</h3>
        <ol className="space-y-2">
          {[
            'Upload the all-students master sheet once to seed the PostgreSQL database.',
            'Upload the placed students file once, then keep editing that list from the admin panel.',
            'Whenever you receive a new applicant sheet, upload it on the Applicants page.',
            'The system removes BT-IDs already present in the placed list and shows only eligible students.',
            'Use the Truly Unplaced page to see Master minus Placed at any time.',
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm" style={{ color: 'var(--muted)' }}>
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
              >
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

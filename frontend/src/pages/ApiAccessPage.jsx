import { useState, useEffect } from 'react'
import api from '../api/client'

export default function ApiAccessPage() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newKeyData, setNewKeyData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const { data } = await api.get('/user/api-keys/')
      setKeys(data)
    } catch (err) {
      setError('Failed to load API keys.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const { data } = await api.post('/user/api-keys/generate/')
      setNewKeyData(data)
      fetchKeys()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate key.')
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this key?')) return
    try {
      await api.post(`/user/api-keys/${id}/revoke/`)
      fetchKeys()
    } catch (err) {
      setError('Failed to revoke key.')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this key?')) return
    try {
      await api.delete(`/user/api-keys/${id}/`)
      fetchKeys()
    } catch (err) {
      setError('Failed to delete key.')
    }
  }

  const activeCount = keys.filter(k => k.is_active).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">API Access</h1>
        <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
          Manage your API keys for programmatic access to Aerogin data endpoints.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{background: 'var(--color-danger-soft)', color: 'var(--color-danger)'}}>
          {error}
        </div>
      )}

      {newKeyData && (
        <div className="card p-6" style={{ border: '2px solid var(--color-success)' }}>
          <h3 className="text-lg font-bold mb-2 text-emerald-600 dark:text-emerald-400">
            ✅ New API Key Generated
          </h3>
          <p className="text-sm font-semibold mb-4 text-red-600 dark:text-red-400">
            {newKeyData.message}
          </p>
          <div className="flex items-center gap-3">
            <code className="px-4 py-3 bg-gray-100 dark:bg-neutral-800 rounded-lg flex-1 text-sm break-all font-mono">
              {newKeyData.raw_key}
            </code>
            <button 
              className="btn-primary whitespace-nowrap"
              onClick={() => {
                navigator.clipboard.writeText(newKeyData.raw_key)
                alert('Copied to clipboard!')
              }}
            >
              Copy Key
            </button>
          </div>
          <button 
            className="mt-4 text-sm underline text-gray-500"
            onClick={() => setNewKeyData(null)}
          >
            I have saved it securely, close this
          </button>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="section-title">Your API Keys</h3>
            <p className="text-xs text-gray-500 mt-1">
              You are using {activeCount} of 3 active keys.
            </p>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={generating || activeCount >= 3}
          >
            {generating ? 'Generating...' : '+ Generate New Key'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading keys...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No API keys found. Generate one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-gray-500 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Key Prefix</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Last Used</th>
                  <th className="px-4 py-3">Rate Limit</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} className="border-b border-gray-100 dark:border-neutral-800/50">
                    <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-100">{k.key_prefix}••••••••</td>
                    <td className="px-4 py-3">
                      {k.is_active ? (
                        <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          REVOKED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{k.rate_limit_per_hour}/hr</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {k.is_active && (
                          <button 
                            onClick={() => handleRevoke(k.id)}
                            className="text-xs text-orange-500 hover:underline"
                          >
                            Revoke
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(k.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

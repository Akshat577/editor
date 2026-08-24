'use client'

import { ChevronsUpDown, Globe, Layers, Package, Plus, Sparkles, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const EMPTY_GRAPH = {
  nodes: {},
  rootNodeIds: [],
}

export default function DashboardLayout({
  children,
  activeTab,
}: {
  children: React.ReactNode
  activeTab: 'scenes' | 'ifc' | 'dwg'
}) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled scene', graph: EMPTY_GRAPH }),
      })
      if (!response.ok) return
      const meta = (await response.json()) as { id: string }
      router.push(`/scene/${meta.id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#111111] text-[#f3f3f3] font-sans dark antialiased selection:bg-white/10">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 border-r border-white/5 flex flex-col justify-between bg-[#151515]">
        <div>
          {/* Logo */}
          <Link
            href="/scenes"
            className="flex items-center gap-3 px-6 py-6 font-bold text-xl tracking-tight text-white hover:opacity-90 transition-all"
          >
            <div className="flex gap-1 items-end">
              <span className="w-1.5 h-6 bg-white rounded-full"></span>
              <span className="w-1.5 h-4 bg-white rounded-full"></span>
              <span className="w-1.5 h-5 bg-white rounded-full"></span>
            </div>
            10xscale.ai
          </Link>

          {/* Navigation */}
          <nav className="px-4 space-y-1.5 mt-2">
            <Link
              href="/scenes"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'scenes'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <Layers className="h-4 w-4" />
              Create
            </Link>

            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 cursor-not-allowed text-left"
            >
              <Globe className="h-4 w-4" />
              Community
            </button>

            <button
              disabled
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 cursor-not-allowed text-left"
            >
              <Package className="h-4 w-4" />
              Items
            </button>

            <Link
              href="/ifc"
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'ifc'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4" />
                Import IFC
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Alpha
              </span>
            </Link>

            <Link
              href="/dwg"
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'dwg'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-purple-400" />
                DWG Structural AI
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                New
              </span>
            </Link>
          </nav>

          {/* New Project Button */}
          <div className="px-4 mt-6">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-white hover:bg-white/90 text-black font-semibold text-sm transition-transform active:scale-[0.98] disabled:opacity-50 shadow-md"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'New project'}
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">Akshat jain</p>
                <p className="text-xs text-white/40 truncate">akshat@hire10x.ai</p>
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-white/40 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen bg-[#111111] overflow-y-auto">{children}</main>
    </div>
  )
}

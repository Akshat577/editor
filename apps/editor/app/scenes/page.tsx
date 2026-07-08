import { ArrowRight, FileUp, Settings } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import type { SceneMeta } from '@/components/scene-loader'

export const dynamic = 'force-dynamic'

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  if (!host) {
    return 'http://localhost:3002'
  }
  return `${proto}://${host}`
}

async function fetchScenes(): Promise<SceneMeta[]> {
  const base = await resolveBaseUrl()
  const response = await fetch(`${base}/api/scenes?limit=50`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    return []
  }
  const payload = (await response.json()) as { scenes?: SceneMeta[] } | SceneMeta[]
  if (Array.isArray(payload)) {
    return payload
  }
  return payload.scenes ?? []
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 24) {
      if (diffHours === 0) return 'Updated recently'
      return `Updated ${diffHours}h ago`
    }
    const diffDays = Math.floor(diffHours / 24)
    return `Updated ${diffDays}d ago`
  } catch {
    return iso
  }
}

export default async function ScenesPage() {
  const scenes = await fetchScenes()

  return (
    <DashboardLayout activeTab="scenes">
      <div className="max-w-5xl mx-auto px-8 py-12 space-y-10">
        {/* Pick up where you left off */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Pick up where you left off
          </h2>

          {scenes.length === 0 ? (
            <div className="rounded-2xl border border-white/5 border-dashed bg-[#151515] p-12 text-center">
              <p className="text-white/40 text-sm">You haven&apos;t created any scenes yet.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scenes.map((scene) => (
                <li key={scene.id}>
                  <Link
                    className="group block rounded-2xl border border-white/5 bg-[#151515] p-4 transition-all hover:border-white/10 hover:bg-[#181818]"
                    href={`/scene/${scene.id}`}
                  >
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-white/5 border border-white/5">
                      {scene.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={scene.name}
                          className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          src={scene.thumbnailUrl}
                        />
                      ) : (
                        <span className="text-white/30 text-xs">No thumbnail</span>
                      )}

                      {/* Public/Private Badge */}
                      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 backdrop-blur text-white/80 border border-white/5">
                        Private
                      </span>

                      {/* Cog icon on top right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur text-white/60 hover:text-white border border-white/5 transition-all"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-3">
                      <h3 className="truncate font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                        {scene.name}
                      </h3>
                      <div className="mt-1 flex items-center justify-between text-white/40 text-xs">
                        <span>{scene.nodeCount} nodes</span>
                        <time dateTime={scene.updatedAt}>{formatDate(scene.updatedAt)}</time>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Try the new IFC Importer Banner */}
        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
          <div className="flex gap-4 items-start">
            <div className="p-3.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              <FileUp className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Try the new IFC importer</h3>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Alpha
                </span>
              </div>
              <p className="text-xs text-white/55 leading-relaxed max-w-xl">
                Drop an IFC building model and turn it into a Pascal scene you can edit. Mapping is
                rough — your files help us improve it.
              </p>
            </div>
          </div>
          <Link
            href="/ifc"
            className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-bold shadow flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
          >
            Open importer
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Featured Projects */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">Featured projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Starter House',
                desc: 'A simple single-story residential home with a garage.',
                thumbnail:
                  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=400&q=80',
              },
              {
                title: '01-duplex (IFC)',
                desc: 'A modern multi-level apartment building converted from IFC.',
                thumbnail:
                  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80',
              },
              {
                title: 'Ifc4_SampleHouse (IFC)',
                desc: 'Standard buildingSMART house model with detailed wall layers.',
                thumbnail:
                  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80',
              },
            ].map((proj) => (
              <div
                key={proj.title}
                className="group rounded-2xl border border-white/5 bg-[#151515] p-4 transition-all"
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-white/5 border border-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={proj.title}
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    src={proj.thumbnail}
                  />
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/90 border border-white/10">
                    Featured
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="font-bold text-sm text-white">{proj.title}</h3>
                  <p className="mt-1 text-white/40 text-xs leading-relaxed line-clamp-2">
                    {proj.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

'use client'

import { convertIfcToPascal, type PascalSceneGraph } from '@pascal-app/ifc-converter'
import { Check, Download, FileJson, MessageSquare, Play, UploadCloud, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const PascalViewer = dynamic(() => import('./PascalSceneViewer'), { ssr: false })

type Status = 'idle' | 'loading' | 'converting' | 'ready' | 'error'

type ConverterMetadata = {
  ifcType?: string
  expressID?: number
  globalId?: string
  levelId?: string
  elevation?: number
  material?: string
  typeName?: string
  properties?: Record<string, Record<string, string | number | boolean>>
  [key: string]: unknown
}

function meta(node: { metadata?: unknown } | null | undefined): ConverterMetadata {
  return (node?.metadata ?? {}) as ConverterMetadata
}

export default function IfcConverter() {
  const router = useRouter()
  const [pascalData, setPascalData] = useState<PascalSceneGraph | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string>('01-duplex.ifc')
  const [ifcData, setIfcData] = useState<Uint8Array | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(new Set())
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [conversionProgress, setConversionProgress] = useState<number>(0)
  const [conversionMessage, setConversionMessage] = useState<string>('')
  const [isSavingScene, setIsSavingScene] = useState(false)

  const levels = useMemo(() => {
    if (!pascalData) return []
    return Object.values(pascalData.nodes)
      .filter((n) => n.type === 'level')
      .sort((a, b) => (meta(a).elevation ?? 0) - (meta(b).elevation ?? 0))
      .map((n) => ({ id: n.id, name: n.name ?? n.id, elevation: meta(n).elevation ?? 0 }))
  }, [pascalData])

  const typeCounts = useMemo(() => {
    if (!pascalData) return {}
    const counts: Record<string, number> = {}
    for (const n of Object.values(pascalData.nodes)) {
      counts[n.type] = (counts[n.type] || 0) + 1
    }
    return counts
  }, [pascalData])

  const elementTypes = useMemo(() => {
    const order = ['wall', 'slab', 'door', 'window', 'stair', 'roof', 'column', 'item']
    return order.filter((t) => typeCounts[t])
  }, [typeCounts])

  useEffect(() => {
    if (levels.length > 0) {
      setVisibleLevels(new Set(levels.map((l) => l.id)))
    }
  }, [levels])

  useEffect(() => {
    if (elementTypes.length > 0) {
      setVisibleTypes(new Set(elementTypes))
    }
  }, [elementTypes])

  const searchResults = useMemo(() => {
    if (!pascalData || !searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const results: { id: string; name: string; type: string; match: string }[] = []
    for (const node of Object.values(pascalData.nodes)) {
      if (['site', 'building', 'level'].includes(node.type)) continue
      const m = meta(node)
      let match: string | null = null
      if (node.name?.toLowerCase().includes(q)) match = `Name: ${node.name}`
      else if (node.type.includes(q)) match = `Type: ${node.type}`
      else if (m.ifcType?.toLowerCase().includes(q)) match = `IFC: ${m.ifcType}`
      else if (m.typeName?.toLowerCase().includes(q)) match = `Type: ${m.typeName}`
      else if (m.material?.toLowerCase().includes(q)) match = `Material: ${m.material}`
      else if (m.globalId?.toLowerCase().includes(q)) match = `ID: ${m.globalId}`
      else if (m.properties) {
        for (const [psetName, props] of Object.entries(m.properties) as [string, any][]) {
          for (const [k, v] of Object.entries(props)) {
            if (k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)) {
              match = `${psetName}: ${k} = ${v}`
              break
            }
          }
          if (match) break
        }
      }
      if (match) {
        results.push({ id: node.id, name: node.name ?? node.id, type: node.type, match })
        if (results.length >= 50) break
      }
    }
    return results
  }, [pascalData, searchQuery])

  // Removed automatic example loading

  const loadAndConvert = async (data: Uint8Array, name: string) => {
    setFileName(name)
    setStatus('converting')
    setSearchQuery('')
    setSelectedNodeId(null)
    setConversionProgress(0)
    setConversionMessage('Starting conversion...')

    try {
      const result = await convertIfcToPascal(data, (message, percent) => {
        setConversionMessage(message)
        setConversionProgress(percent)
      })
      setPascalData(result)
      setStatus('ready')
      setConversionProgress(100)
      setConversionMessage('Conversion complete!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
      setStatus('error')
      setConversionProgress(0)
    }
  }

  // Removed loadExampleFile

  const handleFile = async (file: File) => {
    setStatus('loading')
    setError(null)
    setSelectedFile('')

    const params = new URLSearchParams(window.location.search)
    if (params.has('file')) {
      params.delete('file')
      const qs = params.toString()
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', newUrl)
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      setIfcData(uint8Array)
      await loadAndConvert(uint8Array, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
      setStatus('error')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.toLowerCase().endsWith('.ifc')) {
      handleFile(file)
    } else {
      setError('Please drop a valid IFC file')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const downloadPascalJson = () => {
    if (!pascalData) return
    const json = JSON.stringify(pascalData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace('.ifc', '')}_pascal.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadIfc = () => {
    if (!ifcData) return
    const blob = new Blob([ifcData as any], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyJsonToClipboard = () => {
    if (!pascalData) return
    const json = JSON.stringify(pascalData, null, 2)
    navigator.clipboard.writeText(json)
  }

  const editInPascal = async () => {
    if (!pascalData) return
    setIsSavingScene(true)
    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fileName.replace('.ifc', '') + ' (IFC)',
          graph: pascalData,
        }),
      })
      if (!response.ok) {
        throw new Error(`Failed to create scene: ${response.status}`)
      }
      const meta = (await response.json()) as { id: string }
      router.push(`/scene/${meta.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to editor')
    } finally {
      setIsSavingScene(false)
    }
  }

  const isWorking = status === 'loading' || status === 'converting'

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 space-y-8">
      {/* Header Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Import IFC</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Alpha
          </span>
        </div>
        <p className="text-white/60 leading-relaxed text-sm max-w-3xl">
          Drop an IFC building model and it will turn it into a scene you can edit. Mapping is a
          work in progress — expect rough edges.
        </p>
      </div>

      {/* Upload Drag/Drop Box */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/5 scale-[1.005]'
            : 'border-white/10 bg-[#161616] hover:border-white/20 hover:bg-[#181818]'
        }`}
      >
        <label className="flex flex-col items-center justify-center gap-3 cursor-pointer">
          <input type="file" accept=".ifc" onChange={handleFileInput} className="hidden" />
          <div className="p-4 rounded-full bg-white/5 border border-white/10 text-white/60">
            <UploadCloud className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-white mt-1">
            Drop an IFC file here, or{' '}
            <span className="text-blue-500 hover:text-blue-400">browse</span>
          </p>
          <p className="text-xs text-white/40">
            Up to 100 MB. Files are saved so we can investigate conversion issues.
          </p>
        </label>
      </div>

      {/* Example Selection Cards Removed */}

      {/* Error Output */}
      {status === 'error' && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Conversion Result Preview */}
      {(pascalData || isWorking) && (
        <div className="space-y-5">
          {pascalData && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white truncate max-w-xs md:max-w-md">
                  {fileName}
                </h2>
                <span className="text-xs text-white/60 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full font-medium">
                  {Object.keys(pascalData.nodes).length} nodes
                </span>
                <span className="text-xs text-white/60 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full font-medium">
                  {new Set(Object.values(pascalData.nodes).map((n) => n.type)).size} types
                </span>
              </div>

              {/* Actions Header */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadIfc}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#1a1a1a] hover:bg-[#222222] border border-white/10 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download IFC
                </button>
                <button
                  onClick={downloadPascalJson}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#1a1a1a] hover:bg-[#222222] border border-white/10 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Download JSON
                </button>
                <button
                  onClick={editInPascal}
                  disabled={isSavingScene}
                  className="px-4 py-1.5 text-xs font-bold bg-white hover:bg-white/90 text-black rounded-lg transition-all flex items-center gap-1.5 shadow disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  {isSavingScene ? 'Creating...' : 'Edit in Pascal'}
                </button>
              </div>
            </div>
          )}

          {/* 3D Visualizer and Sidebar Properties Inspector */}
          <div className="flex flex-col lg:flex-row gap-5">
            <div className="flex-1 min-w-0 relative">
              {/* Loader Overlay */}
              {isWorking && (
                <div className="absolute inset-0 z-10 bg-[#111111]/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4">
                  <div className="animate-spin rounded-full h-9 w-9 border-2 border-white/10 border-t-blue-500"></div>
                  <p className="font-semibold text-white text-sm">
                    {status === 'loading' ? 'Loading file...' : 'Converting to Pascal'}
                  </p>
                  {status === 'converting' && (
                    <div className="w-56 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">{conversionMessage}</span>
                        <span className="text-blue-400 font-bold">{conversionProgress}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${conversionProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rendering canvas */}
              {pascalData && (
                <PascalViewer sceneGraph={pascalData} onSelectNode={setSelectedNodeId} />
              )}
              {!pascalData && (
                <div className="w-full h-[600px] bg-[#141414] border border-white/5 rounded-2xl" />
              )}
              <p className="text-[11px] text-white/40 mt-2 text-center">
                Orbit (left click) / Pan (right click) / Zoom (scroll) / Click elements to inspect
                properties
              </p>
            </div>

            {/* Properties Sidebar Panel */}
            {selectedNodeId &&
              Boolean(
                (pascalData?.nodes as Record<string, unknown> | undefined)?.[selectedNodeId],
              ) &&
              (() => {
                const node = (pascalData!.nodes as Record<string, any>)[selectedNodeId] as any
                const meta = node.metadata ?? {}
                const Row = ({ k, v }: { k: string; v: string }) => (
                  <div className="flex justify-between text-xs py-1 gap-4 border-b border-white/5">
                    <span className="text-white/40 shrink-0 font-medium">{k}</span>
                    <span
                      className="text-white font-mono text-right truncate max-w-[160px]"
                      title={v}
                    >
                      {v}
                    </span>
                  </div>
                )
                return (
                  <div className="w-full lg:w-80 shrink-0 max-h-[600px] overflow-y-auto bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-4 no-scrollbar">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h3 className="text-sm font-bold text-white truncate max-w-[200px]">
                        {node.name ?? node.type}
                      </h3>
                      <button
                        onClick={() => setSelectedNodeId(null)}
                        className="text-white/40 hover:text-white p-1 hover:bg-white/5 rounded transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                        Metadata
                      </p>
                      <Row k="Type" v={node.type} />
                      {meta.typeName && <Row k="Type Name" v={meta.typeName} />}
                      {meta.ifcType && <Row k="IFC Type" v={meta.ifcType} />}
                      {meta.globalId && <Row k="Global ID" v={meta.globalId} />}
                      {meta.expressID != null && <Row k="Express ID" v={String(meta.expressID)} />}
                      {meta.levelId && (
                        <Row k="Level" v={pascalData!.nodes[meta.levelId]?.name ?? meta.levelId} />
                      )}
                    </div>

                    {(node.start ||
                      node.thickness != null ||
                      node.height != null ||
                      node.width != null ||
                      node.elevation != null ||
                      node.polygon) && (
                      <div className="space-y-1 pt-2">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                          Geometry
                        </p>
                        {node.start && (
                          <Row
                            k="Start"
                            v={`[${node.start.map((v: number) => v.toFixed(2)).join(', ')}]`}
                          />
                        )}
                        {node.end && (
                          <Row
                            k="End"
                            v={`[${node.end.map((v: number) => v.toFixed(2)).join(', ')}]`}
                          />
                        )}
                        {node.thickness != null && (
                          <Row k="Thickness" v={`${node.thickness.toFixed(3)} m`} />
                        )}
                        {node.height != null && (
                          <Row k="Height" v={`${node.height.toFixed(3)} m`} />
                        )}
                        {node.width != null && <Row k="Width" v={`${node.width.toFixed(3)} m`} />}
                        {node.position != null && node.type !== 'wall' && (
                          <Row
                            k="Position"
                            v={`[${node.position.map((v: number) => v.toFixed(2)).join(', ')}]`}
                          />
                        )}
                        {node.elevation != null && (
                          <Row k="Elevation" v={`${node.elevation.toFixed(3)} m`} />
                        )}
                        {node.sillHeight != null && (
                          <Row k="Sill Height" v={`${node.sillHeight.toFixed(3)} m`} />
                        )}
                        {node.polygon && <Row k="Polygon" v={`${node.polygon.length} points`} />}
                      </div>
                    )}

                    {(meta.material || meta.materialLayers) && (
                      <div className="space-y-1 pt-2">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                          Material
                        </p>
                        {meta.material && <Row k="Name" v={meta.material} />}
                        {meta.materialLayers?.map((l: any, i: number) => (
                          <Row
                            key={i}
                            k={l.name}
                            v={l.thickness != null ? `${(l.thickness * 1000).toFixed(0)} mm` : '-'}
                          />
                        ))}
                      </div>
                    )}

                    {meta.properties &&
                      Object.entries(meta.properties).map(([psetName, props]: [string, any]) => (
                        <div key={psetName} className="space-y-1 pt-2">
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                            {psetName}
                          </p>
                          {Object.entries(props).map(([k, v]: [string, any]) => (
                            <Row key={k} k={k} v={String(v)} />
                          ))}
                        </div>
                      ))}
                  </div>
                )
              })()}
          </div>

          {/* Success / Feedback bottom banner */}
          {status === 'ready' && pascalData && (
            <div className="rounded-2xl border border-white/5 bg-[#161616] p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
              <div className="flex items-center gap-2.5 text-xs text-green-400 font-medium">
                <div className="h-5 w-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>Saved ✓ — your file is helping us improve Pascal.</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 border border-transparent transition-all flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send feedback
                </button>
                <button
                  onClick={editInPascal}
                  disabled={isSavingScene}
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-bold shadow transition-all disabled:opacity-50"
                >
                  {isSavingScene ? 'Opening...' : 'Edit in Pascal'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JSON Drawer */}
      {status === 'ready' && pascalData && showJson && (
        <div className="fixed right-0 top-0 h-screen w-[420px] bg-[#151515] border-l border-white/5 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-250">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Pascal JSON</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={copyJsonToClipboard}
                className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                title="Copy to clipboard"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowJson(false)}
                className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-[#111111]">
            <pre className="text-green-400 text-xs font-mono select-all">
              {JSON.stringify(pascalData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Float toggle button for JSON */}
      {status === 'ready' && pascalData && !showJson && (
        <button
          onClick={() => setShowJson(true)}
          className="fixed right-6 bottom-6 bg-white hover:bg-white/90 text-black shadow-2xl transition-all z-40 rounded-full px-4 py-2.5 flex items-center gap-2 border border-white/10 active:scale-95"
          title="Show JSON preview"
        >
          <span className="font-mono text-sm font-bold">&#123; &#125;</span>
          <span className="text-xs font-bold">Preview JSON</span>
        </button>
      )}
    </div>
  )
}

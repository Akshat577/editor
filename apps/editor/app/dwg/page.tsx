'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import {
  UploadCloud,
  Trash2,
  Play,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Layers,
  FileCode,
} from 'lucide-react'

type FileType = 'before' | 'after'

interface FileState {
  file: File | null
  isDragging: boolean
}

type Step = 'idle' | 'uploading' | 'processing' | 'completed' | 'error'

interface DiffItem {
  type: string
  layer: string
  structural_relevance: 'high' | 'low'
  change?: {
    moved_distance?: number
    attributes?: Record<string, { before: any; after: any }>
  }
}

interface DiffReport {
  added: DiffItem[]
  removed: DiffItem[]
  modified: DiffItem[]
  unchanged_count: number
}

interface CompareResult {
  report: string
  diff: DiffReport
}

const PIPELINE_MESSAGES = [
  'Initializing conversion workspace...',
  'Extracting base revision vector tables (Before)...',
  'Extracting target revision vector tables (After)...',
  'Interrogating lines, circles, arcs, and polylines...',
  'Isolating structural layers (Wall, Column, Slab, Steel, Beam)...',
  'Executing Hungarian assignment algorithm for coordinate alignment...',
  'Mapping dimensional differences & object transformations...',
  'Packaging structured JSON delta tables...',
  'AI is drafting engineering report, highlighting critical items...',
]

export default function DwgPage() {
  // File upload state
  const [beforeFile, setBeforeFile] = useState<FileState>({ file: null, isDragging: false })
  const [afterFile, setAfterFile] = useState<FileState>({ file: null, isDragging: false })

  // Processing state
  const [step, setStep] = useState<Step>('idle')
  const [pipelineMessage, setPipelineMessage] = useState(PIPELINE_MESSAGES[0])
  const [progressPercent, setProgressPercent] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Result state
  const [result, setResult] = useState<CompareResult | null>(null)
  const [activeTab, setActiveTab] = useState<'report' | 'changes'>('report')
  const [copied, setCopied] = useState(false)
  const [changeTypeFilter, setChangeTypeFilter] = useState<'all' | 'added' | 'removed' | 'modified'>('all')
  const [relevanceFilter, setRelevanceFilter] = useState<'all' | 'high' | 'low'>('high')

  // Refs for file inputs
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)

  // Rotate pipeline loader message
  useEffect(() => {
    if (step !== 'processing') return

    let currentMsgIndex = 0
    let progress = 5

    const interval = setInterval(() => {
      // Advance messages
      currentMsgIndex = (currentMsgIndex + 1) % PIPELINE_MESSAGES.length
      setPipelineMessage(PIPELINE_MESSAGES[currentMsgIndex])

      // Advance mock progress
      progress += Math.floor(Math.random() * 8) + 3
      if (progress > 95) progress = 95 // Cap at 95 until finished
      setProgressPercent(progress)
    }, 2800)

    return () => clearInterval(interval)
  }, [step])

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent, type: FileType) => {
    e.preventDefault()
    if (type === 'before') {
      setBeforeFile((prev) => ({ ...prev, isDragging: true }))
    } else {
      setAfterFile((prev) => ({ ...prev, isDragging: true }))
    }
  }

  const handleDragLeave = (type: FileType) => {
    if (type === 'before') {
      setBeforeFile((prev) => ({ ...prev, isDragging: false }))
    } else {
      setAfterFile((prev) => ({ ...prev, isDragging: false }))
    }
  }

  const handleDrop = (e: React.DragEvent, type: FileType) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) {
        validateAndSetFile(file, type)
      }
    }
    if (type === 'before') {
      setBeforeFile((prev) => ({ ...prev, isDragging: false }))
    } else {
      setAfterFile((prev) => ({ ...prev, isDragging: false }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: FileType) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file) {
        validateAndSetFile(file, type)
      }
    }
  }

  const validateAndSetFile = (file: File, type: FileType) => {
    if (!file.name.toLowerCase().endsWith('.dwg')) {
      setErrorMsg('Invalid file format. Please upload a valid AutoCAD drawing (.dwg).')
      setStep('error')
      return
    }

    setErrorMsg(null)
    if (type === 'before') {
      setBeforeFile({ file, isDragging: false })
    } else {
      setAfterFile({ file, isDragging: false })
    }
  }

  const removeFile = (type: FileType) => {
    if (type === 'before') {
      setBeforeFile({ file: null, isDragging: false })
      if (beforeInputRef.current) beforeInputRef.current.value = ''
    } else {
      setAfterFile({ file: null, isDragging: false })
      if (afterInputRef.current) afterInputRef.current.value = ''
    }
  }

  const triggerUpload = async () => {
    if (!beforeFile.file || !afterFile.file) return

    setStep('processing')
    setProgressPercent(10)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('before', beforeFile.file)
    formData.append('after', afterFile.file)

    try {
      const response = await fetch('/api/dwg', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.message || errData.error || 'Failed to compare drawings.')
      }

      const data = await response.json()
      setResult(data)
      setProgressPercent(100)
      setStep('completed')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'An error occurred while comparing the files.')
      setStep('error')
    }
  }

  const copyToClipboard = () => {
    if (!result) return
    navigator.clipboard.writeText(result.report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetComparison = () => {
    setBeforeFile({ file: null, isDragging: false })
    setAfterFile({ file: null, isDragging: false })
    setResult(null)
    setStep('idle')
    setErrorMsg(null)
    setProgressPercent(0)
    if (beforeInputRef.current) beforeInputRef.current.value = ''
    if (afterInputRef.current) afterInputRef.current.value = ''
  }

  // Filtered list of changes
  const getFilteredChanges = () => {
    if (!result) return []
    const { added, removed, modified } = result.diff
    
    let list: { item: DiffItem; changeType: 'added' | 'removed' | 'modified' }[] = []

    if (changeTypeFilter === 'all' || changeTypeFilter === 'added') {
      added.forEach((item) => list.push({ item, changeType: 'added' }))
    }
    if (changeTypeFilter === 'all' || changeTypeFilter === 'removed') {
      removed.forEach((item) => list.push({ item, changeType: 'removed' }))
    }
    if (changeTypeFilter === 'all' || changeTypeFilter === 'modified') {
      modified.forEach((item) => list.push({ item, changeType: 'modified' }))
    }

    if (relevanceFilter !== 'all') {
      list = list.filter((x) => x.item.structural_relevance === relevanceFilter)
    }

    return list
  }

  const filteredChanges = getFilteredChanges()

  // Format File Size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Lightweight custom markdown parser
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n')
    return (
      <div className="space-y-4 text-white/80 leading-relaxed text-sm">
        {lines.map((line, i) => {
          if (line.startsWith('# ')) {
            return (
              <h1 key={i} className="text-2xl font-bold text-white border-b border-white/5 pb-2 pt-4">
                {line.replace('# ', '')}
              </h1>
            )
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={i} className="text-lg font-semibold text-white pt-3">
                {line.replace('## ', '')}
              </h2>
            )
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={i} className="text-base font-semibold text-white/95 pt-2">
                {line.replace('### ', '')}
              </h3>
            )
          }
          if (line.startsWith('> ')) {
            return (
              <blockquote key={i} className="border-l-4 border-purple-500 bg-purple-500/5 px-4 py-2 rounded-r italic text-white/70 my-2">
                {line.replace('> ', '')}
              </blockquote>
            )
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.substring(2)
            return (
              <li key={i} className="ml-5 list-disc pl-1 text-white/75">
                {parseInlineMarkdown(content)}
              </li>
            )
          }
          if (line.trim() === '') {
            return <div key={i} className="h-1" />
          }
          return (
            <p key={i} className="text-white/80">
              {parseInlineMarkdown(line)}
            </p>
          )
        })}
      </div>
    )
  }

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split('**')
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-white">{part}</strong>
      }
      return part
    })
  }

  return (
    <DashboardLayout activeTab="dwg">
      <div className="max-w-6xl mx-auto px-8 py-10">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-8 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                AI Engine
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Sparkles className="h-7 w-7 text-purple-400 animate-pulse" />
              DWG Structural AI
            </h1>
            <p className="text-sm text-white/50 mt-1 max-w-xl">
              Upload two AutoCAD drawings (before and after revision) to automatically detect geometric alterations, extract layers, and run a structural change assessment.
            </p>
          </div>
          {step === 'completed' && (
            <button
              onClick={resetComparison}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-white/10 transition-all active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New Comparison
            </button>
          )}
        </div>

        {/* State: Idle */}
        {step === 'idle' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Uploader: BEFORE */}
              <div className="flex flex-col">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
                  1. Base Revision (Before Change)
                </label>
                <input
                  ref={beforeInputRef}
                  type="file"
                  accept=".dwg"
                  onChange={(e) => handleFileChange(e, 'before')}
                  className="hidden"
                />
                
                {beforeFile.file ? (
                  <div className="border border-white/10 bg-[#151515] p-5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 shrink-0">
                        <FileCode className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate max-w-[200px]">
                          {beforeFile.file.name}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {formatSize(beforeFile.file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile('before')}
                      className="h-8 w-8 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-lg flex items-center justify-center transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'before')}
                    onDragLeave={() => handleDragLeave('before')}
                    onDrop={(e) => handleDrop(e, 'before')}
                    onClick={() => beforeInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-white/[0.02] ${
                      beforeFile.isDragging
                        ? 'border-purple-500/60 bg-purple-500/5'
                        : 'border-white/10 bg-[#131313]'
                    }`}
                  >
                    <UploadCloud className="h-10 w-10 text-white/20 mb-3" />
                    <p className="text-sm font-medium text-white/80">Drop Base DWG file</p>
                    <p className="text-xs text-white/40 mt-1">or click to browse local files</p>
                  </div>
                )}
              </div>

              {/* Uploader: AFTER */}
              <div className="flex flex-col">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
                  2. Target Revision (After Change)
                </label>
                <input
                  ref={afterInputRef}
                  type="file"
                  accept=".dwg"
                  onChange={(e) => handleFileChange(e, 'after')}
                  className="hidden"
                />
                
                {afterFile.file ? (
                  <div className="border border-white/10 bg-[#151515] p-5 rounded-2xl flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 shrink-0">
                        <FileCode className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate max-w-[200px]">
                          {afterFile.file.name}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {formatSize(afterFile.file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile('after')}
                      className="h-8 w-8 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-lg flex items-center justify-center transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => handleDragOver(e, 'after')}
                    onDragLeave={() => handleDragLeave('after')}
                    onDrop={(e) => handleDrop(e, 'after')}
                    onClick={() => afterInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-white/[0.02] ${
                      afterFile.isDragging
                        ? 'border-purple-500/60 bg-purple-500/5'
                        : 'border-white/10 bg-[#131313]'
                    }`}
                  >
                    <UploadCloud className="h-10 w-10 text-white/20 mb-3" />
                    <p className="text-sm font-medium text-white/80">Drop Target DWG file</p>
                    <p className="text-xs text-white/40 mt-1">or click to browse local files</p>
                  </div>
                )}
              </div>

            </div>

            {/* Run Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={triggerUpload}
                disabled={!beforeFile.file || !afterFile.file}
                className="flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-white/95 text-black font-semibold text-sm transition-transform active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-white/5"
              >
                <Play className="h-4 w-4 fill-current" />
                Run AI Assessment
              </button>
            </div>
          </div>
        )}

        {/* State: Processing */}
        {step === 'processing' && (
          <div className="border border-white/5 bg-[#151515] p-12 rounded-3xl flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
            
            {/* Glowing blur */}
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]" />
            <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px]" />

            {/* Spinner */}
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full border-4 border-white/5 border-t-purple-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-purple-400" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              AI is working to show structural changes
            </h3>
            <p className="text-xs text-purple-400 font-mono select-none px-4 py-1.5 rounded-full bg-purple-500/5 border border-purple-500/10 mb-8 max-w-lg text-center truncate">
              {pipelineMessage}
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-md bg-white/5 border border-white/10 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-bold tracking-wider font-mono mt-2 text-white/30">
              {progressPercent}% COMPLETE
            </span>
          </div>
        )}

        {/* State: Error */}
        {step === 'error' && (
          <div className="border border-red-500/10 bg-red-500/[0.02] p-8 rounded-3xl flex flex-col items-center justify-center text-center shadow-lg">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Assessment Failed</h3>
            <p className="text-sm text-white/60 max-w-md mb-6 leading-relaxed">
              {errorMsg || 'An error occurred during drawing conversion. Check your file format and try again.'}
            </p>
            <button
              onClick={resetComparison}
              className="flex items-center gap-2 bg-white text-black text-xs font-semibold px-6 py-3 rounded-full hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>
          </div>
        )}

        {/* State: Completed */}
        {step === 'completed' && result && (
          <div className="space-y-6">
            
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Added */}
              <div className="bg-[#151515] border border-white/5 p-5 rounded-2xl flex flex-col justify-between shadow">
                <span className="text-[10px] font-bold text-white/30 tracking-wider uppercase">Added Elements</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-white">
                    {result.diff.added.length}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    + New
                  </span>
                </div>
              </div>

              {/* Removed */}
              <div className="bg-[#151515] border border-white/5 p-5 rounded-2xl flex flex-col justify-between shadow">
                <span className="text-[10px] font-bold text-white/30 tracking-wider uppercase">Removed Elements</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-white">
                    {result.diff.removed.length}
                  </span>
                  <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                    - Lost
                  </span>
                </div>
              </div>

              {/* Modified */}
              <div className="bg-[#151515] border border-white/5 p-5 rounded-2xl flex flex-col justify-between shadow">
                <span className="text-[10px] font-bold text-white/30 tracking-wider uppercase">Modified Elements</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-white">
                    {result.diff.modified.length}
                  </span>
                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                    ▲ Altered
                  </span>
                </div>
              </div>

              {/* Unchanged */}
              <div className="bg-[#151515] border border-white/5 p-5 rounded-2xl flex flex-col justify-between shadow">
                <span className="text-[10px] font-bold text-white/30 tracking-wider uppercase">Unchanged Count</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-white/40">
                    {result.diff.unchanged_count}
                  </span>
                  <span className="text-[10px] font-semibold text-white/30 border border-white/5 px-1.5 py-0.5 rounded">
                    = Safe
                  </span>
                </div>
              </div>

            </div>

            {/* Main Tabs Navigation */}
            <div className="flex border-b border-white/5">
              <button
                onClick={() => setActiveTab('report')}
                className={`px-6 py-3.5 text-sm font-semibold border-b-2 -mb-[2px] transition-all flex items-center gap-2 ${
                  activeTab === 'report'
                    ? 'border-purple-500 text-white'
                    : 'border-transparent text-white/40 hover:text-white/80'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Gemini Engineer Report
              </button>
              
              <button
                onClick={() => setActiveTab('changes')}
                className={`px-6 py-3.5 text-sm font-semibold border-b-2 -mb-[2px] transition-all flex items-center gap-2 ${
                  activeTab === 'changes'
                    ? 'border-purple-500 text-white'
                    : 'border-transparent text-white/40 hover:text-white/80'
                }`}
              >
                <Layers className="h-4 w-4" />
                Structured Geometric Changes ({filteredChanges.length})
              </button>
            </div>

            {/* Tab: REPORT */}
            {activeTab === 'report' && (
              <div className="bg-[#151515] border border-white/5 rounded-3xl p-8 relative shadow-xl">
                
                {/* Copy Button */}
                <div className="absolute top-6 right-6">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition-all active:scale-[0.98]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy Markdown'}
                  </button>
                </div>

                {/* Render report markdown */}
                <div className="prose max-w-none">
                  {renderMarkdown(result.report)}
                </div>
              </div>
            )}

            {/* Tab: GEOMETRIC CHANGES */}
            {activeTab === 'changes' && (
              <div className="space-y-4">
                
                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#151515] border border-white/5 p-4 rounded-2xl shadow">
                  
                  {/* Change Type Buttons */}
                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    {(['all', 'added', 'removed', 'modified'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setChangeTypeFilter(type)}
                        className={`text-xs font-semibold px-3.5 py-2 rounded-lg capitalize transition-all ${
                          changeTypeFilter === type
                            ? 'bg-white/10 text-white shadow'
                            : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Structural Relevance Filter */}
                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => setRelevanceFilter('high')}
                      className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                        relevanceFilter === 'high'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/20'
                          : 'text-white/40 hover:text-white/70 border border-transparent'
                      }`}
                    >
                      High Relevance Only
                    </button>
                    <button
                      onClick={() => setRelevanceFilter('all')}
                      className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition-all ${
                        relevanceFilter === 'all'
                          ? 'bg-white/10 text-white'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      All Entities
                    </button>
                  </div>

                </div>

                {/* Detailed Table */}
                <div className="bg-[#151515] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                  {filteredChanges.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <th className="text-[10px] font-bold tracking-wider text-white/30 uppercase px-6 py-4">Action</th>
                            <th className="text-[10px] font-bold tracking-wider text-white/30 uppercase px-6 py-4">Entity Type</th>
                            <th className="text-[10px] font-bold tracking-wider text-white/30 uppercase px-6 py-4">Drawing Layer</th>
                            <th className="text-[10px] font-bold tracking-wider text-white/30 uppercase px-6 py-4">Structural Priority</th>
                            <th className="text-[10px] font-bold tracking-wider text-white/30 uppercase px-6 py-4">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredChanges.map(({ item, changeType }, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.01] transition-all">
                              
                              {/* Change Type Column */}
                              <td className="px-6 py-4 font-sans text-xs">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded font-bold uppercase text-[9px] tracking-wide ${
                                    changeType === 'added'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                      : changeType === 'removed'
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/10'
                                  }`}
                                >
                                  {changeType}
                                </span>
                              </td>

                              {/* Entity Type Column */}
                              <td className="px-6 py-4 text-xs font-semibold text-white/80 font-mono">
                                {item.type}
                              </td>

                              {/* Layer Column */}
                              <td className="px-6 py-4 text-xs text-white/60 font-mono">
                                {item.layer}
                              </td>

                              {/* Relevance Column */}
                              <td className="px-6 py-4 text-xs">
                                <span
                                  className={`inline-flex items-center gap-1 text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded ${
                                    item.structural_relevance === 'high'
                                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                      : 'bg-white/5 text-white/30 border border-white/5'
                                  }`}
                                >
                                  {item.structural_relevance === 'high' ? 'High Relevance' : 'Low Relevance'}
                                </span>
                              </td>

                              {/* Modification Details Column */}
                              <td className="px-6 py-4 text-xs text-white/50">
                                {changeType === 'modified' && item.change ? (
                                  <div className="space-y-1">
                                    {item.change.moved_distance !== undefined && (
                                      <p className="flex items-center gap-1.5 text-purple-300">
                                        <ArrowRight className="h-3 w-3 shrink-0" />
                                        Shifted: {item.change.moved_distance} units
                                      </p>
                                    )}
                                    {item.change.attributes && (
                                      <div className="text-[10px] font-mono text-white/30">
                                        {Object.entries(item.change.attributes).map(([key, val]: any) => (
                                          <p key={key}>
                                            {key}: {JSON.stringify(val.before)} → {JSON.stringify(val.after)}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : changeType === 'added' ? (
                                  'New structural addition'
                                ) : (
                                  'Removed from revision'
                                )}
                              </td>

                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 flex flex-col items-center justify-center text-center text-white/30">
                      <ChevronRight className="h-8 w-8 text-white/10 mb-2 rotate-90" />
                      <p className="text-sm font-semibold">No elements match the current filters.</p>
                      <p className="text-xs text-white/20 mt-0.5">Toggle filters or change priority settings.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </DashboardLayout>
  )
}

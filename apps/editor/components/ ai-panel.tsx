'use client'

import { ArrowUpRight, Paperclip, Sparkles, Trash2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user' | 'system'
  text: string
}

type ChatResponse = {
  reply: string
  error?: string
  message?: string
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ask me to change the scene or answer design questions.',
}

export default function AiPanel() {
  const params = useParams()
  const sceneId = typeof params?.id === 'string' ? params.id : undefined

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const key = `chat-history-${sceneId || 'local'}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved messages', e)
      }
    } else {
      setMessages([WELCOME_MESSAGE])
    }
  }, [sceneId])

  useEffect(() => {
    const key = `chat-history-${sceneId || 'local'}`
    localStorage.setItem(key, JSON.stringify(messages))
  }, [messages, sceneId])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  const sendMessage = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt || isSending) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
    }
    const assistantId = `assistant-${Date.now()}`

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: 'assistant', text: 'Thinking...' },
    ])
    setInput('')
    setIsSending(true)

    try {
      const response = await fetch('/api/ai/chat', {
        body: JSON.stringify({ message: prompt, sceneId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      const payload = (await response.json()) as ChatResponse

      if (!response.ok) {
        throw new Error(
          payload.message || payload.error || `AI request failed (${response.status})`,
        )
      }

      // Note: the MCP tools already mutated the shared scene store directly.

      setMessages((current) =>
        current.map((m) => (m.id === assistantId ? { ...m, text: payload.reply } : m)),
      )
    } catch (error) {
      setMessages((current) =>
        current.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text:
                  error instanceof Error
                    ? `I couldn't complete that request: ${error.message}`
                    : "I couldn't complete that request.",
              }
            : m,
        ),
      )
    } finally {
      setIsSending(false)
      scrollToBottom()
    }
  }, [input, isSending, scrollToBottom, sceneId])

  const clearConversation = useCallback(() => {
    setMessages([WELCOME_MESSAGE])
    setInput('')
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#151515] p-3 text-foreground">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[#171717] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              aria-label="Clear chat"
              onClick={clearConversation}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              aria-label="Chat history"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10"
              type="button"
            >
              <Paperclip className="h-4 w-4 rotate-45" />
            </button>
          </div>

          <div className="flex h-full flex-col px-6 pt-16 pb-4 text-center">
            {messages.length === 1 ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white/5 text-white/80 shadow-inner shadow-black/20">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-medium text-2xl tracking-[-0.03em] text-white/80">Ask AI</p>
                    <p className="mt-2 max-w-60 text-balance text-lg leading-7 text-white/40">
                      Chat with the scene and get design suggestions.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto pb-4 text-left">
                {messages.map((message) => (
                  <div
                    className={`max-w-[88%] rounded-3xl border px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === 'user'
                        ? 'ml-auto border-white/10 bg-white/8 text-white/90'
                        : 'border-white/8 bg-white/4 text-white/75'
                    }`}
                    key={message.id}
                  >
                    {message.text}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        <div className="border-white/10 border-t px-4 py-4">
          <div className="rounded-[28px] border border-white/10 bg-white/4 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
            <div className="flex items-start gap-3">
              <button
                aria-label="Attach file"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10"
                type="button"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <span className="block font-medium text-xs uppercase tracking-[0.22em] text-white/55">
                  Ask anything...
                </span>
                <textarea
                  className="mt-3 min-h-20 w-full resize-none border-0 bg-transparent text-lg leading-7 text-white/85 outline-none placeholder:text-white/28"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Describe what you want to change..."
                  value={input}
                />

                <div className="mt-4 flex items-end justify-end">
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9c9c9] text-black transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSending || !input.trim()}
                    onClick={() => {
                      void sendMessage()
                    }}
                    type="button"
                  >
                    <ArrowUpRight className="h-4 w-4 -rotate-45" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

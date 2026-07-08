export interface McpTool {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

type JsonRpcId = number

/**
 * Minimal MCP client over the Streamable HTTP transport.
 * Talks JSON-RPC 2.0 to a `pascal-mcp --http` sidecar.
 */
export class PascalMcpClient {
  private readonly baseUrl: string
  private readonly token?: string
  private sessionId?: string
  private nextId: JsonRpcId = 1
  private initPromise?: Promise<void>

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...extra,
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId
    return headers
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} }),
    })

    const sid = res.headers.get('mcp-session-id')
    if (sid) this.sessionId = sid

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`MCP "${method}" failed (${res.status}): ${text}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    let payload: any

    if (contentType.includes('text/event-stream')) {
      const raw = await res.text()
      const dataLines = raw
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter(Boolean)
      const last = dataLines[dataLines.length - 1]
      payload = last ? JSON.parse(last) : undefined
    } else {
      payload = await res.json()
    }

    if (payload?.error) {
      throw new Error(
        `MCP "${method}" error: ${payload.error.message ?? JSON.stringify(payload.error)}`,
      )
    }

    return payload?.result
  }

  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInitialize()
    }
    return this.initPromise
  }

  private async doInitialize(): Promise<void> {
    await this.rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'pascal-editor-ai-panel', version: '1.0.0' },
    })

    // MCP requires a follow-up "initialized" notification (no response expected).
    await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    })
  }

  async listTools(): Promise<McpTool[]> {
    const result = (await this.rpc('tools/list')) as { tools?: McpTool[] } | undefined
    return result?.tools ?? []
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.rpc('tools/call', { name, arguments: args })
  }
}

const GEMINI_TYPE_MAP: Record<string, string> = {
  object: 'OBJECT',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
}

/** Converts a JSON-Schema fragment (as returned by MCP tools/list) into Gemini's functionDeclaration schema dialect. */
export function jsonSchemaToGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'STRING' }
  }
  const s = schema as Record<string, any>
  const rawType = Array.isArray(s.type) ? s.type[0] : s.type
  const geminiType = GEMINI_TYPE_MAP[rawType] ?? 'STRING'

  const out: Record<string, unknown> = { type: geminiType }
  if (s.description) out.description = s.description
  if (Array.isArray(s.enum)) out.enum = s.enum

  if (geminiType === 'OBJECT' && s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([key, value]) => [key, jsonSchemaToGeminiSchema(value)]),
    )
    if (Array.isArray(s.required)) out.required = s.required
  }

  if (geminiType === 'ARRAY' && s.items) {
    out.items = jsonSchemaToGeminiSchema(s.items)
  }

  return out
}

export function mcpToolsToGeminiDeclarations(tools: McpTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    parameters: jsonSchemaToGeminiSchema(tool.inputSchema),
  }))
}

// This server only tolerates a single `initialize` call for its entire process
// lifetime (it's built for one long-lived client, e.g. Claude Desktop or Cursor,
// not a fresh session per HTTP request). So we keep exactly one client + session
// alive for the lifetime of the Next.js server process, instead of constructing
// a new PascalMcpClient (and re-initializing) on every chat request.
let singleton: PascalMcpClient | undefined

export function getPascalMcpClient(baseUrl: string, token?: string): PascalMcpClient {
  if (!singleton) {
    singleton = new PascalMcpClient(baseUrl, token)
  }
  return singleton
}

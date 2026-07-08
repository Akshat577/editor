import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPascalMcpClient, mcpToolsToGeminiDeclarations } from '@/lib/pascal-mcp-client'

export const runtime = 'nodejs'

const GEMINI_MODEL = 'gemini-3-flash-preview'
const MAX_TOOL_ROUNDS = 8

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sceneId: z.string().nullable().optional(),
})

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'missing_gemini_api_key' }, { status: 500 })
  }

  const mcpUrl = process.env.PASCAL_MCP_URL
  if (!mcpUrl) {
    return NextResponse.json({ error: 'mcp_not_configured' }, { status: 500 })
  }
  const mcpToken = process.env.PASCAL_MCP_HTTP_TOKEN

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { message, sceneId } = parsed.data
  const mcp = getPascalMcpClient(mcpUrl, mcpToken)

  try {
    await mcp.initialize()
    const tools = await mcp.listTools()
    const declarations = mcpToolsToGeminiDeclarations(tools)

    // Scene state lives server-side in the MCP "bridge" — tools like create_wall,
    // add_door, furnish_room, etc. all operate on whatever scene is currently loaded
    // there. There is no per-call sceneId argument, so we load it once up front.
    let sceneLoadError: string | null = null
    if (sceneId) {
      try {
        await mcp.callTool('load_scene', { id: sceneId })
      } catch (e) {
        sceneLoadError = e instanceof Error ? e.message : 'failed to load scene'
      }
    }

    const systemInstruction = buildSystemInstruction(sceneId ?? undefined, sceneLoadError)
    const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: message }] }]

    let finalReply = ''

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await callGemini({ apiKey, systemInstruction, contents, declarations })
      const parts = result?.candidates?.[0]?.content?.parts ?? []
      const functionCalls = parts.filter(
        (part: GeminiPart): part is GeminiFunctionCallPart => 'functionCall' in part,
      )

      if (functionCalls.length === 0) {
        finalReply = parts
          .map((part: GeminiPart) => ('text' in part ? part.text : ''))
          .join('')
          .trim()
        break
      }

      contents.push({ role: 'model', parts })

      const responseParts: GeminiPart[] = []
      for (const part of functionCalls) {
        const { name, args } = part.functionCall

        let toolResult: unknown
        try {
          toolResult = await mcp.callTool(name, args ?? {})
        } catch (e) {
          toolResult = { error: e instanceof Error ? e.message : 'tool_call_failed' }
        }

        responseParts.push({
          functionResponse: { name, response: { result: toolResult } },
        })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    return NextResponse.json({ reply: finalReply || 'Done.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ai_chat_failed'
    return NextResponse.json({ error: 'ai_chat_failed', message }, { status: 502 })
  }
}

function buildSystemInstruction(sceneId?: string, sceneLoadError?: string | null): string {
  const lines = [
    'You are the Pascal editor AI assistant.',
    'You have MCP tools that read and mutate the currently loaded Pascal scene: get_scene, get_node, describe_node, find_nodes, list_levels, get_level_summary, get_walls, get_zones, verify_scene, measure, create_story_shell, create_roof, create_stair_between_levels, search_assets, create_room, add_door, add_window, furnish_room, apply_patch, create_level, create_wall, place_item, cut_opening, set_zone, duplicate_level, delete_node, undo, redo, export_json, validate_scene, check_collisions, and more.',
    'Scene state lives in a shared server-side bridge. All of these tools operate on whatever scene is currently loaded there — none of them take a sceneId argument directly.',
  ]

  if (sceneLoadError) {
    lines.push(
      `A scene was supposed to be loaded (id "${sceneId}") but load_scene failed: ${sceneLoadError}. Tell the user this scene could not be loaded before doing anything else.`,
    )
  } else if (sceneId) {
    lines.push(
      `Scene "${sceneId}" has already been loaded into the bridge for you via load_scene — do not call load_scene again unless the user asks to switch scenes.`,
    )
  } else {
    lines.push(
      'No scene ID was provided by the client. If a tool call needs a loaded scene and none exists, tell the user to open or create one first.',
    )
  }

  lines.push(
    'Always prefer the most specific mutation tool available (e.g. create_wall, add_door, furnish_room, place_item, set_zone, create_room) over apply_patch, which is a lower-level fallback.',
    'Use physical dimensions in meters.',
    'Call search_assets before place_item to get a valid catalogItemId.',
    'If the user is only asking a question about the scene, use the read-only tools (get_scene, describe_node, find_nodes, etc.) to answer directly rather than calling mutation tools.',
    'After calling tools to make changes, briefly summarize in plain language what changed. Consider calling verify_scene after complex multi-step edits.',
  )

  return lines.join('\n')
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

type GeminiFunctionCallPart = { functionCall: { name: string; args: Record<string, unknown> } }

type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] }

async function callGemini(options: {
  apiKey: string
  systemInstruction: string
  contents: GeminiContent[]
  declarations: unknown[]
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${options.apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: options.contents,
      systemInstruction: { parts: [{ text: options.systemInstruction }] },
      tools: options.declarations.length
        ? [{ functionDeclarations: options.declarations }]
        : undefined,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API call to ${GEMINI_MODEL} failed (${res.status}): ${text}`)
  }

  return res.json()
}

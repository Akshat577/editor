import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let sessionDir = ''
  try {
    const formData = await request.formData()
    const beforeFile = formData.get('before') as File | null
    const afterFile = formData.get('after') as File | null

    if (!beforeFile || !afterFile) {
      return NextResponse.json(
        { error: 'Both "before" and "after" files are required.' },
        { status: 400 }
      )
    }

    // Define directories
    const dwgToJsonDir = '/Users/akshat/Desktop/editor/dwgtojson'
    const sessionId = crypto.randomUUID()
    sessionDir = path.join(dwgToJsonDir, 'output', 'sessions', `session_${sessionId}`)

    // Create session directory
    await fs.mkdir(sessionDir, { recursive: true })

    // Save DWG files to session directory
    const beforeDwgPath = path.join(sessionDir, 'before.dwg')
    const afterDwgPath = path.join(sessionDir, 'after.dwg')

    const beforeBuffer = Buffer.from(await beforeFile.arrayBuffer())
    const afterBuffer = Buffer.from(await afterFile.arrayBuffer())

    await fs.writeFile(beforeDwgPath, beforeBuffer)
    await fs.writeFile(afterDwgPath, afterBuffer)

    // Execute Python pipeline
    const pythonExecutable = path.join(dwgToJsonDir, '.venv', 'bin', 'python')
    const scriptPath = path.join(dwgToJsonDir, 'runpipeline.py')

    const geminiApiKey = process.env.GEMINI_API_KEY 
    // Build command
    const command = `"${pythonExecutable}" "${scriptPath}" "${beforeDwgPath}" "${afterDwgPath}" --workdir "${sessionDir}"`

    // Run subprocess
    const { stdout, stderr } = await execAsync(command, {
      cwd: dwgToJsonDir,
      env: {
        ...process.env,
        GEMINI_API_KEY: geminiApiKey,
      },
    })

    console.log('Subprocess execution output:', stdout)
    if (stderr) {
      console.warn('Subprocess execution stderr:', stderr)
    }

    // Verify output files exist
    const diffJsonPath = path.join(sessionDir, 'diff_report.json')
    const reportMdPath = path.join(sessionDir, 'engineer_report.md')

    try {
      await fs.access(diffJsonPath)
      await fs.access(reportMdPath)
    } catch {
      throw new Error(`Pipeline executed but output files were not generated. Stderr: ${stderr}`)
    }

    // Read report and diff results
    const reportMarkdown = await fs.readFile(reportMdPath, 'utf-8')
    const diffJsonString = await fs.readFile(diffJsonPath, 'utf-8')
    const diffData = JSON.parse(diffJsonString)

    return NextResponse.json({
      success: true,
      report: reportMarkdown,
      diff: diffData,
    })
  } catch (error: any) {
    console.error('Error running DWG comparison:', error)
    return NextResponse.json(
      {
        error: 'Failed to process DWG comparison',
        message: error.message || 'Unknown error',
        details: error.stack || '',
      },
      { status: 500 }
    )
  } finally {
   
    if (sessionDir) {
      fs.rm(sessionDir, { recursive: true, force: true }).catch((err) => {
        console.error(`Failed to clean up session directory ${sessionDir}:`, err)
      })
    }
  }
}

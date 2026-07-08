#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function findWebIfcDir(startDir) {
  let dir = startDir
  while (dir && dir !== '/') {
    const candidate = join(dir, 'node_modules', 'web-ifc')
    if (existsSync(join(candidate, 'web-ifc.wasm'))) return candidate
    dir = resolve(dir, '..')
  }
  return null
}

const webIfcDir = findWebIfcDir(import.meta.dirname)
if (!webIfcDir) {
  console.warn('[editor] web-ifc package not found — wasm copy skipped.')
  process.exit(0)
}
const publicDir = join(import.meta.dirname, '..', 'public')

mkdirSync(publicDir, { recursive: true })

const files = ['web-ifc.wasm', 'web-ifc-mt.wasm', 'web-ifc-node.wasm']
for (const name of files) {
  const src = join(webIfcDir, name)
  const dst = join(publicDir, name)
  try {
    const srcSize = statSync(src).size
    let dstSize = 0
    try {
      dstSize = statSync(dst).size
    } catch {
      /* not present yet */
    }
    if (srcSize === dstSize) {
      continue
    }
    copyFileSync(src, dst)
    console.log(`[editor] copied ${name} (${(srcSize / 1024).toFixed(0)} KB)`)
  } catch (err) {
    console.warn(`[editor] could not copy ${name}:`, err.message)
  }
}

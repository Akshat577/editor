'use client'

import { type AnyNode, type AnyNodeId, sceneRegistry, useScene } from '@pascal-app/core'
import type { PascalSceneGraph } from '@pascal-app/ifc-converter'
import { useViewer, Viewer } from '@pascal-app/viewer'
import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Box3, type Object3D, Vector3 } from 'three'

type CameraControlsImpl = {
  fitToBox: (
    target: Object3D,
    enableTransition: boolean,
    options?: {
      paddingTop?: number
      paddingBottom?: number
      paddingLeft?: number
      paddingRight?: number
    },
  ) => Promise<unknown>
  getTarget: (out: Vector3) => Vector3
  moveTo: (x: number, y: number, z: number, enableTransition?: boolean) => Promise<unknown>
}

import { FitSceneButton, LevelSelector, PreviewToolbar } from './PreviewToolbar'

interface PascalSceneViewerProps {
  sceneGraph: PascalSceneGraph
  className?: string
  onSelectNode?: (nodeId: string | null) => void
}

function AutoFit({ trigger }: { trigger: number }) {
  const sceneRoot = useThree((s) => s.scene)
  const controls = useThree((s) => s.controls) as CameraControlsImpl | null
  const lastFitRef = useRef(-1)

  useEffect(() => {
    if (!controls || trigger === lastFitRef.current) return
    let cancelled = false
    let id1 = 0
    const id0 = requestAnimationFrame(() => {
      if (cancelled) return
      id1 = requestAnimationFrame(() => {
        if (cancelled) return
        const box = new Box3().setFromObject(sceneRoot)
        if (!box.isEmpty()) {
          controls.fitToBox(sceneRoot, true, {
            paddingTop: 1,
            paddingBottom: 1,
            paddingLeft: 1,
            paddingRight: 1,
          })
          lastFitRef.current = trigger
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id0)
      cancelAnimationFrame(id1)
    }
  }, [trigger, sceneRoot, controls])

  return null
}

function LevelFocus() {
  const levelId = useViewer((s) => s.selection.levelId)
  const controls = useThree((s) => s.controls) as CameraControlsImpl | null
  const target = useRef(new Vector3())
  const seededRef = useRef(false)

  useEffect(() => {
    if (!controls) return
    if (!seededRef.current) {
      seededRef.current = true
      return
    }
    if (!levelId) return
    const levelMesh = sceneRegistry.nodes.get(levelId)
    if (!levelMesh) return
    controls.getTarget(target.current)
    controls.moveTo(target.current.x, levelMesh.position.y, target.current.z, true)
  }, [levelId, controls])

  return null
}

export default function PascalSceneViewer({
  sceneGraph,
  className,
  onSelectNode,
}: PascalSceneViewerProps) {
  const setScene = useScene((s) => s.setScene)
  const setSelection = useViewer((s) => s.setSelection)
  const [fitTrigger, setFitTrigger] = useState(0)

  useEffect(() => {
    setScene(sceneGraph.nodes as Record<AnyNodeId, AnyNode>, sceneGraph.rootNodeIds as AnyNodeId[])
    const allNodes = Object.values(sceneGraph.nodes) as AnyNode[]
    const firstBuilding = allNodes.find((n) => n.type === 'building')
    const firstLevel = allNodes.find((n) => n.type === 'level')
    setSelection({
      buildingId: (firstBuilding?.id ?? null) as never,
      levelId: (firstLevel?.id ?? null) as never,
      zoneId: null,
      selectedIds: [],
    })
    setFitTrigger((n) => n + 1)
  }, [sceneGraph, setScene, setSelection])

  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const zoneId = useViewer((s) => s.selection.zoneId)
  useEffect(() => {
    onSelectNode?.((selectedIds[0] as string | undefined) ?? zoneId ?? null)
  }, [selectedIds, zoneId, onSelectNode])

  const onFit = useCallback(() => {
    setFitTrigger((n) => n + 1)
  }, [])

  return (
    <div
      className={
        className ??
        'relative w-full h-[600px] overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-inner'
      }
    >
      <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto">
          <PreviewToolbar />
        </div>
      </div>
      <div className="pointer-events-none absolute top-4 right-4 z-10">
        <div className="pointer-events-auto">
          <FitSceneButton onFit={onFit} />
        </div>
      </div>
      <div className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2">
        <div className="pointer-events-auto">
          <LevelSelector />
        </div>
      </div>
      <Viewer postProcessing={false}>
        <CameraControls makeDefault />
        <AutoFit trigger={fitTrigger} />
        <LevelFocus />
      </Viewer>
    </div>
  )
}

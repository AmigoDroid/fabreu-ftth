import React from "react"
import { CEOSplitterType, SplitterRef } from "@/types/ftth"

export type Pt = { x: number; y: number }
export type SpliceCurve = { key: string; a: Pt; b: Pt; color: string }

export function fanout(type: CEOSplitterType) {
  return Number(String(type).replace("1x", ""))
}

export function legsFromType(type: CEOSplitterType) {
  return Array.from({ length: fanout(type) }, (_, i) => i + 1)
}

export function refKey(ref: SplitterRef) {
  return `${ref.portId}::${ref.fibraId}`
}

export function chipStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    border: active ? "2px solid #111" : "1px solid #ddd",
    opacity: disabled ? 0.55 : 1,
    background: "#fff",
    userSelect: "none"
  }
}

export function dotStyle(color: string): React.CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: color,
    border: "1px solid #333"
  }
}

export function tubeGroups(total: number, perTube: number) {
  const groups: Array<{ tube: number; start: number; end: number }> = []
  let i = 1
  let tube = 1
  while (i <= total) {
    groups.push({ tube, start: i, end: Math.min(total, i + perTube - 1) })
    i += perTube
    tube += 1
  }
  return groups
}

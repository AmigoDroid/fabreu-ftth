import React from "react"
import { CEOSplitterType } from "@/types/ftth"

export type Pt = { x: number; y: number }
export type DiagramLine = { key: string; a: Pt; b: Pt; color: string }

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

export function dotStyle(color: string, white = false): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: 999,
    background: white ? "#ffffff" : color,
    border: "1px solid #333"
  }
}

export function legsFromType(t: CEOSplitterType) {
  const n = Number(String(t).replace("1x", ""))
  const safe = Number.isFinite(n) && n > 0 ? n : 2
  return Array.from({ length: safe }, (_, i) => i + 1)
}

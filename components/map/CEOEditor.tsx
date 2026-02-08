"use client"

import { CEO, FiberSegment } from "@/types/ftth"
import React, { useLayoutEffect, useMemo, useRef, useState } from "react"

type Props = {
  ceo: CEO
  caboA: FiberSegment
  caboB: FiberSegment
  onClose: () => void
  onFuse: (ceoId: number, aFibraId: number, bFibraId: number) => void
  onUnfuse: (ceoId: number, aFibraId: number, bFibraId: number) => void
}

type Pt = { x: number; y: number }

export function CEOEditor({ ceo, caboA, caboB, onClose, onFuse, onUnfuse }: Props) {
  const [selA, setSelA] = useState<number | null>(null)
  const [selB, setSelB] = useState<number | null>(null)

  // ✅ ref do painel (pra escutar scroll) e do DIAGRAMA (base de cálculo)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const diagramRef = useRef<HTMLDivElement | null>(null)

  const [lines, setLines] = useState<Array<{ key: string; a: Pt; b: Pt; color: string }>>([])

  const fusedA = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of ceo.fusoes) m.set(f.aFibraId, f.bFibraId)
    return m
  }, [ceo.fusoes])

  const fusedB = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of ceo.fusoes) m.set(f.bFibraId, f.aFibraId)
    return m
  }, [ceo.fusoes])

  function getColorA(aFibraId: number) {
    return caboA.fibras.find((f) => f.id === aFibraId)?.cor ?? "#111"
  }

  function tryFuse(aId: number | null, bId: number | null) {
    if (!aId || !bId) return
    if (fusedA.has(aId) || fusedB.has(bId)) return
    onFuse(ceo.id, aId, bId)
    setSelA(null)
    setSelB(null)
  }

  function chipStyle(color: string, active: boolean, disabled: boolean): React.CSSProperties {
    return {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 10,
      cursor: disabled ? "not-allowed" : "pointer",
      border: active ? "2px solid #111" : "1px solid #ddd",
      opacity: disabled ? 0.5 : 1,
      background: "#fff",
      userSelect: "none"
    }
  }

  const panel: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1000,
    width: 520,
    maxHeight: "85vh",
    overflow: "auto",
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e5e5e5",
    boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
    padding: 14
  }

  // ✅ calcula linhas relativo ao diagramRef (mesmo container do SVG)
  useLayoutEffect(() => {
    const panelEl = panelRef.current
    const diagramEl = diagramRef.current
    if (!panelEl || !diagramEl) return

    let raf = 0

    const calc = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const baseRect = diagramEl.getBoundingClientRect()

        const next: Array<{ key: string; a: Pt; b: Pt; color: string }> = []

        for (const f of ceo.fusoes) {
          const aEl = diagramEl.querySelector<HTMLElement>(`[data-a="${f.aFibraId}"]`)
          const bEl = diagramEl.querySelector<HTMLElement>(`[data-b="${f.bFibraId}"]`)
          if (!aEl || !bEl) continue

          const aRect = aEl.getBoundingClientRect()
          const bRect = bEl.getBoundingClientRect()

          const a: Pt = {
            x: aRect.right - baseRect.left,
            y: aRect.top - baseRect.top + aRect.height / 2
          }

          const b: Pt = {
            x: bRect.left - baseRect.left,
            y: bRect.top - baseRect.top + bRect.height / 2
          }

          next.push({
            key: `${ceo.id}-${f.aFibraId}-${f.bFibraId}`,
            a,
            b,
            color: getColorA(f.aFibraId)
          })
        }

        setLines(next)
      })
    }

    // primeira
    calc()

    // recalcula ao scroll do painel
    const onScroll = () => calc()
    panelEl.addEventListener("scroll", onScroll, { passive: true })

    // recalcula ao resize (painel/viewport)
    window.addEventListener("resize", calc, { passive: true })

    // recalcula se o layout interno mudar
    const ro = new ResizeObserver(() => calc())
    ro.observe(diagramEl)

    return () => {
      cancelAnimationFrame(raf)
      panelEl.removeEventListener("scroll", onScroll as any)
      window.removeEventListener("resize", calc as any)
      ro.disconnect()
    }
  }, [ceo.id, ceo.fusoes, caboA.fibras, caboB.fibras])

  return (
    <div ref={panelRef} style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{ceo.nome}</div>
          <div style={{ fontSize: 12, color: "#555" }}>{ceo.descricao}</div>
          <div style={{ fontSize: 12, color: "#555" }}>
            Cabo A: <b>{caboA.nome}</b> • Cabo B: <b>{caboB.nome}</b>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            Clique em <b>A</b> e depois em <b>B</b> para fusionar.
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 10,
            padding: "6px 10px",
            cursor: "pointer"
          }}
        >
          Fechar
        </button>
      </div>

      {/* ✅ DIAGRAMA (base do SVG + colunas) */}
      <div ref={diagramRef} style={{ position: "relative", marginTop: 12 }}>
        {/* SVG por cima do diagrama */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 2
          }}
        >
          {lines.map((ln) => {
            const mid = (ln.b.x - ln.a.x) * 0.35
            const c1x = ln.a.x + mid
            const c2x = ln.b.x - mid
            const d = `M ${ln.a.x} ${ln.a.y} C ${c1x} ${ln.a.y}, ${c2x} ${ln.b.y}, ${ln.b.x} ${ln.b.y}`

            return (
              <path
                key={ln.key}
                d={d}
                fill="none"
                stroke={ln.color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.9}
              />
            )
          })}
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 12, alignItems: "start" }}>
          {/* CABO A */}
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Cabo A (12 fibras)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {caboA.fibras.map((f) => {
                const ja = fusedA.has(f.id)
                const active = selA === f.id
                const disabled = ja

                return (
                  <div
                    key={f.id}
                    data-a={f.id}
                    style={chipStyle(f.cor, active, disabled)}
                    onClick={() => {
                      if (disabled) return
                      const next = active ? null : f.id
                      setSelA(next)
                      tryFuse(next, selB)
                    }}
                    title={ja ? `Já fusionada com B${fusedA.get(f.id)}` : "Clique para selecionar"}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                    <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{ja ? `🔗 B${fusedA.get(f.id)}` : "—"}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* BLOCO CEO */}
          <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3, height: "fit-content" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "2px solid #111",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                background: "#fff"
              }}
              title="CEO"
            >
              CEO
            </div>
          </div>

          {/* CABO B */}
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Cabo B (12 fibras)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {caboB.fibras.map((f) => {
                const ja = fusedB.has(f.id)
                const active = selB === f.id
                const disabled = ja

                return (
                  <div
                    key={f.id}
                    data-b={f.id}
                    style={chipStyle(f.cor, active, disabled)}
                    onClick={() => {
                      if (disabled) return
                      const next = active ? null : f.id
                      setSelB(next)
                      tryFuse(selA, next)
                    }}
                    title={ja ? `Já fusionada com A${fusedB.get(f.id)}` : "Clique para selecionar"}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                    <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{ja ? `🔗 A${fusedB.get(f.id)}` : "—"}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE FUSÕES */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Fusões ({ceo.fusoes.length}/12)</div>

        {ceo.fusoes.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666" }}>
            Selecione uma fibra do Cabo A e depois uma do Cabo B para criar a fusão.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ceo.fusoes.map((f, idx) => (
              <div
                key={`${f.aFibraId}-${f.bFibraId}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: 10,
                  border: "1px solid #eee",
                  borderRadius: 12
                }}
              >
                <div style={{ fontSize: 13 }}>
                  <b>A{f.aFibraId}</b> ↔ <b>B{f.bFibraId}</b>
                </div>
                <button
                  onClick={() => onUnfuse(ceo.id, f.aFibraId, f.bFibraId)}
                  style={{
                    border: "1px solid #ddd",
                    background: "#fff",
                    borderRadius: 10,
                    padding: "6px 10px",
                    cursor: "pointer"
                  }}
                >
                  Desfazer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
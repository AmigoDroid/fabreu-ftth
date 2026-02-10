// components/map/Map.tsx
"use client"

import { GoogleMap, DrawingManager, Marker, useLoadScript } from "@react-google-maps/api"
import { useEffect, useMemo, useState } from "react"
import { getCurrentCoordinates } from "@/util/geolocaton"
import { PopupSalvar } from "../formInput"
import { PopupSalvarCaixa } from "../boxFormPopup"
import { MapToolbar } from "./MapToolbar"
import { FiberLayer } from "./FiberLayer"
import { ClientLayer } from "./ClientLayer"
import { CEOLayer } from "./CEOLayer"
import { useFiberEditor } from "./useFiberEditor"
import { Client, FiberSegment } from "@/types/ftth"
import { CEOEditor } from "./CEOEditor"
import { CTOEditor } from "./CTOEditor"
import { OLTEditor } from "./OLTEditor"
import { DIOEditor } from "./DIOEditor"
import { ClientNodeEditor } from "./ClientNodeEditor"

type Props = {
  clients: Client[]
  fibers: FiberSegment[]
  drawMode?: boolean
}

type PopDef = {
  name: string
  position?: { lat: number; lng: number }
}

type CityDef = {
  name: string
  pops: PopDef[]
}

type ProjectDef = {
  id: string
  name: string
  cities: CityDef[]
}

const CITY_ALL = "__ALL__"
const POP_ALL = "__ALL__"

function normalizeId(raw: string, fallback: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `${fallback}-${Date.now()}`
}

function ensureCity(project: ProjectDef, cityName: string) {
  if (project.cities.some((c) => c.name === cityName)) return project
  return { ...project, cities: [...project.cities, { name: cityName, pops: [{ name: "POP Central" }] }] }
}

function ensurePop(city: CityDef, popName: string, position?: { lat: number; lng: number }) {
  const exists = city.pops.find((p) => p.name === popName)
  if (exists) {
    if (!position) return city
    return {
      ...city,
      pops: city.pops.map((p) => (p.name === popName ? { ...p, position } : p))
    }
  }
  return { ...city, pops: [...city.pops, { name: popName, position }] }
}

export default function Map({ clients, fibers, drawMode = false }: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: ["drawing", "geometry"]
  })

  const initialProjects = useMemo<ProjectDef[]>(() => {
    const map = new globalThis.Map<string, ProjectDef>()

    for (const f of fibers) {
      const projectId = f.projectId ?? "project-default"
      const city = f.city ?? "Cidade Base"
      const pop = f.pop ?? "POP Central"

      if (!map.has(projectId)) {
        map.set(projectId, { id: projectId, name: projectId === "project-default" ? "Projeto 1" : projectId, cities: [] })
      }

      let project = map.get(projectId)!
      project = ensureCity(project, city)
      project = {
        ...project,
        cities: project.cities.map((c) => (c.name === city ? ensurePop(c, pop) : c))
      }
      map.set(projectId, project)
    }

    if (map.size === 0) {
      map.set("project-default", {
        id: "project-default",
        name: "Projeto 1",
        cities: [{ name: "Cidade Base", pops: [{ name: "POP Central" }] }]
      })
    }

    return [...map.values()].map((p) => {
      if (p.cities.length === 0) {
        return { ...p, cities: [{ name: "Cidade Base", pops: [{ name: "POP Central" }] }] }
      }
      return {
        ...p,
        cities: p.cities.map((c) => ({
          ...c,
          pops: c.pops.length ? c.pops : [{ name: "POP Central" }]
        }))
      }
    })
  }, [fibers])

  const [projects, setProjects] = useState<ProjectDef[]>(initialProjects)
  const [activeProjectId, setActiveProjectId] = useState<string>(initialProjects[0]?.id ?? "project-default")
  const [cityFilter, setCityFilter] = useState<string>(CITY_ALL)
  const [popFilter, setPopFilter] = useState<string>(POP_ALL)
  const [workingCity, setWorkingCity] = useState<string>(initialProjects[0]?.cities[0]?.name ?? "Cidade Base")
  const [workingPop, setWorkingPop] = useState<string>(initialProjects[0]?.cities[0]?.pops[0]?.name ?? "POP Central")
  const [newProjectName, setNewProjectName] = useState("")
  const [newCityName, setNewCityName] = useState("")
  const [newPopName, setNewPopName] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activeProject = useMemo(() => projects.find((p) => p.id === activeProjectId) ?? projects[0], [projects, activeProjectId])
  const cityOptions = useMemo(() => activeProject?.cities ?? [{ name: "Cidade Base", pops: [{ name: "POP Central" }] }], [activeProject])
  const allPopNames = useMemo(() => [...new Set(cityOptions.flatMap((c) => c.pops.map((p) => p.name)))], [cityOptions])
  const resolvedWorkingCity = cityOptions.some((c) => c.name === workingCity) ? workingCity : (cityOptions[0]?.name ?? "Cidade Base")
  const popOptions = useMemo(() => cityOptions.find((c) => c.name === resolvedWorkingCity)?.pops ?? [{ name: "POP Central" }], [cityOptions, resolvedWorkingCity])
  const popOptionNames = useMemo(() => popOptions.map((p) => p.name), [popOptions])
  const resolvedWorkingPop = popOptionNames.includes(workingPop) ? workingPop : (popOptionNames[0] ?? "POP Central")
  const resolvedCityFilter = cityFilter === CITY_ALL || cityOptions.some((c) => c.name === cityFilter) ? cityFilter : CITY_ALL
  const resolvedPopFilter = popFilter === POP_ALL || allPopNames.includes(popFilter) ? popFilter : POP_ALL

  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null)
  const fiber = useFiberEditor(fibers, activeProjectId, resolvedWorkingCity, resolvedWorkingPop)

  useEffect(() => {
    getCurrentCoordinates()
      .then((p) => setCenter({ lat: p.latitude, lng: p.longitude }))
      .catch(() => setCenter({ lat: -23.55, lng: -46.63 }))
  }, [])

  const visibleFibers = useMemo(() => {
    let list = fiber.fiberList.filter((f) => (f.projectId ?? "project-default") === activeProjectId)
    if (resolvedCityFilter !== CITY_ALL) list = list.filter((f) => (f.city ?? "Cidade Base") === resolvedCityFilter)
    if (resolvedPopFilter !== POP_ALL) list = list.filter((f) => (f.pop ?? "POP Central") === resolvedPopFilter)
    return list
  }, [fiber.fiberList, activeProjectId, resolvedCityFilter, resolvedPopFilter])

  const visibleCeos = useMemo(() => {
    let list = fiber.ceos.filter((c) => (c.projectId ?? "project-default") === activeProjectId)
    if (resolvedCityFilter !== CITY_ALL) list = list.filter((c) => (c.city ?? "Cidade Base") === resolvedCityFilter)
    if (resolvedPopFilter !== POP_ALL) list = list.filter((c) => (c.pop ?? "POP Central") === resolvedPopFilter)
    return list
  }, [fiber.ceos, activeProjectId, resolvedCityFilter, resolvedPopFilter])

  const visibleClients = useMemo(() => {
    let list = clients.filter((c) => (c.projectId ?? activeProjectId) === activeProjectId)
    if (resolvedCityFilter !== CITY_ALL) list = list.filter((c) => (c.city ?? "Cidade Base") === resolvedCityFilter)
    if (resolvedPopFilter !== POP_ALL) list = list.filter((c) => (c.pop ?? "POP Central") === resolvedPopFilter)
    return list
  }, [clients, activeProjectId, resolvedCityFilter, resolvedPopFilter])

  const visiblePops = useMemo(() => {
    const result: Array<{ city: string; pop: PopDef }> = []
    for (const city of cityOptions) {
      if (resolvedCityFilter !== CITY_ALL && city.name !== resolvedCityFilter) continue
      for (const pop of city.pops) {
        if (resolvedPopFilter !== POP_ALL && pop.name !== resolvedPopFilter) continue
        result.push({ city: city.name, pop })
      }
    }
    return result
  }, [cityOptions, resolvedCityFilter, resolvedPopFilter])

  useEffect(() => {
    if (fiber.selectedCEOId == null) return
    if (!visibleCeos.some((c) => c.id === fiber.selectedCEOId)) fiber.setSelectedCEOId(null)
  }, [visibleCeos, fiber.selectedCEOId, fiber])

  const popStats = useMemo(() => {
    const stats = new globalThis.Map<string, { olt: number; dio: number; total: number }>()
    for (const node of fiber.ceos) {
      if ((node.projectId ?? "project-default") !== activeProjectId) continue
      if ((node.city ?? "Cidade Base") !== resolvedWorkingCity) continue
      const pop = node.pop ?? "POP Central"
      if (!stats.has(pop)) stats.set(pop, { olt: 0, dio: 0, total: 0 })
      const cur = stats.get(pop)!
      cur.total += 1
      if (node.tipo === "OLT") cur.olt += 1
      if (node.tipo === "DIO") cur.dio += 1
    }
    return [...stats.entries()]
  }, [fiber.ceos, activeProjectId, resolvedWorkingCity])

  if (!isLoaded || !center) return <p>Carregando...</p>

  const caixaSelecionada = fiber.selectedCEOId != null ? visibleCeos.find((c) => c.id === fiber.selectedCEOId) ?? null : null
  const selectedKind = fiber.pendingPlacement?.kind ?? "CEO"

  function addProject() {
    const name = newProjectName.trim()
    if (!name) return
    const id = normalizeId(name, "project")
    if (projects.some((p) => p.id === id)) {
      alert("Ja existe um projeto com esse nome.")
      return
    }
    const next: ProjectDef = { id, name, cities: [{ name: "Cidade Base", pops: [{ name: "POP Central" }] }] }
    setProjects((prev) => [...prev, next])
    setActiveProjectId(id)
    setCityFilter(CITY_ALL)
    setPopFilter(POP_ALL)
    setWorkingCity("Cidade Base")
    setWorkingPop("POP Central")
    setNewProjectName("")
  }

  function addCity() {
    const city = newCityName.trim()
    if (!city) return
    setProjects((prev) => prev.map((p) => {
      if (p.id !== activeProjectId) return p
      if (p.cities.some((c) => c.name === city)) return p
      return { ...p, cities: [...p.cities, { name: city, pops: [{ name: "POP Central" }] }] }
    }))
    setWorkingCity(city)
    setWorkingPop("POP Central")
    setCityFilter(city)
    setPopFilter(POP_ALL)
    setNewCityName("")
  }

  function addPop() {
    const pop = newPopName.trim()
    if (!pop) return
    setProjects((prev) => prev.map((p) => {
      if (p.id !== activeProjectId) return p
      return {
        ...p,
        cities: p.cities.map((c) => (c.name === resolvedWorkingCity ? ensurePop(c, pop) : c))
      }
    }))
    setWorkingPop(pop)
    setPopFilter(pop)
    setNewPopName("")
  }

  function placePopAt(lat: number, lng: number) {
    const existing = popOptionNames.join(", ") || "(nenhum)"
    const input = window.prompt(`Qual POP deseja posicionar no mapa?\nPOPs da cidade ${resolvedWorkingCity}: ${existing}`, resolvedWorkingPop)
    if (input == null) return
    const popName = input.trim()
    if (!popName) return

    setProjects((prev) => prev.map((p) => {
      if (p.id !== activeProjectId) return p
      return {
        ...p,
        cities: p.cities.map((c) => (c.name === resolvedWorkingCity ? ensurePop(c, popName, { lat, lng }) : c))
      }
    }))

    setWorkingPop(popName)
    setPopFilter(popName)
    setNewPopName("")
    fiber.setMode(null)
    fiber.setDrawingMode(null)
  }

  return (
    <>
      <PopupSalvar open={fiber.openSave} onSalvar={fiber.salvarNovaFibra} onCancelar={() => fiber.setOpenSave(false)} />

      <PopupSalvarCaixa key={`${fiber.openBoxSave}-${selectedKind}`} open={fiber.openBoxSave} kind={selectedKind} onSalvar={fiber.salvarNovaCaixa} onCancelar={fiber.cancelPlaceBox} />

      <button
        onClick={() => setSidebarOpen((v) => !v)}
        title={sidebarOpen ? "Esconder sidebar" : "Abrir sidebar"}
        style={{
          position: "absolute",
          top: 10,
          left: sidebarOpen ? 330 : 0,
          zIndex: 1600,
          width: 34,
          height: 42,
          borderRadius: "0 10px 10px 0",
          border: "1px solid #cbd5e1",
          borderLeft: "none",
          background: "#102a56",
          color: "#fff",
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(16,42,86,.25)"
        }}
      >
        {sidebarOpen ? "<" : ">"}
      </button>

      <aside style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 330, zIndex: 1500, background: "linear-gradient(170deg,#f5f9ff 0%,#ffffff 52%,#eef5ff 100%)", borderRight: "1px solid #d8e3f2", boxShadow: "0 12px 32px rgba(15,23,42,.15)", padding: 14, overflowY: "auto", transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform .2s ease" }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Projetos FTTH</div>

        <label style={{ display: "grid", gap: 4, marginBottom: 8, fontSize: 12 }}>
          Projeto ativo
          <select value={activeProjectId} onChange={(e) => { setActiveProjectId(e.target.value); setCityFilter(CITY_ALL); setPopFilter(POP_ALL) }} style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginBottom: 12 }}>
          <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Novo projeto" style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }} />
          <button onClick={addProject} style={{ border: "1px solid #b9cae5", borderRadius: 8, background: "#102a56", color: "#fff", padding: "7px 10px", cursor: "pointer", fontWeight: 700 }}>+ Projeto</button>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>Visualizacao</div>

          <label style={{ display: "grid", gap: 4, marginBottom: 8, fontSize: 12 }}>
            Cidade
            <select value={resolvedCityFilter} onChange={(e) => { setCityFilter(e.target.value); setPopFilter(POP_ALL) }} style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }}>
              <option value={CITY_ALL}>Todas as cidades</option>
              {cityOptions.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, marginBottom: 8, fontSize: 12 }}>
            POP
            <select value={resolvedPopFilter} onChange={(e) => setPopFilter(e.target.value)} style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }}>
              <option value={POP_ALL}>Todos os POPs</option>
              {allPopNames.map((pop) => <option key={pop} value={pop}>{pop}</option>)}
            </select>
          </label>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>Trabalho atual</div>

          <label style={{ display: "grid", gap: 4, marginBottom: 8, fontSize: 12 }}>
            Cidade de trabalho
            <select value={resolvedWorkingCity} onChange={(e) => { setWorkingCity(e.target.value); setWorkingPop("POP Central") }} style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }}>
              {cityOptions.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, marginBottom: 8, fontSize: 12 }}>
            POP de trabalho
            <select value={resolvedWorkingPop} onChange={(e) => setWorkingPop(e.target.value)} style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }}>
              {popOptions.map((pop) => <option key={pop.name} value={pop.name}>{pop.name}</option>)}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginBottom: 8 }}>
            <input value={newCityName} onChange={(e) => setNewCityName(e.target.value)} placeholder="Nova cidade" style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }} />
            <button onClick={addCity} style={{ border: "1px solid #c9d7ea", borderRadius: 8, background: "#fff", padding: "7px 10px", cursor: "pointer" }}>+ Cidade</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, marginBottom: 8 }}>
            <input value={newPopName} onChange={(e) => setNewPopName(e.target.value)} placeholder="Novo POP" style={{ border: "1px solid #d6e1ef", borderRadius: 8, padding: "7px 8px" }} />
            <button onClick={addPop} style={{ border: "1px solid #c9d7ea", borderRadius: 8, background: "#fff", padding: "7px 10px", cursor: "pointer" }}>+ POP</button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>Resumo da cidade ({resolvedWorkingCity})</div>
          <div style={{ display: "grid", gap: 4 }}>
            {popStats.length === 0 && <div style={{ fontSize: 12, color: "#64748b" }}>Sem elementos mapeados para esta cidade.</div>}
            {popStats.map(([pop, s]) => (
              <div key={pop} style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", background: pop === resolvedWorkingPop ? "#f8fbff" : "#fff" }}>
                <b>{pop}</b> | OLT: {s.olt} | DIO: {s.dio} | Total nos: {s.total}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {drawMode && <MapToolbar setDrawingMode={fiber.setDrawingMode} setMode={fiber.setMode} mode={fiber.mode} leftOffset={sidebarOpen ? 330 : 0} />}

      {caixaSelecionada && caixaSelecionada.tipo === "CEO" && (
        <CEOEditor
          ceo={caixaSelecionada}
          fibers={visibleFibers}
          onClose={() => fiber.setSelectedCEOId(null)}
          onAddOutPort={fiber.addOutPort}
          onConnectCable={fiber.connectCableToPort}
          onFuse={fiber.fuseFibers}
          onUnfuse={fiber.unfuseFibers}
          onAddSplitter={fiber.addSplitter}
          onRemoveSplitter={fiber.removeSplitter}
          onSetSplitterInputRef={fiber.setSplitterInputRef}
          onSetSplitterOutputRef={fiber.setSplitterOutputRef}
          onSetSplitterLegUnbalanced={fiber.setSplitterLegUnbalanced}
        />
      )}

      {caixaSelecionada && caixaSelecionada.tipo === "CTO" && (
        <CTOEditor
          ceo={caixaSelecionada}
          fibers={visibleFibers}
          onClose={() => fiber.setSelectedCEOId(null)}
          onAddOutPort={fiber.addOutPort}
          onConnectCable={fiber.connectCableToPort}
          onFuse={fiber.fuseFibers}
          onUnfuse={fiber.unfuseFibers}
          onAddCTOPrimarySplitter={fiber.addCTOPrimarySplitter}
          onSetSplitterInputRef={fiber.setSplitterInputRef}
          onSetSplitterOutputRef={fiber.setSplitterOutputRef}
          onSetSplitterLegUnbalanced={fiber.setSplitterLegUnbalanced}
          onAddCTOSecondarySplitter={fiber.addCTOSecondarySplitter}
          onRemoveSplitter={fiber.removeSplitter}
          onSetCableTubeSize={fiber.setCTOCableTubeSize}
          onSetSplitterConfig={fiber.setCTOSplitterConfig}
          onSetLegTermination={fiber.setCTOLegTermination}
          onSetExplicitlyUnfed={fiber.setCTOExplicitlyUnfed}
          onAddDrop={fiber.addCTODrop}
          onUpdateDrop={fiber.updateCTODrop}
          onRemoveDrop={fiber.removeCTODrop}
        />
      )}

      {caixaSelecionada && caixaSelecionada.tipo === "OLT" && (
        <OLTEditor
          node={caixaSelecionada}
          fibers={visibleFibers}
          onClose={() => fiber.setSelectedCEOId(null)}
          onAddSlot={fiber.addOLTSlot}
          onAddPon={fiber.addOLTPon}
          onSetPonConfig={fiber.setOLTPonConfig}
          onConnectCable={fiber.connectCableToPort}
          onActivateSignal={fiber.activateSignalFromPort}
          onClearSignal={fiber.clearActiveSignal}
          activeSignal={fiber.activeSignalSource}
        />
      )}

      {caixaSelecionada && caixaSelecionada.tipo === "DIO" && (
        <DIOEditor
          node={caixaSelecionada}
          fibers={visibleFibers}
          onClose={() => fiber.setSelectedCEOId(null)}
          onAddOutPort={fiber.addOutPort}
          onConnectCable={fiber.connectCableToPort}
          onFuse={fiber.fuseFibers}
          onUnfuse={fiber.unfuseFibers}
          onActivateSignal={fiber.activateSignalFromPort}
          onClearSignal={fiber.clearActiveSignal}
          activeSignal={fiber.activeSignalSource}
        />
      )}

      {caixaSelecionada && caixaSelecionada.tipo === "CLIENTE" && (
        <ClientNodeEditor
          node={caixaSelecionada}
          fibers={visibleFibers}
          onClose={() => fiber.setSelectedCEOId(null)}
          onConnectCable={fiber.connectCableToPort}
          onActivateSignal={fiber.activateSignalFromPort}
          onClearSignal={fiber.clearActiveSignal}
          activeSignal={fiber.activeSignalSource}
        />
      )}

      <GoogleMap
        center={center}
        zoom={16}
        mapContainerStyle={{ height: "100vh", marginLeft: sidebarOpen ? 330 : 0 }}
        onClick={(e) => {
          const lat = e.latLng?.lat()
          const lng = e.latLng?.lng()
          if (lat == null || lng == null) return

          if (fiber.mode === "place-pop") {
            placePopAt(lat, lng)
            return
          }

          if (
            fiber.mode !== "place-ceo" &&
            fiber.mode !== "place-cto" &&
            fiber.mode !== "place-olt" &&
            fiber.mode !== "place-dio" &&
            fiber.mode !== "place-cliente"
          ) return
        }}
      >
        {drawMode && (
          <DrawingManager
            drawingMode={fiber.drawingMode}
            onPolylineComplete={fiber.onDrawComplete}
            options={{ drawingControl: false }}
          />
        )}

        {visiblePops.map(({ city, pop }) => pop.position ? (
          <Marker
            key={`${city}::${pop.name}`}
            position={pop.position}
            onClick={() => {
              setWorkingCity(city)
              setWorkingPop(pop.name)
              setCityFilter(city)
              setPopFilter(pop.name)
            }}
            label={{ text: "POP", color: "#fff", fontWeight: "700" }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#102a56",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 10
            }}
            title={`${city} / ${pop.name}`}
          />
        ) : null)}

        <ClientLayer clients={visibleClients} />

        <CEOLayer ceos={visibleCeos} onSelectCEO={(c) => fiber.setSelectedCEOId(c.id)} />

        <FiberLayer
          fibers={visibleFibers}
          selectedFiber={fiber.selectedFiber}
          ceos={visibleCeos}
          setSelectedFiber={fiber.setSelectedFiber}
          polylineRefs={fiber.polylineRefs}
          onSaveEdit={fiber.salvarEdicao}
          mode={fiber.mode}
          activeSignalSource={fiber.activeSignalSource}
          onRequestPlaceBox={(click, sourceFiberId) => {
            if (
              fiber.mode !== "place-ceo" &&
              fiber.mode !== "place-cto" &&
              fiber.mode !== "place-olt" &&
              fiber.mode !== "place-dio" &&
              fiber.mode !== "place-cliente"
            ) return
            const kind = fiber.mode === "place-cto"
              ? "CTO"
              : fiber.mode === "place-olt"
                ? "OLT"
                : fiber.mode === "place-dio"
                  ? "DIO"
                  : fiber.mode === "place-cliente"
                    ? "CLIENTE"
                    : "CEO"
            fiber.startPlaceBoxAt(click, kind, sourceFiberId)
          }}
        />
      </GoogleMap>
    </>
  )
}

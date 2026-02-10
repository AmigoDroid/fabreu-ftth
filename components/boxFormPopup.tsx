import { useMemo, useState } from "react"
import { BoxFormData, BoxKind } from "@/types/ftth"
import "./forminput.css"

type Props = {
  open: boolean
  kind: BoxKind
  onSalvar: (data: BoxFormData) => void
  onCancelar: () => void
}

function initialForm(kind: BoxKind): BoxFormData {
  return {
    nome: kind,
    codigo: "",
    tipo: kind,
    fabricante: "",
    modelo: "",
    origemSinal: "",
    areaAtendimento: "",
    descricao: ""
  }
}

export function PopupSalvarCaixa({ open, kind, onSalvar, onCancelar }: Props) {
  const [form, setForm] = useState<BoxFormData>(() => initialForm(kind))

  const title = useMemo(() => {
    if (kind === "CTO") return "Nova caixa CTO"
    if (kind === "OLT") return "Novo chassi OLT"
    if (kind === "DIO") return "Novo DIO"
    if (kind === "CLIENTE") return "Novo ponto de cliente"
    return "Nova caixa CEO"
  }, [kind])

  if (!open) return null

  const update = <K extends keyof BoxFormData>(field: K, value: BoxFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    if (!form.nome.trim()) {
      alert("Informe o nome da caixa.")
      return
    }

    if (!form.codigo.trim()) {
      alert("Informe o codigo/ID da caixa para rastreabilidade.")
      return
    }

    if (!form.origemSinal.trim()) {
      alert("Informe a origem do sinal.")
      return
    }

    if (!form.areaAtendimento.trim()) {
      alert("Informe a area de atendimento da caixa.")
      return
    }

    onSalvar({
      ...form,
      nome: form.nome.trim(),
      codigo: form.codigo.trim(),
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      origemSinal: form.origemSinal.trim(),
      areaAtendimento: form.areaAtendimento.trim(),
      descricao: form.descricao.trim(),
      tipo: kind
    })

    setForm(initialForm(kind))
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h2>{title}</h2>

        <label>
          Nome da caixa*
          <input
            placeholder={kind === "CTO" ? "Ex.: CTO-12 Rua das Flores" : kind === "OLT" ? "Ex.: OLT POP Centro" : kind === "DIO" ? "Ex.: DIO Trunk Cidade A" : kind === "CLIENTE" ? "Ex.: Cliente Torre Sul 34" : "Ex.: CEO-07 Emenda A"}
            value={form.nome}
            onChange={(e) => update("nome", e.target.value)}
          />
        </label>

        <label>
          Codigo/ID*
          <input
            placeholder={kind === "CTO" ? "Ex.: CTO-ZN-0012" : kind === "OLT" ? "Ex.: OLT-POP-01" : kind === "DIO" ? "Ex.: DIO-CITY-10" : kind === "CLIENTE" ? "Ex.: CTE-000231" : "Ex.: CEO-BB-0007"}
            value={form.codigo}
            onChange={(e) => update("codigo", e.target.value)}
          />
        </label>

        <label>
          Fabricante
          <input
            placeholder="Ex.: Furukawa"
            value={form.fabricante}
            onChange={(e) => update("fabricante", e.target.value)}
          />
        </label>

        <label>
          Modelo
          <input
            placeholder={kind === "CTO" ? "Ex.: CTO 16 portas" : kind === "OLT" ? "Ex.: Chassi 16 slots" : kind === "DIO" ? "Ex.: Bastidor 144F" : kind === "CLIENTE" ? "Ex.: ONU Bridge" : "Ex.: Caixa de emenda 48F"}
            value={form.modelo}
            onChange={(e) => update("modelo", e.target.value)}
          />
        </label>

        <label>
          Origem do sinal*
          <input
            placeholder="Ex.: OLT Slot 1 PON 1"
            value={form.origemSinal}
            onChange={(e) => update("origemSinal", e.target.value)}
          />
        </label>

        <label>
          Area de atendimento*
          <input
            placeholder="Ex.: Quadra 21 / Cidade A"
            value={form.areaAtendimento}
            onChange={(e) => update("areaAtendimento", e.target.value)}
          />
        </label>

        <label>
          Observacoes
          <textarea
            placeholder="Informacoes operacionais importantes para campo e manutencao"
            value={form.descricao}
            onChange={(e) => update("descricao", e.target.value)}
          />
        </label>

        <div className="buttons">
          <button className="save" onClick={handleSave}>Salvar caixa</button>
          <button className="cancel" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

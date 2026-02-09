import { useState } from "react";
import "./forminput.css"

export type FiberFormData = {
  nome: string;
  tipoCabo: string;
  totalFibras: number;
  fabricante: string;
  modelo: string;
  origem: string;
  destino: string;
  descricao: string;
};

type PopupSalvarProps = {
  open: boolean;
  onSalvar: (data: FiberFormData) => void;
  onCancelar: () => void;
};

const initialForm: FiberFormData = {
  nome: "",
  tipoCabo: "DIO-EXTERNO",
  totalFibras: 12,
  fabricante: "",
  modelo: "",
  origem: "",
  destino: "",
  descricao: "",
};

export function PopupSalvar({
  open,
  onSalvar,
  onCancelar,
}: PopupSalvarProps) {
  const [form, setForm] = useState<FiberFormData>(initialForm);

  if (!open) return null;

  const update = <K extends keyof FiberFormData>(field: K, value: FiberFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  function handleSave() {
    if (!form.nome.trim()) {
      alert("Informe o nome do cabo.");
      return;
    }

    if (!form.origem.trim() || !form.destino.trim()) {
      alert("Informe origem e destino para documentar o enlace corretamente.");
      return;
    }

    if (!Number.isFinite(form.totalFibras) || form.totalFibras < 1) {
      alert("Quantidade de fibras inválida.");
      return;
    }

    onSalvar({
      ...form,
      nome: form.nome.trim(),
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      descricao: form.descricao.trim(),
    });

    setForm(initialForm);
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h2>Novo cabo FTTH</h2>

        <label>
          Nome do cabo*
          <input
            placeholder="Ex.: Backbone Norte"
            value={form.nome}
            onChange={(e) => update("nome", e.target.value)}
          />
        </label>

        <label>
          Tipo do cabo
          <select
            value={form.tipoCabo}
            onChange={(e) => update("tipoCabo", e.target.value)}
          >
            <option value="DIO-EXTERNO">DIO Externo</option>
            <option value="DIO-INTERNO">DIO Interno</option>
            <option value="DROP">Drop</option>
            <option value="BACKBONE">Backbone</option>
          </select>
        </label>

        <label>
          Quantidade de fibras*
          <input
            type="number"
            min={1}
            max={288}
            value={form.totalFibras}
            onChange={(e) => update("totalFibras", Number(e.target.value || 0))}
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
            placeholder="Ex.: CFOA-SM-AS80-S"
            value={form.modelo}
            onChange={(e) => update("modelo", e.target.value)}
          />
        </label>

        <label>
          Origem*
          <input
            placeholder="Ex.: CTO-01 / POP Central"
            value={form.origem}
            onChange={(e) => update("origem", e.target.value)}
          />
        </label>

        <label>
          Destino*
          <input
            placeholder="Ex.: CEO-07 / Rua A"
            value={form.destino}
            onChange={(e) => update("destino", e.target.value)}
          />
        </label>

        <label>
          Observações
          <textarea
            placeholder="Informações relevantes para operação e manutenção"
            value={form.descricao}
            onChange={(e) => update("descricao", e.target.value)}
          />
        </label>

        <div className="buttons">
          <button className="save" onClick={handleSave}>Salvar cabo</button>

          <button className="cancel" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

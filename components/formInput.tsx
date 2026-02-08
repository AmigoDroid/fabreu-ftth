import { useState } from "react";
import "./forminput.css"

type PopupSalvarProps = {
  open: boolean;
  onSalvar: (data: { campo1: string; campo2: string }) => void;
  onContinuar: () => void;
  onCancelar: () => void;

};

export function PopupSalvar({
  open,
  onSalvar,
  onContinuar: _onContinuar,
  onCancelar,
}: PopupSalvarProps) {
  const [form, setForm] = useState({
    campo1: "",
    campo2: "",
    
  });

  void _onContinuar;

  if (!open) return null;

  return (
    <div className="overlay">
      <div className="modal">
        <h2>Salvar</h2>

        <input
          placeholder="Nome"
          value={form.campo1}
          onChange={(e) => setForm({ ...form, campo1: e.target.value })}
        />

        <input
          placeholder="Descrição"
          value={form.campo2}
          onChange={(e) => setForm({ ...form, campo2: e.target.value })}
        />

        <div className="buttons">
          <button className="save" onClick={() => onSalvar(form)}>Salvar</button>

          <button className="cancel" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

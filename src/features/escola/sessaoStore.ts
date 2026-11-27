import { create } from "zustand";
import type { SessaoAlunos } from "../alunos/api";

export type EstadoSessao =
  | { tipo: "restaurando" | "falha" }
  | { tipo: "acesso"; aviso?: string }
  | { tipo: "autenticado"; sessao: SessaoAlunos };

type SessaoStore = {
  estado: EstadoSessao;
  definir: (estado: EstadoSessao) => void;
};

export const useSessaoStore = create<SessaoStore>((set) => ({
  estado: { tipo: "restaurando" },
  definir: (estado) => set({ estado }),
}));
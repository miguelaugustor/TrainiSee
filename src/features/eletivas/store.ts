import { create } from "zustand";

type EletivasState = {
  busca: string;
  area: string | null;
  setBusca: (busca: string) => void;
  setArea: (area: string | null) => void;
};

export const useEletivasStore = create<EletivasState>((set) => ({
  busca: "",
  area: null,
  setBusca: (busca) => set({ busca }),
  setArea: (area) => set({ area }),
}));
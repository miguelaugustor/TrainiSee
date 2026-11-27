import { ErroAlunos, solicitar, type SessaoAlunos } from "../alunos/api";
import { executarFuncaoEscolar } from "../escola/api";

export type DadosAula = { titulo: string; data: string; horario: string; eletivaId: string };
export type AlunoFrequencia = { id: string; nome?: string; matricula?: string; presente: boolean | null; observacao: string };

export function salvarAula(sessao: SessaoAlunos, dados: DadosAula, id?: string) {
  const titulo = dados.titulo.trim();
  const data = dados.data.trim();
  const horario = dados.horario.trim();
  if (!titulo || titulo.length > 120) throw new ErroAlunos("Informe um título com até 120 caracteres.");
  const dia = new Date(data + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) {
    throw new ErroAlunos("Informe uma data válida no formato AAAA-MM-DD.");
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new ErroAlunos("Informe um horário válido no formato HH:MM.");
  if (!dados.eletivaId) throw new ErroAlunos("Selecione uma eletiva.");
  return solicitar({
    url: id ? "/classes/Aula/" + encodeURIComponent(id) : "/classes/Aula",
    method: id ? "PUT" : "POST",
    data: { titulo, data, horario, eletiva: { __type: "Pointer", className: "Eletiva", objectId: dados.eletivaId } },
  }, sessao.token);
}

export function arquivarAula(sessao: SessaoAlunos, id: string) {
  return solicitar({
    url: "/classes/Aula/" + encodeURIComponent(id),
    method: "PUT",
    data: { arquivado: true },
  }, sessao.token);
}

export function listarFrequencia(sessao: SessaoAlunos, aulaId: string, busca: string, pagina: number, signal?: AbortSignal) {
  return executarFuncaoEscolar<{ titulo?: string; registros: AlunoFrequencia[]; proxima: number | null }>(
    sessao, "frequenciaDaAula", { aulaId, busca, pagina }, signal,
  );
}

export type AlteracaoFrequencia =
  | { operacao: "salvar"; alunoId: string; presente: boolean; observacao: string }
  | { operacao: "remover"; alunoId: string };

export function alterarFrequencia(sessao: SessaoAlunos, aulaId: string, dados: AlteracaoFrequencia) {
  return executarFuncaoEscolar<{ ok: true }>(sessao, "alterarFrequenciaEscolar", { aulaId, ...dados });
}

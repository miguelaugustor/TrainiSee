import { solicitar, type SessaoAlunos } from "../alunos/api";

export type PerfilEscolar = { perfil: "administrador" | "professor" | "aluno" | "pendente"; nome?: string };
export type TipoConsulta = "alunos" | "professores" | "eletivas" | "aulas" | "matriculas" | "frequencias";
export type RegistroEscolar = {
  id: string;
  titulo?: string;
  detalhes?: string;
  aula?: { data?: string; horario?: string; eletivaId?: string; eletivaTitulo?: string };
};

export const nomesDosPerfis: Record<PerfilEscolar["perfil"], string> = {
  administrador: "Administrador",
  professor: "Professor",
  aluno: "Aluno",
  pendente: "Aguardando vínculo",
};

type Funcao = "perfilEscolar" | "consultarDadosEscolares" | "vincularContaEscolar" |
  "frequenciaDaAula" | "alterarFrequenciaEscolar";

export async function executarFuncaoEscolar<T>(
  sessao: SessaoAlunos,
  funcao: Funcao,
  dados: object = {},
  signal?: AbortSignal,
) {
  const { result } = await solicitar<{ result: T }>({
    url: "/functions/" + funcao,
    method: "POST",
    data: dados,
    signal,
  }, sessao.token);
  return result;
}

export function consultarPerfil(sessao: SessaoAlunos, signal?: AbortSignal) {
  return executarFuncaoEscolar<PerfilEscolar>(sessao, "perfilEscolar", {}, signal);
}

export function consultarRegistros(sessao: SessaoAlunos, tipo: TipoConsulta, busca: string, pagina: number, signal?: AbortSignal) {
  return executarFuncaoEscolar<{ registros: RegistroEscolar[]; proxima: number | null }>(
    sessao, "consultarDadosEscolares", { tipo, busca, pagina }, signal,
  );
}

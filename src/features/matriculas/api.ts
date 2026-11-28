import { ErroAlunos, solicitar, type Aluno, type SessaoAlunos } from "../alunos/api";

const classe = "/classes/Matricula";
const tamanhoPagina = 25;

export type EletivaResumo = { objectId: string; titulo?: string; area?: string; arquivado?: boolean; arquivada?: boolean };
export type SituacaoMatricula = "ativa" | "inativa";
export type Matricula = { objectId: string; eletiva?: EletivaResumo; situacao?: SituacaoMatricula };

function ponteiro(className: "Aluno" | "Eletiva", objectId: string) {
  return { __type: "Pointer", className, objectId };
}

export async function buscarAlunoDaMatricula(sessao: SessaoAlunos, alunoId: string, signal?: AbortSignal) {
  const aluno = await solicitar<Aluno & { arquivado?: boolean }>({
    url: "/classes/Aluno/" + encodeURIComponent(alunoId),
    method: "GET",
    signal,
    params: { keys: "nome,matricula,arquivado" },
  }, sessao.token);
  if (aluno.arquivado) throw new ErroAlunos("Este aluno está arquivado.", 101);
  return aluno;
}

export async function listarMatriculas(sessao: SessaoAlunos, alunoId: string, pagina: number, signal?: AbortSignal) {
  const { results } = await solicitar<{ results: Matricula[] }>({
    url: classe,
    method: "GET",
    signal,
    params: {
      where: JSON.stringify({ aluno: ponteiro("Aluno", alunoId) }),
      include: "eletiva",
      keys: "situacao,eletiva",
      order: "-createdAt,objectId",
      limit: tamanhoPagina,
      skip: pagina,
    },
  }, sessao.token);
  return { registros: results, proxima: results.length === tamanhoPagina ? pagina + tamanhoPagina : undefined };
}

export async function listarEletivasParaMatricula(sessao: SessaoAlunos, pagina: number, signal?: AbortSignal) {
  const { results } = await solicitar<{ results: EletivaResumo[] }>({
    url: "/classes/Eletiva",
    method: "GET",
    signal,
    params: {
      where: JSON.stringify({ arquivado: { $ne: true }, arquivada: { $ne: true } }),
      keys: "titulo,area",
      order: "titulo,objectId",
      limit: tamanhoPagina,
      skip: pagina,
    },
  }, sessao.token);
  return { registros: results, proxima: results.length === tamanhoPagina ? pagina + tamanhoPagina : undefined };
}

export function salvarMatricula(
  sessao: SessaoAlunos,
  dados: { alunoId: string; eletivaId: string; situacao: SituacaoMatricula },
  id?: string,
) {
  if (!dados.alunoId || !dados.eletivaId) throw new ErroAlunos("Selecione o aluno e a eletiva.");
  return solicitar({
    url: id ? classe + "/" + encodeURIComponent(id) : classe,
    method: id ? "PUT" : "POST",
    data: {
      aluno: ponteiro("Aluno", dados.alunoId),
      eletiva: ponteiro("Eletiva", dados.eletivaId),
      situacao: dados.situacao,
    },
  }, sessao.token);
}

export function removerMatricula(sessao: SessaoAlunos, id: string) {
  return solicitar({ url: classe + "/" + encodeURIComponent(id), method: "DELETE" }, sessao.token);
}

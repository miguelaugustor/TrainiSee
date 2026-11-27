import { ErroAlunos, solicitar, type SessaoAlunos } from "../alunos/api";

const classe = "/classes/Professor";
const tamanhoPagina = 25;

export type DadosProfessor = { nome: string; email: string };
export type Professor = { objectId: string; nome?: string; email?: string };

export async function listarProfessores(sessao: SessaoAlunos, pagina: number, signal?: AbortSignal) {
  const { results } = await solicitar<{ results: Professor[] }>({
    url: classe,
    method: "GET",
    signal,
    params: {
      where: JSON.stringify({ arquivado: { $ne: true } }),
      keys: "nome,email",
      order: "nome,objectId",
      limit: tamanhoPagina,
      skip: pagina,
    },
  }, sessao.token);
  return { registros: results, proxima: results.length === tamanhoPagina ? pagina + tamanhoPagina : undefined };
}

export function salvarProfessor(sessao: SessaoAlunos, dados: DadosProfessor, id?: string) {
  const nome = dados.nome.trim();
  const email = dados.email.trim();
  if (!nome || nome.length > 120) throw new ErroAlunos("Informe um nome com até 120 caracteres.");
  if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new ErroAlunos("Informe um e-mail válido com até 160 caracteres.");
  }
  return solicitar({
    url: id ? classe + "/" + encodeURIComponent(id) : classe,
    method: id ? "PUT" : "POST",
    data: { nome, email },
  }, sessao.token);
}

export function arquivarProfessor(sessao: SessaoAlunos, id: string) {
  return solicitar({
    url: classe + "/" + encodeURIComponent(id),
    method: "PUT",
    data: { arquivado: true },
  }, sessao.token);
}

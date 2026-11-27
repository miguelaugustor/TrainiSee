import { ErroAlunos, solicitar, type SessaoAlunos } from "../alunos/api";

export type DadosEletiva = { titulo: string; descricao: string; area: string };
export type Eletiva = DadosEletiva & { objectId: string };

export const AREAS = ["Tecnologia", "Artes", "Idiomas", "Esportes", "Ciências"];
const tamanhoPagina = 25;

export async function listarEletivas(
  sessao: SessaoAlunos,
  pagina: number,
  signal?: AbortSignal,
  busca = "",
  area = "",
) {
  const termo = busca.trim().replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  const { results } = await solicitar<{ results: Eletiva[] }>({
    url: "/classes/Eletiva",
    method: "GET",
    signal,
    params: {
      where: JSON.stringify({
        arquivada: { $ne: true },
        ...(area ? { area } : {}),
        ...(termo ? { titulo: { $regex: termo, $options: "i" } } : {}),
      }),
      keys: "titulo,descricao,area",
      order: "titulo,objectId",
      limit: tamanhoPagina,
      skip: pagina,
    },
  }, sessao.token);
  return {
    eletivas: results,
    proxima: results.length === tamanhoPagina ? pagina + tamanhoPagina : undefined,
  };
}

export function salvarEletiva(sessao: SessaoAlunos, dados: DadosEletiva, id?: string) {
  const titulo = dados.titulo.trim();
  const descricao = dados.descricao.trim();
  if (!titulo || titulo.length > 120) throw new ErroAlunos("Informe um título com até 120 caracteres.");
  if (descricao.length > 500) throw new ErroAlunos("A descrição pode ter até 500 caracteres.");
  return solicitar({
    url: id ? "/classes/Eletiva/" + encodeURIComponent(id) : "/classes/Eletiva",
    method: id ? "PUT" : "POST",
    data: { titulo, descricao, area: dados.area },
  }, sessao.token);
}

export function arquivarEletiva(sessao: SessaoAlunos, id: string) {
  return solicitar({
    url: "/classes/Eletiva/" + encodeURIComponent(id),
    method: "PUT",
    data: { arquivada: true },
  }, sessao.token);
}
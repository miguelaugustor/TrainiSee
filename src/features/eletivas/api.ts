
import { ErroAlunos, solicitar, type SessaoAlunos } from "../alunos/api";

export type DadosEletiva = {
  titulo: string;
  descricao: string;
  area: string;
  videoUrl: string;
  cargaHoraria: string;
  conteudo: string;
};

export type Eletiva = {
  objectId: string;
  titulo: string;
  descricao: string;
  area: string;
  videoUrl?: string;
  cargaHoraria?: number | null;
  conteudo?: string;
};

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
      keys: "titulo,descricao,area,videoUrl,cargaHoraria,conteudo",
      order: "titulo,objectId",
      limit: tamanhoPagina,
      skip: pagina,
    },
  }, sessao.token);

  return {
    eletivas: results,
    proxima: results.length === tamanhoPagina
      ? pagina + tamanhoPagina
      : undefined,
  };
}

export function salvarEletiva(
  sessao: SessaoAlunos,
  dados: DadosEletiva,
  id?: string
) {
  const titulo = dados.titulo.trim();
  const descricao = dados.descricao.trim();
  const conteudo = dados.conteudo.trim();
  const videoUrl = dados.videoUrl.trim();

  const cargaHoraria = dados.cargaHoraria.trim()
    ? Number(dados.cargaHoraria)
    : null;

  if (!titulo || titulo.length > 120) {
    throw new ErroAlunos("Informe um título com até 120 caracteres.");
  }

  if (descricao.length > 500) {
    throw new ErroAlunos("A descrição pode ter até 500 caracteres.");
  }

  if (conteudo.length > 500) {
    throw new ErroAlunos("O conteúdo pode ter até 500 caracteres.");
  }

  if (videoUrl.length > 300) {
    throw new ErroAlunos("O link do vídeo pode ter até 300 caracteres.");
  }

  if (
    cargaHoraria !== null &&
    (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0)
  ) {
    throw new ErroAlunos("Informe uma carga horária válida.");
  }

  return solicitar({
    url: id
      ? "/classes/Eletiva/" + encodeURIComponent(id)
      : "/classes/Eletiva",
    method: id ? "PUT" : "POST",
    data: {
      titulo,
      descricao,
      area: dados.area,
      videoUrl,
      cargaHoraria,
      conteudo,
    },
  }, sessao.token);
}

export function arquivarEletiva(sessao: SessaoAlunos, id: string) {
  return solicitar({
    url: "/classes/Eletiva/" + encodeURIComponent(id),
    method: "PUT",
    data: { arquivada: true },
  }, sessao.token);
}

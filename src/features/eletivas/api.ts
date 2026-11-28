import { ErroAlunos, solicitar, type SessaoAlunos } from "../alunos/api";

export type DadosEletiva = {
  titulo: string;
  descricao: string;
  videoUrl: string;
  cargaHoraria: string;
  conteudo: string;
  area: string;
  professorId: string;
};
export type Eletiva = Omit<DadosEletiva, "videoUrl" | "cargaHoraria" | "conteudo" | "professorId"> & {
  objectId: string;
  videoUrl?: string;
  cargaHoraria?: number | null;
  conteudo?: string;
  professor?: { objectId: string; nome?: string };
};

export const AREAS = ["Tecnologia", "Artes", "Idiomas", "Esportes", "Ciências", "Humanidades", "Outra"];
const classe = "/classes/Eletiva";
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
    url: classe,
    method: "GET",
    signal,
    params: {
      where: JSON.stringify({
        arquivado: { $ne: true },
        arquivada: { $ne: true },
        ...(area ? { area } : {}),
        ...(termo ? { titulo: { $regex: termo, $options: "i" } } : {}),
      }),
      include: "professor",
      keys: "titulo,descricao,videoUrl,cargaHoraria,conteudo,area,professor.nome",
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
  const horas = dados.cargaHoraria.trim();
  const cargaHoraria = Number(horas.replace(",", "."));
  const conteudo = dados.conteudo.trim();
  const videoUrl = dados.videoUrl.trim();
  const professorId = dados.professorId.trim();
  if (!titulo || titulo.length > 120) throw new ErroAlunos("Informe um título com até 120 caracteres.");
  if (descricao.length > 500) throw new ErroAlunos("A descrição pode ter até 500 caracteres.");
  if (videoUrl.length > 300) throw new ErroAlunos("O link do vídeo pode ter até 300 caracteres.");
  if (!/^\d+(?:[.,]\d+)?$/.test(horas) || !Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
    throw new ErroAlunos("Informe uma carga horária maior que zero.");
  }
  if (!conteudo) throw new ErroAlunos("Informe o conteúdo da eletiva.");
  if (conteudo.length > 500) throw new ErroAlunos("O conteúdo pode ter até 500 caracteres.");
  if (!AREAS.includes(dados.area)) throw new ErroAlunos("Selecione a área da eletiva.");
  if (!professorId) throw new ErroAlunos("Selecione um professor.");
  return solicitar({
    url: id ? classe + "/" + encodeURIComponent(id) : classe,
    method: id ? "PUT" : "POST",
    data: {
      titulo, descricao, videoUrl, cargaHoraria, conteudo, area: dados.area,
      professor: { __type: "Pointer", className: "Professor", objectId: professorId },
    },
  }, sessao.token);
}

export function arquivarEletiva(sessao: SessaoAlunos, id: string) {
  return solicitar({
    url: classe + "/" + encodeURIComponent(id),
    method: "PUT",
    data: { arquivado: true },
  }, sessao.token);
}

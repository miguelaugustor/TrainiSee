import axios, { type AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const appId = process.env.EXPO_PUBLIC_BACK4APP_APP_ID?.trim();
const clientKey = process.env.EXPO_PUBLIC_BACK4APP_CLIENT_KEY?.trim();
const chaveSessao = "trainisee.alunos.session";
const usaArmazenamentoNativo = Platform.OS === "android" || Platform.OS === "ios";
const tamanhoPagina = 25;

const api = axios.create({
  baseURL: "https://parseapi.back4app.com",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Parse-Application-Id": appId,
    "X-Parse-Client-Key": clientKey,
  },
});

export type DadosAluno = { nome: string; matricula: string };
export type Aluno = DadosAluno & { objectId: string };
export type SessaoAlunos = { usuarioId: string; email: string; token: string };
type UsuarioParse = { objectId: string; email?: string; username?: string };
type Opcoes = Omit<AxiosRequestConfig, "headers"> & { headers?: Record<string, string> };

export class ErroAlunos extends Error {
  constructor(message: string, readonly codigo?: number) {
    super(message);
    this.name = "ErroAlunos";
  }
}

const mensagens: Record<number, string> = {
  101: "Registro indisponível.",
  119: "A direção precisa autorizar esta conta na equipe escolar.",
  137: "Já existe um registro com esses dados.",
  202: "Já existe uma conta com esse e-mail.",
  203: "Já existe uma conta com esse e-mail.",
  205: "Confirme seu e-mail antes de entrar.",
  209: "Sua sessão terminou. Entre novamente.",
};

export const sessaoExpirada = (erro: unknown) => erro instanceof ErroAlunos && erro.codigo === 209;
export const acessoNegado = (erro: unknown) => erro instanceof ErroAlunos && erro.codigo === 119;

async function solicitar<T>(opcoes: Opcoes, token?: string) {
  if (!appId || !clientKey) {
    throw new ErroAlunos("Configure o ID do aplicativo e a chave de cliente do Back4App.");
  }
  try {
    const { data } = await api.request<T>({
      ...opcoes,
      headers: {
        ...opcoes.headers,
        ...(token ? { "X-Parse-Session-Token": token } : {}),
      },
    });
    return data;
  } catch (erro) {
    if (axios.isCancel(erro)) throw erro;
    if (!axios.isAxiosError<{ code?: number; error?: string }>(erro)) {
      throw new ErroAlunos("Não foi possível concluir a operação.");
    }
    const resposta = erro.response;
    const codigo = resposta?.data?.code ?? (token && resposta?.status === 403 ? 119 : undefined);
    const mensagem = codigo === 142 && typeof resposta?.data?.error === "string"
      ? resposta.data.error
      : mensagens[codigo ?? 0] ?? (resposta
        ? "O Back4App não conseguiu concluir a operação."
        : "Verifique a conexão e tente novamente.");
    throw new ErroAlunos(mensagem, codigo);
  }
}

export async function esquecerSessao() {
  if (usaArmazenamentoNativo) {
    await SecureStore.deleteItemAsync(chaveSessao).catch(() => {});
  }
}

export async function restaurarSessao(signal?: AbortSignal) {
  const token = usaArmazenamentoNativo ? await SecureStore.getItemAsync(chaveSessao) : null;
  if (!token || signal?.aborted) return null;
  try {
    const usuario = await solicitar<UsuarioParse>({ url: "/users/me", method: "GET", signal }, token);
    return { usuarioId: usuario.objectId, email: usuario.email ?? usuario.username ?? "", token };
  } catch (erro) {
    if (!sessaoExpirada(erro)) throw erro;
    await esquecerSessao();
    return null;
  }
}

export async function autenticar(email: string, senha: string, cadastro: boolean) {
  const dados = { username: email, password: senha, ...(cadastro ? { email } : {}) };
  const usuario = await solicitar<UsuarioParse & { sessionToken?: string }>({
    url: cadastro ? "/users" : "/login",
    method: "POST",
    headers: { "X-Parse-Revocable-Session": "1" },
    data: dados,
  });
  if (!usuario.objectId || !usuario.sessionToken) {
    throw new ErroAlunos("Confirme seu e-mail e entre com a conta criada.");
  }
  if (usaArmazenamentoNativo) {
    try {
      await SecureStore.setItemAsync(chaveSessao, usuario.sessionToken);
    } catch {
      await solicitar({ url: "/logout", method: "POST" }, usuario.sessionToken).catch(() => {});
      throw new ErroAlunos("Não foi possível salvar a sessão neste dispositivo.");
    }
  }
  return { usuarioId: usuario.objectId, email, token: usuario.sessionToken };
}

export async function sair(sessao: SessaoAlunos) {
  try {
    await solicitar({ url: "/logout", method: "POST" }, sessao.token);
  } catch (erro) {
    if (!sessaoExpirada(erro)) throw erro;
  }
  await esquecerSessao();
}

export async function listarAlunos(sessao: SessaoAlunos, pagina: number, signal?: AbortSignal) {
  const { results } = await solicitar<{ results: Aluno[] }>({
    url: "/classes/Aluno",
    method: "GET",
    signal,
    params: {
      where: JSON.stringify({ arquivado: { $ne: true } }),
      keys: "nome,matricula",
      order: "nome,objectId",
      limit: tamanhoPagina,
      skip: pagina,
    },
  }, sessao.token);
  return { alunos: results, proxima: results.length === tamanhoPagina ? pagina + tamanhoPagina : undefined };
}

export function salvarAluno(sessao: SessaoAlunos, dados: DadosAluno, id?: string) {
  const nome = dados.nome.trim();
  const matricula = dados.matricula.trim().toUpperCase();
  if (!nome || nome.length > 120) throw new ErroAlunos("Informe um nome com até 120 caracteres.");
  if (!matricula || matricula.length > 40) throw new ErroAlunos("Informe uma matrícula com até 40 caracteres.");
  return solicitar({
    url: id ? "/classes/Aluno/" + encodeURIComponent(id) : "/classes/Aluno",
    method: id ? "PUT" : "POST",
    data: { nome, matricula },
  }, sessao.token);
}

export function arquivarAluno(sessao: SessaoAlunos, id: string) {
  return solicitar({
    url: "/classes/Aluno/" + encodeURIComponent(id),
    method: "PUT",
    data: { arquivado: true },
  }, sessao.token);
}

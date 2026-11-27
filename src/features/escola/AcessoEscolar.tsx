import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Button, HelperText, Text } from "react-native-paper";
import { Page } from "../../components/Page";
import { AcessoAlunos } from "../alunos/AcessoAlunos";
import { ErroAlunos, esquecerSessao, restaurarSessao, sair, sessaoExpirada, type SessaoAlunos } from "../alunos/api";
import { consultarPerfil, type PerfilEscolar } from "./api";

type Estado =
  | { tipo: "restaurando" | "falha" }
  | { tipo: "acesso"; aviso?: string }
  | { tipo: "autenticado"; sessao: SessaoAlunos };

const Contexto = createContext<{
  estado: Estado;
  entrar: (sessao: SessaoAlunos) => void;
  encerrar: () => void;
  expirar: () => Promise<void>;
  tentarNovamente: () => void;
} | null>(null);

export function SessaoEscolarProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "restaurando" });
  const [tentativa, setTentativa] = useState(0);
  const [cache] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 15000 } },
  }));

  useEffect(() => {
    const controlador = new AbortController();
    const { signal } = controlador;
    void restaurarSessao(signal).then(
      (sessao) => {
        if (!signal.aborted) setEstado(sessao ? { tipo: "autenticado", sessao } : { tipo: "acesso" });
      },
      () => {
        if (!signal.aborted) setEstado({ tipo: "falha" });
      },
    );
    return () => controlador.abort();
  }, [tentativa]);

  const encerrar = useCallback(() => {
    cache.clear();
    setEstado({ tipo: "acesso" });
  }, [cache]);
  const expirar = useCallback(async () => {
    await esquecerSessao();
    cache.clear();
    setEstado({ tipo: "acesso", aviso: "Sua sessão terminou. Entre novamente." });
  }, [cache]);

  return (
    <QueryClientProvider client={cache}>
      <Contexto.Provider value={{
        estado,
        entrar(sessao) {
          cache.clear();
          setEstado({ tipo: "autenticado", sessao });
        },
        encerrar,
        expirar,
        tentarNovamente() {
          setEstado({ tipo: "restaurando" });
          setTentativa((numero) => numero + 1);
        },
      }}>
        {children}
      </Contexto.Provider>
    </QueryClientProvider>
  );
}

export type SessaoComPerfil = {
  sessao: SessaoAlunos;
  perfil: PerfilEscolar;
  encerrar: () => void;
  expirar: () => Promise<void>;
  botaoSair: ReactNode;
};

export function AcessoEscolar({ titulo, children }: { titulo: string; children: (acesso: SessaoComPerfil) => ReactNode }) {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("SessaoEscolarProvider ausente.");
  const { estado, entrar, encerrar, expirar, tentarNovamente } = contexto;
  const sessao = estado.tipo === "autenticado" ? estado.sessao : undefined;
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState("");
  const bloqueio = useRef(false);
  const consulta = useQuery({
    queryKey: ["perfil-escolar", sessao?.usuarioId],
    queryFn: sessao ? ({ signal }) => consultarPerfil(sessao, signal) : skipToken,
  });
  const expirou = sessaoExpirada(consulta.error);
  useEffect(() => {
    if (expirou) void expirar();
  }, [expirou, expirar]);

  async function sairDaConta() {
    if (!sessao || bloqueio.current) return;
    bloqueio.current = true;
    setSaindo(true);
    setErroSaida("");
    try {
      await sair(sessao);
      encerrar();
    } catch (erro) {
      setErroSaida(erro instanceof Error ? erro.message : "Não foi possível sair.");
    } finally {
      bloqueio.current = false;
      setSaindo(false);
    }
  }

  if (estado.tipo === "restaurando") return <Page><ActivityIndicator accessibilityLabel="Restaurando sessão" /></Page>;
  if (estado.tipo === "falha") {
    return (
      <Page>
        <Text accessibilityLiveRegion="polite">Não foi possível restaurar a sessão.</Text>
        <Button mode="outlined" onPress={tentarNovamente}>Tentar novamente</Button>
      </Page>
    );
  }
  if (estado.tipo === "acesso") return <AcessoAlunos titulo={titulo} aviso={estado.aviso} aoEntrar={entrar} />;
  if (!sessao || consulta.isPending || expirou) {
    return <Page><ActivityIndicator accessibilityLabel="Verificando perfil" /></Page>;
  }
  const botaoSair = (
    <>
      <Button mode="outlined" onPress={() => void sairDaConta()} disabled={saindo} loading={saindo}>Sair</Button>
      {erroSaida ? <HelperText type="error" accessibilityLiveRegion="polite">{erroSaida}</HelperText> : null}
    </>
  );
  if (consulta.isError) {
    const semFuncao = consulta.error instanceof ErroAlunos && consulta.error.codigo === 141;
    return (
      <Page>
        <Text accessibilityLiveRegion="polite">
          {semFuncao ? "O Back4App precisa do Cloud Code atualizado para carregar os perfis." : consulta.error.message}
        </Text>
        <Button mode="contained" disabled={consulta.isFetching || saindo} onPress={() => void consulta.refetch()}>
          Verificar acesso
        </Button>
        {botaoSair}
      </Page>
    );
  }
  if (consulta.data.perfil === "pendente") {
    return (
      <Page>
        <Text variant="titleLarge" accessibilityRole="header">Aguardando vínculo</Text>
        <Text>Confirme seu e-mail e peça à escola para vincular a conta ao cadastro de aluno ou professor.</Text>
        <Button mode="contained" disabled={consulta.isFetching || saindo} onPress={() => void consulta.refetch()}>
          Verificar acesso
        </Button>
        {botaoSair}
      </Page>
    );
  }
  return children({ sessao, perfil: consulta.data, encerrar, expirar, botaoSair });
}

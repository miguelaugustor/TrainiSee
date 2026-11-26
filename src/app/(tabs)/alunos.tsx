import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { Page } from "../../components/Page";
import { AcessoAlunos } from "../../features/alunos/AcessoAlunos";
import { ListaAlunos } from "../../features/alunos/ListaAlunos";
import { esquecerSessao, restaurarSessao, type SessaoAlunos } from "../../features/alunos/api";

type Tela =
  | { tipo: "restaurando" }
  | { tipo: "falha" }
  | { tipo: "acesso"; aviso?: string }
  | { tipo: "lista"; sessao: SessaoAlunos };

export default function Alunos() {
  const [tela, setTela] = useState<Tela>({ tipo: "restaurando" });
  const [cache] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 15000 } },
  }));

  const restaurar = useCallback(async (signal?: AbortSignal) => {
    try {
      const sessao = await restaurarSessao(signal);
      if (!signal?.aborted) setTela(sessao ? { tipo: "lista", sessao } : { tipo: "acesso" });
    } catch {
      if (!signal?.aborted) setTela({ tipo: "falha" });
    }
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    void restaurar(controlador.signal);
    return () => controlador.abort();
  }, [restaurar]);

  const encerrar = useCallback(() => {
    cache.clear();
    setTela({ tipo: "acesso" });
  }, [cache]);

  const expirar = useCallback(async () => {
    await esquecerSessao();
    cache.clear();
    setTela({ tipo: "acesso", aviso: "Sua sessão terminou. Entre novamente." });
  }, [cache]);

  if (tela.tipo === "restaurando") {
    return <Page><ActivityIndicator accessibilityLabel="Restaurando sessão" /></Page>;
  }
  if (tela.tipo === "falha") {
    return (
      <Page>
        <Text accessibilityLiveRegion="polite">Não foi possível restaurar a sessão.</Text>
        <Button mode="outlined" onPress={() => {
          setTela({ tipo: "restaurando" });
          void restaurar();
        }}>
          Tentar novamente
        </Button>
      </Page>
    );
  }
  if (tela.tipo === "acesso") {
    return <AcessoAlunos aviso={tela.aviso} aoEntrar={(sessao) => setTela({ tipo: "lista", sessao })} />;
  }
  return (
    <QueryClientProvider client={cache}>
      <ListaAlunos sessao={tela.sessao} aoSair={encerrar} aoExpirar={expirar} />
    </QueryClientProvider>
  );
}

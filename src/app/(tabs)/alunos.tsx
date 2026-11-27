import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { Page } from "../../components/Page";
import { AcessoAlunos } from "../../features/alunos/AcessoAlunos";
import { ListaAlunos } from "../../features/alunos/ListaAlunos";
import { esquecerSessao, restaurarSessao, type SessaoAlunos } from "../../features/alunos/api";
import { ListaProfessores } from "../../features/professores/ListaProfessores";

type Tela =
  | { tipo: "restaurando" }
  | { tipo: "falha" }
  | { tipo: "acesso"; aviso?: string }
  | { tipo: "lista"; sessao: SessaoAlunos };

export default function Alunos() {
  const router = useRouter();
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const professores = secao === "professores";
  const [tela, setTela] = useState<Tela>({ tipo: "restaurando" });
  const [tentativa, setTentativa] = useState(0);
  const [cache] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 15000 } },
  }));

  useEffect(() => {
    const controlador = new AbortController();
    const { signal } = controlador;
    void restaurarSessao(signal).then(
      (sessao) => {
        if (!signal.aborted) setTela(sessao ? { tipo: "lista", sessao } : { tipo: "acesso" });
      },
      () => {
        if (!signal.aborted) setTela({ tipo: "falha" });
      },
    );
    return () => controlador.abort();
  }, [tentativa]);

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
          setTentativa((numero) => numero + 1);
        }}>
          Tentar novamente
        </Button>
      </Page>
    );
  }
  if (tela.tipo === "acesso") {
    return (
      <AcessoAlunos
        aviso={tela.aviso}
        titulo={professores ? "Acessar Professores" : undefined}
        aoEntrar={(sessao) => setTela({ tipo: "lista", sessao })}
      />
    );
  }
  return (
    <QueryClientProvider client={cache}>
      <Tabs.Screen options={{ headerTitle: professores ? "Professores" : "Alunos" }} />
      {professores ? (
        <ListaProfessores
          sessao={tela.sessao}
          aoExpirar={expirar}
          aoVoltar={() => router.setParams({ secao: "alunos" })}
        />
      ) : (
        <ListaAlunos sessao={tela.sessao} aoSair={encerrar} aoExpirar={expirar} />
      )}
    </QueryClientProvider>
  );
}

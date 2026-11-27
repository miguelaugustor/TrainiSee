import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Chip, HelperText, Searchbar, Text } from "react-native-paper";
import { Page } from "../../components/Page";
import { acessoNegado, sessaoExpirada } from "../alunos/api";
import { type SessaoComPerfil } from "./AcessoEscolar";
import { consultarRegistros, nomesDosPerfis, type TipoConsulta } from "./api";

const categorias: { tipo: TipoConsulta; titulo: string }[] = [
  { tipo: "eletivas", titulo: "Eletivas" },
  { tipo: "aulas", titulo: "Aulas" },
  { tipo: "matriculas", titulo: "Matrículas" },
  { tipo: "frequencias", titulo: "Frequência" },
  { tipo: "alunos", titulo: "Alunos" },
  { tipo: "professores", titulo: "Professores" },
];

type Props = SessaoComPerfil & { somente?: TipoConsulta; antes?: ReactNode };

export function ConsultaEscolar({ sessao, perfil, expirar, botaoSair, somente, antes }: Props) {
  const [tipoEscolhido, setTipoEscolhido] = useState<TipoConsulta>("eletivas");
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const tipo = somente ?? tipoEscolhido;
  const opcoes = categorias.filter(({ tipo: categoria }) =>
    perfil.perfil === "administrador" || (categoria !== "alunos" && categoria !== "professores"));

  useEffect(() => {
    const espera = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto]);
  const lista = useInfiniteQuery({
    queryKey: ["consulta-escolar", sessao.usuarioId, perfil.perfil, tipo, busca],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => consultarRegistros(sessao, tipo, busca, pageParam, signal),
    getNextPageParam: (pagina) => pagina.proxima ?? undefined,
  });
  const expirou = sessaoExpirada(lista.error);
  useEffect(() => {
    if (expirou) void expirar();
  }, [expirou, expirar]);
  if (expirou) return <Page><ActivityIndicator accessibilityLabel="Encerrando sessão" /></Page>;

  const registros = acessoNegado(lista.error) ? [] : [...new Map(lista.data?.pages.flatMap(({ registros }) =>
    registros.map((item) => [item.id, item] as const))).values()];
  const rotulo = perfil.perfil === "professor" && tipo === "matriculas" ? "Turmas" :
    categorias.find((categoria) => categoria.tipo === tipo)?.titulo;

  return (
    <Page>
      <View style={styles.grupo}>
        <Text variant="titleLarge" accessibilityRole="header">{perfil.nome || nomesDosPerfis[perfil.perfil]}</Text>
        {perfil.nome ? <Text>{nomesDosPerfis[perfil.perfil]}</Text> : null}
        {botaoSair}
        {antes}
        {!somente ? (
          <View style={styles.opcoes}>
            {opcoes.map((opcao) => (
              <Chip key={opcao.tipo} selected={opcao.tipo === tipo} onPress={() => setTipoEscolhido(opcao.tipo)}>
                {perfil.perfil === "professor" && opcao.tipo === "matriculas" ? "Turmas" : opcao.titulo}
              </Chip>
            ))}
          </View>
        ) : null}
        <Searchbar
          value={texto}
          onChangeText={setTexto}
          placeholder={rotulo ? "Buscar em " + rotulo.toLowerCase() : "Buscar dados escolares"}
          accessibilityLabel="Buscar dados escolares"
          clearAccessibilityLabel="Limpar busca"
          autoCorrect={false}
          maxLength={100}
        />
        {lista.isPending ? <ActivityIndicator accessibilityLabel="Carregando registros" /> : null}
        {lista.isSuccess && !registros.length ? <Text>Nenhum registro encontrado.</Text> : null}
        {registros.map((item) => (
          <Card key={item.id} mode="outlined">
            <Card.Content>
              <Text variant="titleMedium">{item.titulo || "Registro sem título"}</Text>
              {item.detalhes ? <Text>{item.detalhes}</Text> : null}
            </Card.Content>
          </Card>
        ))}
        {lista.isError ? (
          <>
            <HelperText type="error" accessibilityLiveRegion="polite">{lista.error.message}</HelperText>
            <Button mode="outlined" disabled={lista.isFetching} onPress={() => void lista.refetch()}>Tentar novamente</Button>
          </>
        ) : lista.hasNextPage ? (
          <Button disabled={lista.isFetching} loading={lista.isFetchingNextPage} onPress={() => void lista.fetchNextPage()}>
            Carregar mais
          </Button>
        ) : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 12 },
  opcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator, Button, Card, Chip, Dialog, HelperText, Portal, Searchbar, Snackbar, Text, TextInput, useTheme,
} from "react-native-paper";
import { Page } from "../../components/Page";
import { sessaoExpirada, type SessaoAlunos } from "../alunos/api";
import {
  AREAS, arquivarEletiva, listarEletivas, salvarEletiva, type DadosEletiva, type Eletiva,
} from "./api";
import { useEletivasStore } from "./store";

type Props = {
  sessao: SessaoAlunos;
  podeEditar: boolean;
  aoExpirar: () => Promise<void>;
  botaoSair?: ReactNode;
};
type Edicao = DadosEletiva & { id?: string };
type Acao = { tipo: "salvar"; edicao: Edicao } | { tipo: "arquivar"; eletiva: Eletiva };

export function ListaEletivas({ sessao, podeEditar, aoExpirar, botaoSair }: Props) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const { busca: textoBusca, area, setBusca: setTextoBusca, setArea } = useEletivasStore();
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [exclusao, setExclusao] = useState<Eletiva | null>(null);
  const [aviso, setAviso] = useState("");
  const bloqueio = useRef(false);
  const chave = ["eletivas", sessao.usuarioId] as const;

  useEffect(() => {
    const espera = setTimeout(() => setBusca(textoBusca.trim()), 300);
    return () => clearTimeout(espera);
  }, [textoBusca]);

  const lista = useInfiniteQuery({
    queryKey: [...chave, busca, area],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listarEletivas(sessao, pageParam, signal, busca, area ?? ""),
    getNextPageParam: (pagina) => pagina.proxima,
  });
  const alteracao = useMutation({
    mutationFn: (acao: Acao) => acao.tipo === "salvar"
      ? salvarEletiva(sessao, acao.edicao, acao.edicao.id)
      : arquivarEletiva(sessao, acao.eletiva.objectId),
    async onSuccess(_resposta, acao) {
      await cache.invalidateQueries({ queryKey: chave });
      setEdicao(null);
      setExclusao(null);
      setAviso(acao.tipo === "arquivar" ? "Eletiva excluída."
        : acao.edicao.id ? "Eletiva atualizada." : "Eletiva cadastrada.");
    },
    onSettled() {
      bloqueio.current = false;
    },
  });

  const expirou = sessaoExpirada(lista.error) || sessaoExpirada(alteracao.error);
  useEffect(() => {
    if (expirou) void aoExpirar();
  }, [aoExpirar, expirou]);

  function executar(acao: Acao) {
    if (bloqueio.current) return;
    bloqueio.current = true;
    alteracao.mutate(acao);
  }

  function comecarEdicao(eletiva?: Eletiva) {
    alteracao.reset();
    setEdicao(eletiva
      ? { id: eletiva.objectId, titulo: eletiva.titulo ?? "", descricao: eletiva.descricao ?? "", area: eletiva.area ?? AREAS[0] }
      : { titulo: "", descricao: "", area: AREAS[0] });
  }

  if (expirou) return <Page><ActivityIndicator accessibilityLabel="Encerrando sessão" /></Page>;

  if (edicao) {
    return (
      <Page>
        <View style={styles.bloco}>
          <Text accessibilityRole="header" variant="titleLarge">
            {edicao.id ? "Editar eletiva" : "Cadastrar eletiva"}
          </Text>
          <TextInput
            label="Título"
            mode="outlined"
            value={edicao.titulo}
            maxLength={120}
            disabled={alteracao.isPending}
            onChangeText={(titulo) => setEdicao({ ...edicao, titulo })}
          />
          <TextInput
            label="Descrição"
            mode="outlined"
            multiline
            numberOfLines={3}
            value={edicao.descricao}
            maxLength={500}
            disabled={alteracao.isPending}
            onChangeText={(descricao) => setEdicao({ ...edicao, descricao })}
          />
          <Text variant="labelLarge">Área</Text>
          <View style={styles.chips}>
            {AREAS.map((a) => (
              <Chip
                key={a}
                selected={edicao.area === a}
                disabled={alteracao.isPending}
                onPress={() => setEdicao({ ...edicao, area: a })}
              >
                {a}
              </Chip>
            ))}
          </View>
          {alteracao.error ? (
            <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText>
          ) : null}
          <Button
            mode="contained"
            disabled={alteracao.isPending}
            loading={alteracao.isPending}
            onPress={() => executar({ tipo: "salvar", edicao })}
          >
            Salvar
          </Button>
          <Button disabled={alteracao.isPending} onPress={() => setEdicao(null)}>Cancelar</Button>
        </View>
      </Page>
    );
  }

  const eletivas = [...new Map(lista.data?.pages.flatMap((pagina) =>
    pagina.eletivas.map((e) => [e.objectId, e] as const))).values()];

  return (
    <View style={[styles.tela, { backgroundColor: colors.background }]}>
      <FlatList
        data={eletivas}
        keyExtractor={(e) => e.objectId}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        refreshing={lista.isRefetching && !lista.isFetchingNextPage}
        onRefresh={() => void lista.refetch()}
        ListHeaderComponent={
          <View style={styles.bloco}>
            {botaoSair}
            {podeEditar ? (
              <Button mode="contained" icon="plus" disabled={!lista.data} onPress={() => comecarEdicao()}>
                Adicionar eletiva
              </Button>
            ) : null}
            <Searchbar
              placeholder="Buscar por título"
              accessibilityLabel="Buscar eletiva por título"
              value={textoBusca}
              onChangeText={setTextoBusca}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={120}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                <Chip selected={area === null} onPress={() => setArea(null)}>Todas</Chip>
                {AREAS.map((a) => (
                  <Chip key={a} selected={area === a} onPress={() => setArea(a)}>{a}</Chip>
                ))}
              </View>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={lista.isPending
          ? <ActivityIndicator accessibilityLabel="Carregando eletivas" />
          : lista.isError ? undefined : (
            <Text accessibilityLiveRegion="polite">
              {busca || area ? "Nenhuma eletiva corresponde ao filtro." : "Nenhuma eletiva cadastrada."}
            </Text>
          )}
        renderItem={({ item }) => (
          <Card mode="outlined">
            <Card.Title title={item.titulo || "Eletiva sem título"} subtitle={item.area} />
            {item.descricao ? (
              <Card.Content>
                <Text variant="bodyMedium">{item.descricao}</Text>
              </Card.Content>
            ) : null}
            {podeEditar ? (
              <Card.Actions>
                <Button
                  textColor={colors.error}
                  onPress={() => {
                    alteracao.reset();
                    setExclusao(item);
                  }}
                >
                  Excluir
                </Button>
                <Button onPress={() => comecarEdicao(item)}>Editar</Button>
              </Card.Actions>
            ) : null}
          </Card>
        )}
        ListFooterComponent={lista.isError ? (
          <View style={styles.bloco}>
            <Text accessibilityLiveRegion="polite">{lista.error.message}</Text>
            <Button mode="outlined" onPress={() => void lista.refetch()}>Tentar novamente</Button>
          </View>
        ) : lista.hasNextPage ? (
          <Button
            loading={lista.isFetchingNextPage}
            disabled={lista.isFetching}
            onPress={() => void lista.fetchNextPage()}
          >
            Carregar mais
          </Button>
        ) : undefined}
      />
      <Portal>
        <Dialog
          visible={Boolean(exclusao)}
          dismissable={!alteracao.isPending}
          onDismiss={() => setExclusao(null)}
        >
          <Dialog.Title>Excluir eletiva?</Dialog.Title>
          <Dialog.Content>
            <Text>{exclusao?.titulo || "A eletiva"} sairá da lista. As matrículas e aulas ligadas a ela são preservadas.</Text>
            {alteracao.error ? <HelperText type="error">{alteracao.error.message}</HelperText> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={alteracao.isPending} onPress={() => setExclusao(null)}>Cancelar</Button>
            <Button
              textColor={colors.error}
              disabled={!exclusao || alteracao.isPending}
              loading={alteracao.isPending}
              onPress={() => exclusao && executar({ tipo: "arquivar", eletiva: exclusao })}
            >
              Excluir
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso("")}>{aviso}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  conteudo: { alignSelf: "center", width: "100%", maxWidth: 720, padding: 20, gap: 12 },
  bloco: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
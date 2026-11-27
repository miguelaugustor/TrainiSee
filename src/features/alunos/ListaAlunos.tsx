import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator, Button, Card, Dialog, HelperText, Portal, Searchbar, Snackbar, Text, TextInput, useTheme,
} from "react-native-paper";
import { Page } from "../../components/Page";
import {
  acessoNegado, arquivarAluno, listarAlunos, sair, salvarAluno, sessaoExpirada,
  type Aluno, type DadosAluno, type SessaoAlunos,
} from "./api";

type Props = { sessao: SessaoAlunos; aoSair: () => void; aoExpirar: () => Promise<void> };
type Edicao = DadosAluno & { id?: string };
type Acao = { tipo: "salvar"; edicao: Edicao } | { tipo: "arquivar"; aluno: Aluno };

export function ListaAlunos({ sessao, aoSair, aoExpirar }: Props) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [textoBusca, setTextoBusca] = useState("");
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [exclusao, setExclusao] = useState<Aluno | null>(null);
  const [aviso, setAviso] = useState("");
  const [erroSaida, setErroSaida] = useState("");
  const [saindo, setSaindo] = useState(false);
  const bloqueioSaida = useRef(false);
  const bloqueioAlteracao = useRef(false);
  const chave = ["alunos", sessao.usuarioId] as const;

  useEffect(() => {
    const espera = setTimeout(() => setBusca(textoBusca.trim()), 300);
    return () => clearTimeout(espera);
  }, [textoBusca]);

  const lista = useInfiniteQuery({
    queryKey: [...chave, busca],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listarAlunos(sessao, pageParam, signal, busca),
    getNextPageParam: (pagina) => pagina.proxima,
  });
  const alteracao = useMutation({
    mutationFn: (acao: Acao) => acao.tipo === "salvar"
      ? salvarAluno(sessao, acao.edicao, acao.edicao.id)
      : arquivarAluno(sessao, acao.aluno.objectId),
    async onSuccess(_resposta, acao) {
      await cache.invalidateQueries({ queryKey: chave });
      setEdicao(null);
      setExclusao(null);
      setAviso(acao.tipo === "arquivar" ? "Aluno arquivado." : acao.edicao.id ? "Aluno atualizado." : "Aluno cadastrado.");
    },
    onSettled() {
      bloqueioAlteracao.current = false;
    },
  });

  const expirou = sessaoExpirada(lista.error) || sessaoExpirada(alteracao.error);
  const semAcesso = acessoNegado(lista.error) || acessoNegado(alteracao.error);
  useEffect(() => {
    if (expirou) void aoExpirar();
  }, [aoExpirar, expirou]);

  async function encerrar() {
    if (bloqueioSaida.current || bloqueioAlteracao.current) return;
    bloqueioSaida.current = true;
    setSaindo(true);
    setErroSaida("");
    try {
      await sair(sessao);
      aoSair();
    } catch (erro) {
      setErroSaida(erro instanceof Error ? erro.message : "Não foi possível sair.");
    } finally {
      bloqueioSaida.current = false;
      setSaindo(false);
    }
  }

  function comecarEdicao(aluno?: Aluno) {
    alteracao.reset();
    setEdicao(aluno
      ? { id: aluno.objectId, nome: aluno.nome ?? "", matricula: aluno.matricula ?? "" }
      : { nome: "", matricula: "" });
  }

  function executar(acao: Acao) {
    if (bloqueioAlteracao.current || bloqueioSaida.current) return;
    bloqueioAlteracao.current = true;
    alteracao.mutate(acao);
  }

  const botaoSair = (
    <Button
      mode="outlined"
      disabled={saindo || alteracao.isPending}
      loading={saindo}
      onPress={() => void encerrar()}
    >
      Sair
    </Button>
  );
  const mensagemSaida = erroSaida
    ? <HelperText type="error" accessibilityLiveRegion="polite">{erroSaida}</HelperText>
    : null;

  if (expirou) return <Page><ActivityIndicator accessibilityLabel="Encerrando sessão" /></Page>;
  if (semAcesso) {
    return (
      <Page>
        <Text accessibilityRole="header" variant="titleLarge">Acesso aguardando autorização</Text>
        <Text>A direção precisa autorizar esta conta no perfil EquipeEscolar.</Text>
        <Button
          mode="contained"
          disabled={saindo || lista.isFetching}
          loading={lista.isFetching}
          onPress={() => {
            alteracao.reset();
            setEdicao(null);
            setExclusao(null);
            void lista.refetch();
          }}
        >
          Verificar acesso
        </Button>
        {botaoSair}
        {mensagemSaida}
      </Page>
    );
  }

  if (edicao) {
    return (
      <Page>
        <View style={styles.bloco}>
          <Text accessibilityRole="header" variant="titleLarge">{edicao.id ? "Editar aluno" : "Cadastrar aluno"}</Text>
          <TextInput
            label="Nome"
            mode="outlined"
            value={edicao.nome}
            maxLength={120}
            disabled={alteracao.isPending}
            onChangeText={(nome) => setEdicao({ ...edicao, nome })}
          />
          <TextInput
            label="Número de matrícula"
            mode="outlined"
            value={edicao.matricula}
            maxLength={40}
            autoCapitalize="characters"
            autoCorrect={false}
            disabled={alteracao.isPending}
            onChangeText={(matricula) => setEdicao({ ...edicao, matricula })}
          />
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

  const alunos = [...new Map(lista.data?.pages.flatMap((pagina) =>
    pagina.alunos.map((aluno) => [aluno.objectId, aluno] as const))).values()];

  return (
    <View style={[styles.tela, { backgroundColor: colors.background }]}>
      <FlatList
        data={alunos}
        keyExtractor={(aluno) => aluno.objectId}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        refreshing={lista.isRefetching && !lista.isFetchingNextPage}
        onRefresh={() => void lista.refetch()}
        ListHeaderComponent={
          <View style={styles.bloco}>
            <View style={styles.cabecalho}>
              {sessao.email ? <Text style={styles.conta}>{sessao.email}</Text> : null}
              {botaoSair}
            </View>
            {mensagemSaida}
            <Button
              mode="contained"
              icon="plus"
              disabled={!lista.data || saindo}
              onPress={() => comecarEdicao()}
            >
              Adicionar aluno
            </Button>
            <Searchbar
              placeholder="Buscar por nome ou matrícula"
              accessibilityLabel="Buscar aluno por nome ou matrícula"
              clearAccessibilityLabel="Limpar busca"
              value={textoBusca}
              onChangeText={setTextoBusca}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={120}
            />
          </View>
        }
        ListEmptyComponent={lista.isPending
          ? <ActivityIndicator accessibilityLabel="Carregando alunos" />
          : lista.isError ? undefined : (
            <Text accessibilityLiveRegion="polite">
              {busca ? "Nenhum aluno corresponde à busca." : "Nenhum aluno cadastrado."}
            </Text>
          )}
        renderItem={({ item }) => (
          <Card mode="outlined">
            <Card.Content>
              <Text variant="titleMedium">{item.nome || "Aluno sem nome"}</Text>
              <Text variant="bodyMedium">Matrícula {item.matricula || "indisponível"}</Text>
            </Card.Content>
            <Card.Actions>
              <Button
                textColor={colors.error}
                disabled={saindo}
                onPress={() => {
                  alteracao.reset();
                  setExclusao(item);
                }}
              >
                Arquivar
              </Button>
              <Button disabled={saindo} onPress={() => comecarEdicao(item)}>Editar</Button>
            </Card.Actions>
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
          dismissableBackButton={!alteracao.isPending}
          onDismiss={() => setExclusao(null)}
        >
          <Dialog.Title>Arquivar aluno?</Dialog.Title>
          <Dialog.Content>
            <Text>O cadastro de {exclusao?.nome || "aluno"} sairá da lista. O histórico será preservado.</Text>
            {alteracao.error ? <HelperText type="error">{alteracao.error.message}</HelperText> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={alteracao.isPending} onPress={() => setExclusao(null)}>Cancelar</Button>
            <Button
              textColor={colors.error}
              disabled={!exclusao || alteracao.isPending}
              loading={alteracao.isPending}
              onPress={() => exclusao && executar({ tipo: "arquivar", aluno: exclusao })}
            >
              Arquivar
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
  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  conta: { flexShrink: 1 },
});

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator, Button, Card, Dialog, HelperText, Portal, Snackbar, Text, TextInput, useTheme,
} from "react-native-paper";
import { Page } from "../../components/Page";
import { acessoNegado, sessaoExpirada, type SessaoAlunos } from "../alunos/api";
import { VinculoConta } from "../escola/VinculoConta";
import { arquivarProfessor, listarProfessores, salvarProfessor, type DadosProfessor, type Professor } from "./api";

type Props = { sessao: SessaoAlunos; aoVoltar: () => void; aoExpirar: () => Promise<void> };
type Edicao = DadosProfessor & { id?: string };
type Alteracao = { tipo: "salvar"; edicao: Edicao } | { tipo: "arquivar"; professor: Professor };

export function ListaProfessores({ sessao, aoVoltar, aoExpirar }: Props) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [arquivamento, setArquivamento] = useState<Professor | null>(null);
  const [vinculo, setVinculo] = useState<Professor | null>(null);
  const [aviso, setAviso] = useState("");
  const bloqueio = useRef(false);
  const chave = ["professores", sessao.usuarioId] as const;
  const lista = useInfiniteQuery({
    queryKey: chave,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listarProfessores(sessao, pageParam, signal),
    getNextPageParam: (pagina) => pagina.proxima,
  });
  const alteracao = useMutation({
    mutationFn: (acao: Alteracao) => acao.tipo === "salvar"
      ? salvarProfessor(sessao, acao.edicao, acao.edicao.id)
      : arquivarProfessor(sessao, acao.professor.objectId),
    async onSuccess(_resultado, acao) {
      await cache.invalidateQueries({ queryKey: chave });
      setEdicao(null);
      setArquivamento(null);
      setAviso(acao.tipo === "arquivar" ? "Professor arquivado." : "Professor salvo.");
    },
    onSettled() {
      bloqueio.current = false;
    },
  });

  const expirou = sessaoExpirada(lista.error) || sessaoExpirada(alteracao.error);
  const semAcesso = acessoNegado(lista.error) || acessoNegado(alteracao.error);
  useEffect(() => {
    if (expirou) void aoExpirar();
  }, [aoExpirar, expirou]);

  function editar(professor?: Professor) {
    alteracao.reset();
    setEdicao({ id: professor?.objectId, nome: professor?.nome ?? "", email: professor?.email ?? "" });
  }

  function executar(acao: Alteracao) {
    if (bloqueio.current) return;
    bloqueio.current = true;
    alteracao.mutate(acao);
  }

  if (expirou) return <Page><ActivityIndicator accessibilityLabel="Encerrando sessão" /></Page>;
  if (semAcesso) {
    return (
      <Page>
        <Text>A direção precisa autorizar esta conta no perfil EquipeEscolar.</Text>
        <Button mode="outlined" onPress={aoVoltar}>Voltar para Alunos</Button>
        <Button onPress={() => {
          alteracao.reset();
          setEdicao(null);
          setArquivamento(null);
          void lista.refetch();
        }} disabled={lista.isFetching}>Verificar acesso</Button>
      </Page>
    );
  }

  if (edicao) {
    return (
      <Page>
        <View style={styles.grupo}>
          <Text variant="titleLarge" accessibilityRole="header">{edicao.id ? "Editar professor" : "Cadastrar professor"}</Text>
          <TextInput
            label="Nome"
            mode="outlined"
            value={edicao.nome}
            maxLength={120}
            disabled={alteracao.isPending}
            onChangeText={(nome) => setEdicao({ ...edicao, nome })}
          />
          <TextInput
            label="E-mail (opcional)"
            mode="outlined"
            value={edicao.email}
            maxLength={160}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            disabled={alteracao.isPending}
            onChangeText={(email) => setEdicao({ ...edicao, email })}
          />
          {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          <Button
            mode="contained"
            loading={alteracao.isPending}
            disabled={!edicao.nome.trim() || alteracao.isPending}
            onPress={() => executar({ tipo: "salvar", edicao })}
          >
            Salvar
          </Button>
          <Button disabled={alteracao.isPending} onPress={() => setEdicao(null)}>Cancelar</Button>
        </View>
      </Page>
    );
  }

  const professores = [...new Map(lista.data?.pages.flatMap(({ registros }) =>
    registros.map((professor) => [professor.objectId, professor] as const))).values()];

  return (
    <Page>
      <View style={styles.grupo}>
        <Button icon="arrow-left" onPress={aoVoltar} disabled={alteracao.isPending} style={styles.voltar}>Voltar para Alunos</Button>
        <Button mode="contained" icon="plus" disabled={!lista.data || alteracao.isPending} onPress={() => editar()}>
          Adicionar professor
        </Button>
        {lista.isPending ? <ActivityIndicator accessibilityLabel="Carregando professores" /> : null}
        {!lista.isError && lista.data && !professores.length ? <Text>Nenhum professor cadastrado.</Text> : null}
        {professores.map((professor) => (
          <Card key={professor.objectId} mode="outlined">
            <Card.Title title={professor.nome || "Professor sem nome"} subtitle={professor.email || undefined} />
            <Card.Actions style={styles.acoes}>
              <Button disabled={alteracao.isPending} onPress={() => setVinculo(professor)}>Vincular conta</Button>
              <Button textColor={colors.error} disabled={alteracao.isPending} onPress={() => {
                alteracao.reset();
                setArquivamento(professor);
              }}>Arquivar</Button>
              <Button disabled={alteracao.isPending} onPress={() => editar(professor)}>Editar</Button>
            </Card.Actions>
          </Card>
        ))}
        {lista.isError ? (
          <>
            <HelperText type="error" accessibilityLiveRegion="polite">{lista.error.message}</HelperText>
            <Button mode="outlined" onPress={() => void lista.refetch()}>Tentar novamente</Button>
          </>
        ) : lista.hasNextPage ? (
          <Button disabled={lista.isFetching} loading={lista.isFetchingNextPage} onPress={() => void lista.fetchNextPage()}>
            Carregar mais
          </Button>
        ) : null}
      </View>
      {vinculo ? (
        <VinculoConta sessao={sessao} tipo="professor" registroId={vinculo.objectId} nome={vinculo.nome}
          aoFechar={() => setVinculo(null)} aoExpirar={aoExpirar} />
      ) : null}
      <Portal>
        <Dialog visible={Boolean(arquivamento)} dismissable={!alteracao.isPending}
          dismissableBackButton={!alteracao.isPending} onDismiss={() => setArquivamento(null)}>
          <Dialog.Title>Arquivar professor?</Dialog.Title>
          <Dialog.Content>
            <Text>{arquivamento?.nome || "O cadastro"} sairá da lista. Os vínculos com eletivas serão preservados.</Text>
            {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={alteracao.isPending} onPress={() => setArquivamento(null)}>Cancelar</Button>
            <Button textColor={colors.error} loading={alteracao.isPending} disabled={!arquivamento || alteracao.isPending}
              onPress={() => arquivamento && executar({ tipo: "arquivar", professor: arquivamento })}>Arquivar</Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso("")}>{aviso}</Snackbar>
      </Portal>
    </Page>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 12 },
  voltar: { alignSelf: "flex-start" },
  acoes: { flexWrap: "wrap" },
});

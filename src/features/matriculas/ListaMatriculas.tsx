import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator, Button, Card, Dialog, HelperText, List, Portal, RadioButton, Snackbar, Text, useTheme,
} from "react-native-paper";
import { Page } from "../../components/Page";
import { acessoNegado, sessaoExpirada, type SessaoAlunos } from "../alunos/api";
import {
  buscarAlunoDaMatricula, listarEletivasParaMatricula, listarMatriculas, removerMatricula, salvarMatricula,
  type EletivaResumo, type Matricula, type SituacaoMatricula,
} from "./api";

type Props = { sessao: SessaoAlunos; alunoId: string; aoVoltar: () => void; aoExpirar: () => Promise<void> };
type Edicao = { id?: string; eletiva?: EletivaResumo; situacao: SituacaoMatricula };
type Alteracao = { tipo: "salvar"; edicao: Edicao } | { tipo: "remover"; matricula: Matricula };

function tituloEletiva(eletiva?: EletivaResumo) {
  const titulo = eletiva?.titulo || "Eletiva indisponível";
  return eletiva?.arquivado || eletiva?.arquivada ? titulo + " (arquivada)" : titulo;
}

export function ListaMatriculas({ sessao, alunoId, aoVoltar, aoExpirar }: Props) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [escolhendoEletiva, setEscolhendoEletiva] = useState(false);
  const [remocao, setRemocao] = useState<Matricula | null>(null);
  const [aviso, setAviso] = useState("");
  const bloqueio = useRef(false);
  const chave = ["matriculas", sessao.usuarioId, alunoId] as const;

  const aluno = useQuery({
    queryKey: ["aluno-matriculas", sessao.usuarioId, alunoId],
    queryFn: ({ signal }) => buscarAlunoDaMatricula(sessao, alunoId, signal),
  });
  const lista = useInfiniteQuery({
    queryKey: chave,
    enabled: aluno.isSuccess,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listarMatriculas(sessao, alunoId, pageParam, signal),
    getNextPageParam: (pagina) => pagina.proxima,
  });
  const eletivas = useInfiniteQuery({
    queryKey: ["eletivas-para-matricula", sessao.usuarioId],
    enabled: escolhendoEletiva && aluno.isSuccess,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listarEletivasParaMatricula(sessao, pageParam, signal),
    getNextPageParam: (pagina) => pagina.proxima,
  });
  const alteracao = useMutation({
    mutationFn: (acao: Alteracao) => acao.tipo === "salvar"
      ? salvarMatricula(sessao, {
        alunoId,
        eletivaId: acao.edicao.eletiva?.objectId ?? "",
        situacao: acao.edicao.situacao,
      }, acao.edicao.id)
      : removerMatricula(sessao, acao.matricula.objectId),
    async onSuccess(_resultado, acao) {
      await cache.invalidateQueries({ queryKey: chave });
      setEdicao(null);
      setRemocao(null);
      setAviso(acao.tipo === "remover" ? "Matrícula removida." : "Matrícula salva.");
    },
    onSettled() {
      bloqueio.current = false;
    },
  });
  const erros = [aluno.error, lista.error, escolhendoEletiva ? eletivas.error : null, alteracao.error];
  const expirou = erros.some(sessaoExpirada);
  const semAcesso = erros.some(acessoNegado);
  useEffect(() => {
    if (expirou) void aoExpirar();
  }, [aoExpirar, expirou]);

  function editar(matricula?: Matricula) {
    alteracao.reset();
    setEdicao({ id: matricula?.objectId, eletiva: matricula?.eletiva, situacao: matricula?.situacao ?? "ativa" });
  }

  function executar(acao: Alteracao) {
    if (bloqueio.current) return;
    bloqueio.current = true;
    alteracao.mutate(acao);
  }

  if (expirou) return <Page><ActivityIndicator accessibilityLabel="Encerrando sessão" /></Page>;
  const voltar = (
    <Button icon="arrow-left" onPress={aoVoltar} disabled={alteracao.isPending} style={styles.voltar}>Voltar para Alunos</Button>
  );
  if (semAcesso) {
    return <Page>{voltar}<Text>A direção precisa autorizar esta conta no perfil EquipeEscolar.</Text></Page>;
  }
  if (aluno.isError) {
    return (
      <Page>
        {voltar}
        <HelperText type="error" accessibilityLiveRegion="polite">{aluno.error.message}</HelperText>
        <Button mode="outlined" disabled={aluno.isFetching} onPress={() => void aluno.refetch()}>Tentar novamente</Button>
      </Page>
    );
  }
  if (aluno.isPending) return <Page>{voltar}<ActivityIndicator accessibilityLabel="Carregando aluno" /></Page>;

  if (edicao && escolhendoEletiva) {
    const opcoes = [...new Map(eletivas.data?.pages.flatMap(({ registros }) =>
      registros.map((eletiva) => [eletiva.objectId, eletiva] as const))).values()];

    return (
      <Page>
        <View style={styles.grupo}>
          <Button icon="arrow-left" onPress={() => setEscolhendoEletiva(false)} style={styles.voltar}>Voltar ao formulário</Button>
          <Text variant="titleLarge" accessibilityRole="header">Selecione uma eletiva</Text>
          {eletivas.isPending ? <ActivityIndicator accessibilityLabel="Carregando eletivas" /> : null}
          {eletivas.isSuccess && !opcoes.length ? <Text>Nenhuma eletiva ativa cadastrada.</Text> : null}
          {opcoes.map((eletiva) => (
            <List.Item key={eletiva.objectId} title={tituloEletiva(eletiva)} description={eletiva.area}
              onPress={() => {
                setEdicao({ ...edicao, eletiva });
                setEscolhendoEletiva(false);
              }}
            />
          ))}
          {eletivas.isError ? (
            <>
              <HelperText type="error" accessibilityLiveRegion="polite">{eletivas.error.message}</HelperText>
              <Button mode="outlined" onPress={() => void eletivas.refetch()}>Tentar novamente</Button>
            </>
          ) : eletivas.hasNextPage ? (
            <Button disabled={eletivas.isFetching} loading={eletivas.isFetchingNextPage}
              onPress={() => void eletivas.fetchNextPage()}>Carregar mais eletivas</Button>
          ) : null}
        </View>
      </Page>
    );
  }

  if (edicao) {
    return (
      <Page>
        <View style={styles.grupo}>
          <Text variant="titleLarge" accessibilityRole="header">{edicao.id ? "Editar matrícula" : "Nova matrícula"}</Text>
          {edicao.eletiva ? <Text>{tituloEletiva(edicao.eletiva)}</Text> : null}
          <Button mode="outlined" icon="book-open-variant" disabled={alteracao.isPending} onPress={() => setEscolhendoEletiva(true)}>
            {edicao.eletiva ? "Trocar eletiva" : "Selecionar eletiva"}
          </Button>
          <Text variant="titleMedium">Situação</Text>
          <RadioButton.Group value={edicao.situacao} onValueChange={(situacao) => {
            if (situacao === "ativa" || situacao === "inativa") setEdicao({ ...edicao, situacao });
          }}>
            <RadioButton.Item label="Ativa" value="ativa" disabled={alteracao.isPending} />
            <RadioButton.Item label="Inativa" value="inativa" disabled={alteracao.isPending} />
          </RadioButton.Group>
          {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          <Button mode="contained" disabled={!edicao.eletiva?.objectId || alteracao.isPending} loading={alteracao.isPending}
            onPress={() => executar({ tipo: "salvar", edicao })}>Salvar</Button>
          <Button disabled={alteracao.isPending} onPress={() => setEdicao(null)}>Cancelar</Button>
        </View>
      </Page>
    );
  }

  const matriculas = [...new Map(lista.data?.pages.flatMap(({ registros }) =>
    registros.map((matricula) => [matricula.objectId, matricula] as const))).values()];

  return (
    <Page>
      <View style={styles.grupo}>
        {voltar}
        <Text variant="titleLarge" accessibilityRole="header">{aluno.data.nome || "Aluno sem nome"}</Text>
        <Button mode="contained" icon="plus" disabled={!lista.data || alteracao.isPending} onPress={() => editar()}>
          Nova matrícula
        </Button>
        {lista.isPending ? <ActivityIndicator accessibilityLabel="Carregando matrículas" /> : null}
        {lista.isSuccess && !matriculas.length ? <Text>Nenhuma matrícula para este aluno.</Text> : null}
        {matriculas.map((matricula) => (
          <Card key={matricula.objectId} mode="outlined">
            <Card.Title title={tituloEletiva(matricula.eletiva)}
              subtitle={matricula.situacao === "ativa" ? "Ativa" : matricula.situacao === "inativa" ? "Inativa" : "Situação indisponível"} />
            <Card.Actions>
              <Button textColor={colors.error} disabled={alteracao.isPending} onPress={() => {
                alteracao.reset();
                setRemocao(matricula);
              }}>Remover</Button>
              <Button disabled={alteracao.isPending} onPress={() => editar(matricula)}>Editar</Button>
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
      <Portal>
        <Dialog visible={Boolean(remocao)} dismissable={!alteracao.isPending}
          dismissableBackButton={!alteracao.isPending} onDismiss={() => setRemocao(null)}>
          <Dialog.Title>Remover matrícula?</Dialog.Title>
          <Dialog.Content>
            <Text>O vínculo com {tituloEletiva(remocao?.eletiva)} será removido.</Text>
            {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={alteracao.isPending} onPress={() => setRemocao(null)}>Cancelar</Button>
            <Button textColor={colors.error} disabled={!remocao || alteracao.isPending} loading={alteracao.isPending}
              onPress={() => remocao && executar({ tipo: "remover", matricula: remocao })}>Remover</Button>
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
});

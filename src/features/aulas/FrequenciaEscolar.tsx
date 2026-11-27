import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Dialog, HelperText, Portal, RadioButton, Searchbar, Text, TextInput, useTheme } from "react-native-paper";
import { Page } from "../../components/Page";
import { acessoNegado, sessaoExpirada } from "../alunos/api";
import { type SessaoComPerfil } from "../escola/AcessoEscolar";
import { alterarFrequencia, listarFrequencia, type AlunoFrequencia, type AlteracaoFrequencia } from "./api";

type Props = SessaoComPerfil & { aulaId: string; aoVoltar: () => void };
type Edicao = { registro: AlunoFrequencia; presente: boolean; observacao: string };

export function FrequenciaEscolar({ sessao, expirar, botaoSair, aulaId, aoVoltar }: Props) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const bloqueio = useRef(false);
  const chave = ["frequencia-aula", sessao.usuarioId, aulaId] as const;

  useEffect(() => {
    const espera = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto]);
  const lista = useInfiniteQuery({
    queryKey: [...chave, busca],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listarFrequencia(sessao, aulaId, busca, pageParam, signal),
    getNextPageParam: (pagina) => pagina.proxima ?? undefined,
  });
  const alteracao = useMutation({
    mutationFn: (dados: AlteracaoFrequencia) => alterarFrequencia(sessao, aulaId, dados),
    async onSuccess() {
      await Promise.all([
        cache.invalidateQueries({ queryKey: chave }),
        cache.invalidateQueries({ queryKey: ["consulta-escolar", sessao.usuarioId] }),
      ]);
      setEdicao(null);
      setRemovendo(false);
    },
    onSettled() {
      bloqueio.current = false;
    },
  });
  const expirou = sessaoExpirada(lista.error) || sessaoExpirada(alteracao.error);
  useEffect(() => {
    if (expirou) void expirar();
  }, [expirou, expirar]);

  function executar(dados: AlteracaoFrequencia) {
    if (bloqueio.current) return;
    bloqueio.current = true;
    alteracao.mutate(dados);
  }

  if (expirou) return <Page><ActivityIndicator accessibilityLabel="Encerrando sessão" /></Page>;
  if (acessoNegado(lista.error) || acessoNegado(alteracao.error)) {
    return <Page><Text>Seu perfil não pode registrar frequência nesta aula.</Text><Button onPress={aoVoltar}>Voltar às aulas</Button></Page>;
  }
  if (edicao) {
    return (
      <Page>
        <View style={styles.grupo}>
          <Text variant="titleLarge" accessibilityRole="header">{edicao.registro.nome || "Aluno"}</Text>
          <RadioButton.Group value={edicao.presente ? "presente" : "ausente"}
            onValueChange={(valor) => setEdicao({ ...edicao, presente: valor === "presente" })}>
            <RadioButton.Item label="Presente" value="presente" disabled={alteracao.isPending} />
            <RadioButton.Item label="Ausente" value="ausente" disabled={alteracao.isPending} />
          </RadioButton.Group>
          <TextInput label="Observação (opcional)" mode="outlined" maxLength={500} multiline value={edicao.observacao}
            disabled={alteracao.isPending} onChangeText={(observacao) => setEdicao({ ...edicao, observacao })} />
          {!removendo && alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          <Button mode="contained" loading={alteracao.isPending && !removendo} disabled={alteracao.isPending}
            onPress={() => executar({
              operacao: "salvar", alunoId: edicao.registro.id, presente: edicao.presente, observacao: edicao.observacao,
            })}>Salvar</Button>
          {edicao.registro.presente !== null ? (
            <Button textColor={colors.error} disabled={alteracao.isPending} onPress={() => {
              alteracao.reset();
              setRemovendo(true);
            }}>Remover registro</Button>
          ) : null}
          <Button disabled={alteracao.isPending} onPress={() => setEdicao(null)}>Cancelar</Button>
        </View>
        <Portal>
          <Dialog visible={removendo} dismissable={!alteracao.isPending}
            dismissableBackButton={!alteracao.isPending} onDismiss={() => setRemovendo(false)}>
            <Dialog.Title>Remover registro de frequência?</Dialog.Title>
            <Dialog.Content>
              <Text>A presença ou ausência deste aluno nesta aula será removida.</Text>
              {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button disabled={alteracao.isPending} onPress={() => setRemovendo(false)}>Cancelar</Button>
              <Button textColor={colors.error} loading={alteracao.isPending} disabled={alteracao.isPending}
                onPress={() => executar({ operacao: "remover", alunoId: edicao.registro.id })}>Remover</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </Page>
    );
  }

  const registros = [...new Map(lista.data?.pages.flatMap((pagina) =>
    pagina.registros.map((item) => [item.id, item] as const))).values()];
  return (
    <Page>
      <View style={styles.grupo}>
        <Text variant="titleLarge" accessibilityRole="header">{lista.data?.pages[0]?.titulo || "Frequência da aula"}</Text>
        <Button icon="arrow-left" onPress={aoVoltar}>Voltar às aulas</Button>
        {botaoSair}
        <Searchbar value={texto} onChangeText={setTexto} maxLength={100} autoCorrect={false}
          placeholder="Buscar aluno da turma" accessibilityLabel="Buscar aluno da turma" clearAccessibilityLabel="Limpar busca" />
        {lista.isPending ? <ActivityIndicator accessibilityLabel="Carregando turma" /> : null}
        {lista.isSuccess && !registros.length ? <Text>Nenhum aluno com matrícula ativa encontrado.</Text> : null}
        {registros.map((registro) => (
          <Card key={registro.id} mode="outlined">
            <Card.Content>
              <Text variant="titleMedium">{registro.nome || "Aluno sem nome"}</Text>
              {registro.matricula ? <Text>{registro.matricula}</Text> : null}
              <Text>{registro.presente === null ? "Sem registro" : registro.presente ? "Presente" : "Ausente"}</Text>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => {
                alteracao.reset();
                setEdicao({ registro, presente: registro.presente ?? true, observacao: registro.observacao });
              }}>{registro.presente === null ? "Registrar" : "Editar"}</Button>
            </Card.Actions>
          </Card>
        ))}
        {lista.isError ? (
          <>
            <HelperText type="error" accessibilityLiveRegion="polite">{lista.error.message}</HelperText>
            <Button mode="outlined" disabled={lista.isFetching} onPress={() => void lista.refetch()}>Tentar novamente</Button>
          </>
        ) : lista.hasNextPage ? (
          <Button disabled={lista.isFetching} loading={lista.isFetchingNextPage} onPress={() => void lista.fetchNextPage()}>Carregar mais</Button>
        ) : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({ grupo: { gap: 12 } });

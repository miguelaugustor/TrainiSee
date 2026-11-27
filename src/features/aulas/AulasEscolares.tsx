import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, HelperText, Portal, Snackbar, Text, TextInput, useTheme } from "react-native-paper";
import { Page } from "../../components/Page";
import { sessaoExpirada } from "../alunos/api";
import { type SessaoComPerfil } from "../escola/AcessoEscolar";
import { ConsultaEscolar } from "../escola/ConsultaEscolar";
import { type RegistroEscolar } from "../escola/api";
import { arquivarAula, salvarAula, type DadosAula } from "./api";

type Props = SessaoComPerfil & { aoVoltar: () => void; aoAbrirFrequencia: (aulaId: string) => void };
type Formulario = DadosAula & { id?: string; eletivaTitulo?: string };
type Alteracao = { tipo: "salvar"; dados: Formulario } | { tipo: "arquivar"; aula: RegistroEscolar };

export function AulasEscolares({ aoVoltar, aoAbrirFrequencia, ...acesso }: Props) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const { sessao, expirar, perfil } = acesso;
  const administrador = perfil.perfil === "administrador";
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [arquivamento, setArquivamento] = useState<RegistroEscolar | null>(null);
  const [aviso, setAviso] = useState("");
  const bloqueio = useRef(false);
  const alteracao = useMutation({
    mutationFn: (acao: Alteracao) => acao.tipo === "salvar"
      ? salvarAula(sessao, acao.dados, acao.dados.id)
      : arquivarAula(sessao, acao.aula.id),
    async onSuccess(_resultado, acao) {
      await cache.invalidateQueries({ queryKey: ["consulta-escolar", sessao.usuarioId] });
      setFormulario(null);
      setArquivamento(null);
      setAviso(acao.tipo === "salvar" ? "Aula salva." : "Aula arquivada.");
    },
    onSettled() {
      bloqueio.current = false;
    },
  });
  const expirou = sessaoExpirada(alteracao.error);
  useEffect(() => {
    if (expirou) void expirar();
  }, [expirou, expirar]);

  function editar(item?: RegistroEscolar) {
    alteracao.reset();
    setFormulario({
      id: item?.id,
      titulo: item?.titulo ?? "",
      data: item?.aula?.data ?? "",
      horario: item?.aula?.horario ?? "",
      eletivaId: item?.aula?.eletivaId ?? "",
      eletivaTitulo: item?.aula?.eletivaTitulo,
    });
  }

  function executar(acao: Alteracao) {
    if (bloqueio.current) return;
    bloqueio.current = true;
    alteracao.mutate(acao);
  }

  if (formulario && escolhendo) {
    return <ConsultaEscolar
      {...acesso}
      somente="eletivas"
      antes={<Button onPress={() => setEscolhendo(false)}>Voltar à aula</Button>}
      acoes={(eletiva) => <Button onPress={() => {
        setFormulario({ ...formulario, eletivaId: eletiva.id, eletivaTitulo: eletiva.titulo });
        setEscolhendo(false);
      }}>Selecionar</Button>}
    />;
  }

  if (formulario) {
    return (
      <Page>
        <View style={styles.grupo}>
          <Text variant="titleLarge" accessibilityRole="header">{formulario.id ? "Editar aula" : "Nova aula"}</Text>
          <TextInput label="Título" mode="outlined" value={formulario.titulo} maxLength={120}
            disabled={alteracao.isPending} onChangeText={(titulo) => setFormulario({ ...formulario, titulo })} />
          <TextInput label="Data (AAAA-MM-DD)" mode="outlined" value={formulario.data} maxLength={10}
            disabled={alteracao.isPending} onChangeText={(data) => setFormulario({ ...formulario, data })} />
          <TextInput label="Horário (HH:MM)" mode="outlined" value={formulario.horario} maxLength={5}
            disabled={alteracao.isPending} onChangeText={(horario) => setFormulario({ ...formulario, horario })} />
          <Button mode="outlined" disabled={alteracao.isPending} onPress={() => setEscolhendo(true)}>
            {formulario.eletivaTitulo || "Selecionar eletiva"}
          </Button>
          {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          <Button mode="contained" loading={alteracao.isPending} disabled={!formulario.eletivaId || alteracao.isPending}
            onPress={() => executar({ tipo: "salvar", dados: formulario })}>Salvar</Button>
          <Button disabled={alteracao.isPending} onPress={() => setFormulario(null)}>Cancelar</Button>
        </View>
      </Page>
    );
  }

  return (
    <>
      <ConsultaEscolar
        {...acesso}
        somente="aulas"
        antes={<>
          <Button onPress={aoVoltar}>Voltar à área escolar</Button>
          {administrador ? <Button mode="contained" icon="plus" onPress={() => editar()}>Adicionar aula</Button> : null}
        </>}
        acoes={(aula) => <>
          <Button disabled={alteracao.isPending} onPress={() => aoAbrirFrequencia(aula.id)}>Frequência</Button>
          {administrador ? <>
            <Button disabled={alteracao.isPending} onPress={() => editar(aula)}>Editar</Button>
            <Button textColor={colors.error} disabled={alteracao.isPending} onPress={() => {
              alteracao.reset();
              setArquivamento(aula);
            }}>Arquivar</Button>
          </> : null}
        </>}
      />
      <Portal>
        <Dialog visible={Boolean(arquivamento)} dismissable={!alteracao.isPending}
          dismissableBackButton={!alteracao.isPending} onDismiss={() => setArquivamento(null)}>
          <Dialog.Title>Arquivar aula?</Dialog.Title>
          <Dialog.Content>
            <Text>A aula sairá da lista. As frequências registradas serão preservadas.</Text>
            {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={alteracao.isPending} onPress={() => setArquivamento(null)}>Cancelar</Button>
            <Button textColor={colors.error} loading={alteracao.isPending} disabled={!arquivamento || alteracao.isPending}
              onPress={() => arquivamento && executar({ tipo: "arquivar", aula: arquivamento })}>Arquivar</Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso("")}>{aviso}</Snackbar>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({ grupo: { gap: 12 } });

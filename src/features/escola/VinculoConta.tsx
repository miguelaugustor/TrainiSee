import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { sessaoExpirada, type SessaoAlunos } from "../alunos/api";
import { executarFuncaoEscolar } from "./api";

type Props = {
  sessao: SessaoAlunos;
  tipo: "aluno" | "professor";
  registroId: string;
  nome?: string;
  aoFechar: () => void;
  aoExpirar: () => Promise<void>;
};

export function VinculoConta({ sessao, tipo, registroId, nome, aoFechar, aoExpirar }: Props) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [confirmaRemocao, setConfirmaRemocao] = useState(false);
  const bloqueio = useRef(false);
  const alteracao = useMutation({
    mutationFn: (endereco: string | null) => executarFuncaoEscolar<{ email: string | null }>(
      sessao, "vincularContaEscolar", { tipo, registroId, email: endereco },
    ),
    onSettled() {
      bloqueio.current = false;
    },
  });
  const expirou = sessaoExpirada(alteracao.error);
  useEffect(() => {
    if (expirou) void aoExpirar();
  }, [aoExpirar, expirou]);

  function executar(endereco: string | null) {
    if (bloqueio.current) return;
    bloqueio.current = true;
    alteracao.mutate(endereco);
  }

  return (
    <Portal>
      <Dialog visible dismissable={!alteracao.isPending} dismissableBackButton={!alteracao.isPending} onDismiss={aoFechar}>
        <Dialog.Title>{confirmaRemocao ? "Desvincular conta?" : "Vincular conta"}</Dialog.Title>
        <Dialog.Content>
          {nome ? <Text variant="titleMedium">{nome}</Text> : null}
          {alteracao.isSuccess ? (
            <Text accessibilityLiveRegion="polite">
              {alteracao.data.email ? "Conta vinculada a " + alteracao.data.email : "Conta desvinculada."}
            </Text>
          ) : confirmaRemocao ? (
            <Text>O acesso deste cadastro pela conta será revogado.</Text>
          ) : (
            <TextInput label="E-mail de acesso da conta" mode="outlined" value={email} onChangeText={setEmail}
              maxLength={160} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
              disabled={alteracao.isPending}
            />
          )}
          {alteracao.error ? <HelperText type="error" accessibilityLiveRegion="polite">{alteracao.error.message}</HelperText> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button disabled={alteracao.isPending} onPress={aoFechar}>{alteracao.isSuccess ? "Fechar" : "Cancelar"}</Button>
          {!alteracao.isSuccess && confirmaRemocao ? (
            <Button textColor={colors.error} disabled={alteracao.isPending} loading={alteracao.isPending}
              onPress={() => executar(null)}>Desvincular</Button>
          ) : null}
          {!alteracao.isSuccess && !confirmaRemocao ? (
            <>
              <Button textColor={colors.error} disabled={alteracao.isPending} onPress={() => {
                alteracao.reset();
                setConfirmaRemocao(true);
              }}>Desvincular</Button>
              <Button disabled={!email.trim() || alteracao.isPending} loading={alteracao.isPending}
                onPress={() => executar(email.trim())}>Vincular</Button>
            </>
          ) : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { Page } from "../../components/Page";
import { autenticar, ErroAlunos, type SessaoAlunos } from "./api";

type Props = { aoEntrar: (sessao: SessaoAlunos) => void; aviso?: string };

export function AcessoAlunos({ aoEntrar, aviso }: Props) {
  const [cadastro, setCadastro] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bloqueio = useRef(false);

  async function enviar() {
    if (bloqueio.current) return;
    const emailNormalizado = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      setErro("Informe um e-mail válido.");
      return;
    }
    if (!senha || (cadastro && senha.length < 8)) {
      setErro(cadastro ? "Use uma senha com pelo menos 8 caracteres." : "Informe a senha.");
      return;
    }
    if (cadastro && senha !== confirmacao) {
      setErro("As duas senhas precisam ser iguais.");
      return;
    }

    bloqueio.current = true;
    setEnviando(true);
    setErro("");
    try {
      aoEntrar(await autenticar(emailNormalizado, senha, cadastro));
    } catch (falha) {
      if (falha instanceof ErroAlunos) {
        setErro(!cadastro && falha.codigo === 101 ? "E-mail ou senha inválidos." : falha.message);
      } else {
        setErro("Não foi possível acessar a conta.");
      }
      setSenha("");
      setConfirmacao("");
    } finally {
      bloqueio.current = false;
      setEnviando(false);
    }
  }

  function mudarModo() {
    setCadastro(!cadastro);
    setSenha("");
    setConfirmacao("");
    setErro("");
  }

  return (
    <Page>
      <View style={styles.form}>
        <Text accessibilityRole="header" variant="headlineSmall">
          {cadastro ? "Criar conta" : "Acessar Alunos"}
        </Text>
        {aviso ? <Text accessibilityLiveRegion="polite">{aviso}</Text> : null}
        {cadastro ? <Text>A direção precisa autorizar sua conta para acessar os alunos.</Text> : null}
        <TextInput
          label="E-mail"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          disabled={enviando}
        />
        <TextInput
          label="Senha"
          mode="outlined"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoComplete={cadastro ? "new-password" : "current-password"}
          disabled={enviando}
        />
        {cadastro ? (
          <TextInput
            label="Confirme a senha"
            mode="outlined"
            value={confirmacao}
            onChangeText={setConfirmacao}
            secureTextEntry
            autoComplete="new-password"
            disabled={enviando}
          />
        ) : null}
        {erro ? <HelperText type="error" accessibilityLiveRegion="polite">{erro}</HelperText> : null}
        <Button mode="contained" onPress={() => void enviar()} loading={enviando} disabled={enviando}>
          {cadastro ? "Criar conta" : "Entrar"}
        </Button>
        <Button onPress={mudarModo} disabled={enviando}>
          {cadastro ? "Já tenho conta" : "Criar conta"}
        </Button>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  form: { alignSelf: "center", width: "100%", maxWidth: 420, gap: 12 },
});

import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Avatar, Card, Text, useTheme } from "react-native-paper";
import { Page } from "../../components/Page";
import { integrantes } from "../../features/equipe/integrantes";

export default function Sobre() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Page>
      <View style={styles.section}>
        <Text variant="headlineMedium" accessibilityRole="header">Sobre o TrainiSee</Text>
        <Text variant="bodyLarge">
          O TrainiSee reúne o cadastro de alunos, as eletivas e o controle de frequência
          da escola. A equipe escolar pode acompanhar os vínculos entre alunos e eletivas
          e registrar a presença em cada aula.
        </Text>
      </View>
      <View style={styles.section}>
        <Text variant="titleLarge" accessibilityRole="header">Equipe</Text>
        {integrantes.map((integrante) => (
          <Card
            key={integrante.id}
            mode="outlined"
            onPress={() => router.push({ pathname: "/equipe/[id]", params: { id: integrante.id } })}
          >
            <Card.Title
              title={integrante.nome}
              subtitle={integrante.modulo}
              left={(props) => (
                <Avatar.Text
                  size={props.size}
                  label={integrante.iniciais}
                  color={colors.onPrimaryContainer}
                  style={{ backgroundColor: colors.primaryContainer }}
                />
              )}
            />
          </Card>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
});

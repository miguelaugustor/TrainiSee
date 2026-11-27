import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Avatar, Button, Card, Text, useTheme } from "react-native-paper";
import { Page } from "../../components/Page";

export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Page>
      <View style={[styles.hero, { backgroundColor: colors.primaryContainer }]}>
        <Text variant="headlineLarge" accessibilityRole="header" style={{ color: colors.onPrimaryContainer }}>
          TrainiSee
        </Text>
        <Text variant="bodyLarge" style={{ color: colors.onPrimaryContainer }}>
          Organize eletivas, acompanhe matrículas e registre a frequência dos alunos.
        </Text>
        <Button mode="contained" icon="book-open-variant" onPress={() => router.push("/eletivas")} style={styles.heroAction}>
          Ver eletivas
        </Button>
      </View>
      <View style={styles.section}>
        <Text variant="titleLarge" accessibilityRole="header">Acesso rápido</Text>
        <Card mode="outlined" onPress={() => router.push({ pathname: "/alunos", params: { secao: "alunos" } })}>
          <Card.Title
            title="Alunos"
            subtitle="Consultar e gerenciar cadastros"
            left={(props) => <CardIcon icon="account-group-outline" size={props.size} />}
          />
        </Card>
        <Card mode="outlined" onPress={() => router.push({ pathname: "/alunos", params: { secao: "professores" } })}>
          <Card.Title
            title="Professores"
            subtitle="Consultar e gerenciar cadastros"
            left={(props) => <CardIcon icon="account-tie-outline" size={props.size} />}
          />
        </Card>
        <Card mode="outlined" onPress={() => router.push("/sobre")}>
          <Card.Title
            title="Sobre o TrainiSee"
            subtitle="Conheça o projeto e a equipe"
            left={(props) => <CardIcon icon="information-outline" size={props.size} />}
          />
        </Card>
      </View>
    </Page>
  );
}

function CardIcon({ icon, size }: { icon: string; size: number }) {
  const { colors } = useTheme();

  return <Avatar.Icon icon={icon} size={size} color={colors.onSecondaryContainer} style={{ backgroundColor: colors.secondaryContainer }} />;
}

const styles = StyleSheet.create({
  hero: { padding: 24, borderRadius: 24, gap: 12 },
  heroAction: { alignSelf: "flex-start", marginTop: 4 },
  section: { gap: 12 },
});

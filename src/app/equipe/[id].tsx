import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Avatar, Button, List, Text, useTheme } from "react-native-paper";
import { Page } from "../../components/Page";
import { integrantes } from "../../features/equipe/integrantes";

export default function PerfilEquipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const integrante = integrantes.find((item) => item.id === id);

  return (
    <>
      <Stack.Screen options={{
        title: "Equipe",
        headerShown: true,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
      }} />
      <Page>
        {integrante ? (
          <>
            <View style={[styles.profile, { backgroundColor: colors.primaryContainer }]}>
              <Avatar.Text label={integrante.iniciais} size={64} />
              <Text variant="headlineMedium" accessibilityRole="header" style={{ color: colors.onPrimaryContainer }}>
                {integrante.nome}
              </Text>
              <Text variant="bodyLarge" style={{ color: colors.onPrimaryContainer }}>{integrante.modulo}</Text>
            </View>
            <View>
              <Text variant="titleLarge" accessibilityRole="header">Responsabilidades</Text>
              {integrante.tarefas.map((tarefa) => (
                <List.Item
                  key={tarefa}
                  title={tarefa}
                  titleNumberOfLines={2}
                  left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text variant="headlineSmall" accessibilityRole="header">Perfil indisponível</Text>
            <Button mode="contained" onPress={() => router.replace("/sobre")}>Ver equipe</Button>
          </>
        )}
      </Page>
    </>
  );
}

const styles = StyleSheet.create({
  profile: { padding: 24, borderRadius: 24, gap: 10 },
});

import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";
import { SessaoEscolarProvider } from "../features/escola/AcessoEscolar";
import { theme } from "../theme";

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <SessaoEscolarProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SessaoEscolarProvider>
    </PaperProvider>
  );
}

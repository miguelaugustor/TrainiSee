import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export function Page({ children }: PropsWithChildren) {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: "center", width: "100%", maxWidth: 720, padding: 20, gap: 24 },
});

import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { ColorValue } from "react-native";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const icon = (name: IconName) => {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={name} color={color as string} size={size} />
  );
  return TabIcon;
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#fff",
        tabBarActiveTintColor: theme.colors.primary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen
        name="eletivas"
        options={{ title: "Eletivas", tabBarIcon: icon("book-open-variant") }}
      />
      <Tabs.Screen
        name="alunos"
        options={{ title: "Alunos", tabBarIcon: icon("account-group") }}
      />
      <Tabs.Screen name="sobre" options={{ title: "Sobre", tabBarIcon: icon("information") }} />
    </Tabs>
  );
}
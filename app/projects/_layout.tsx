import { Stack } from "expo-router";

export default function ProjectsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edyson-pos" />
      <Stack.Screen name="three-sekawan" />
    </Stack>
  );
}

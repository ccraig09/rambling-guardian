import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(
  outlineName: IoniconName,
  solidName: IoniconName,
  focused: boolean,
  color: string,
) {
  return <Ionicons name={focused ? solidName : outlineName} size={22} color={color} />;
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: theme.primary[500],
        tabBarInactiveTintColor: theme.text.muted,
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) =>
            tabIcon('home-outline', 'home', focused, color),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ focused, color }) =>
            tabIcon('radio-outline', 'radio', focused, color),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ focused, color }) =>
            tabIcon('barbell-outline', 'barbell', focused, color),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, color }) =>
            tabIcon('time-outline', 'time', focused, color),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) =>
            tabIcon('settings-outline', 'settings-sharp', focused, color),
        }}
      />
    </Tabs>
  );
}

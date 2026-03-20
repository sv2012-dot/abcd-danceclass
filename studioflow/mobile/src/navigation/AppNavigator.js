import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StudentsScreen from '../screens/StudentsScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import RecitalsScreen from '../screens/RecitalsScreen';
import RecitalDetailScreen from '../screens/RecitalDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIcon = (name, focused) => {
  const icons = { Dashboard: '🏠', Students: '👤', Schedule: '📅', Recitals: '⭐' };
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {icons[name]}
    </Text>
  );
};

const sharedTabOptions = (route) => ({
  tabBarIcon: ({ focused }) => tabIcon(route.name, focused),
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: {
    borderTopColor: colors.border,
    backgroundColor: '#fff',
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  headerStyle: { backgroundColor: colors.sidebar },
  headerTintColor: '#f0e8f8',
  headerTitleStyle: { fontWeight: '700', fontSize: 16 },
});

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => sharedTabOptions(route)}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Students" component={StudentsScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Recitals" component={RecitalsScreen} />
    </Tab.Navigator>
  );
}

function ParentTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => sharedTabOptions(route)}>
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Recitals" component={RecitalsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e1228' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={user.role === 'parent' ? ParentTabs : AdminTabs} />
            <Stack.Screen
              name="RecitalDetail"
              component={RecitalDetailScreen}
              options={{
                headerShown: true,
                title: 'Recital Details',
                headerStyle: { backgroundColor: colors.sidebar },
                headerTintColor: '#f0e8f8',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// src/AppNavigation.tsx
import React from 'react';
import { createNativeStackNavigator }   from '@react-navigation/native-stack';
import { createBottomTabNavigator }      from '@react-navigation/bottom-tabs';
import Ionicons                          from 'react-native-vector-icons/Ionicons';

import AuthLoadingScreen    from './screens/AuthLoadingScreen';
import RegisterScreen       from './screens/RegisterScreen';
import LoginScreen          from './screens/LoginScreen';
import HomeScreen           from './screens/HomeScreen';
import ReservationScreen    from './screens/ReservationScreen';
import MyReservationsScreen from './screens/MyReservationsScreen';
import ProfileScreen        from './screens/ProfileScreen';
import RankingScreen        from './screens/RankingScreen';
import MapFloorScreen       from './screens/MapFloorScreen';
import SummaryScreen        from './screens/SummaryScreen';
import TutorialScreen       from './screens/TutorialScreen';

export type RootStackParamList = {
  AuthLoading: undefined;
  Register:    undefined;
  Login:       undefined;
  Main:        undefined;
  Tutorial:    undefined;
};
export type HomeStackParamList = {
  HomeMain: undefined;
  Ranking:  undefined;
};
export type ReservationStackParamList = {
  ReservationMain: undefined;
  MapFloor:        { date: string; startTime: string; endTime: string };
  Summary: {
    date:      string;
    startTime: string;
    endTime:   string;
    floor:     number;
    table:     number;
    seat:      number;
  };
};
export type MainTabParamList = {
  Home:           undefined;
  Reservation:    undefined;
  MyReservations: undefined;
  Profile:        undefined;
};

const RootStack        = createNativeStackNavigator<RootStackParamList>();
const HomeStack        = createNativeStackNavigator<HomeStackParamList>();
const ReservationStack = createNativeStackNavigator<ReservationStackParamList>();
const Tab              = createBottomTabNavigator<MainTabParamList>();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Ranking"  component={RankingScreen} />
    </HomeStack.Navigator>
  );
}

function ReservationStackScreen() {
  return (
    <ReservationStack.Navigator screenOptions={{ headerShown: false }}>
      <ReservationStack.Screen name="ReservationMain" component={ReservationScreen} />
      <ReservationStack.Screen name="MapFloor"         component={MapFloorScreen} />
      <ReservationStack.Screen name="Summary"          component={SummaryScreen} />
    </ReservationStack.Navigator>
  );
}

function MainTabScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   '#0074D9',
        tabBarInactiveTintColor: '#ccc',
        tabBarStyle:             { backgroundColor: '#001f3f' },
        tabBarIcon: ({ color, size }) => {
          let iconName: string;
          switch (route.name) {
            case 'Home':
              iconName = 'home-outline';
              break;
            case 'Reservation':
              iconName = 'calendar-outline';
              break;
            case 'MyReservations':
              iconName = 'list-outline';
              break;
            case 'Profile':
              iconName = 'person-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{ tabBarLabel: 'Anasayfa' }}
      />
      <Tab.Screen
        name="Reservation"
        component={ReservationStackScreen}
        options={{ tabBarLabel: 'Rezervasyon' }}
      />
      <Tab.Screen
        name="MyReservations"
        component={MyReservationsScreen}
        options={{ tabBarLabel: 'Rezervasyonlarım' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigation() {
  return (
        <RootStack.Navigator
      initialRouteName="Tutorial"      // ← add this
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="AuthLoading" component={AuthLoadingScreen} />
      <RootStack.Screen name="Register"    component={RegisterScreen} />
      <RootStack.Screen name="Login"       component={LoginScreen} />
      <RootStack.Screen name="Tutorial"    component={TutorialScreen} />
      <RootStack.Screen name="Main"        component={MainTabScreen} />
    </RootStack.Navigator>
  );
}
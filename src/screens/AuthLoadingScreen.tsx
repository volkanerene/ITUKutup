// src/screens/AuthLoadingScreen.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../AppNavigation';

type AuthLoadingNavProp = StackNavigationProp<RootStackParamList, 'AuthLoading'>;

export default function AuthLoadingScreen() {
  const navigation = useNavigation<AuthLoadingNavProp>();

  useEffect(() => {
    const bootstrapAsync = async () => {
      const userToken = await AsyncStorage.getItem('userId');
      // Token varsa anasayfaya, yoksa giriş ekranına
      navigation.replace(userToken ? 'Main' : 'Login');
    };
    bootstrapAsync();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
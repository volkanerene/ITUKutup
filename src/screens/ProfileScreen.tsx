// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CompositeNavigationProp,
  useNavigation
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from '../AppNavigation';
import { fetchUserProfile, fetchUserScore, User } from '../api/api';

type ProfileNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavProp>();
  const [profile, setProfile] = useState<User|null>(null);
  const [score, setScore] = useState<number|null>(null);

  const loadProfile = async () => {
    const userIdStr = await AsyncStorage.getItem('userId');
    if (!userIdStr) return;
    const userId = parseInt(userIdStr, 10);
    try {
      const u = await fetchUserProfile(userId);
      setProfile(u);
      const s = await fetchUserScore(userId);
      setScore(s);
    } catch {
      Alert.alert('Hata', 'Profil yüklenemedi.');
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadProfile);
    return unsub;
  }, [navigation]);

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Emin misiniz?',
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            await AsyncStorage.multiRemove(['userId']);
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil & Ayarlar</Text>
      <View style={styles.infoCard}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email ?? '—'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.label}>Öğrenci No</Text>
        <Text style={styles.value}>{profile?.studentId ?? '—'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.label}>Puan</Text>
        <Text style={styles.value}>{score != null ? score : '—'}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.logoutBtn]}
        onPress={handleLogout}
      >
        <Text style={[styles.buttonText, { color: '#FF4136' }]}>
          Çıkış Yap
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#001f3f', padding: 16, paddingTop: 60 },
  title:      { fontSize: 22, color: '#fff', fontWeight: '600', marginBottom: 24, textAlign: 'center' },
  infoCard:   { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 16 },
  label:      { fontSize: 14, color: '#555' },
  value:      { fontSize: 18, marginTop: 4 },
  button:     { padding: 12, borderRadius: 8, alignItems: 'center' },
  logoutBtn:  { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FF4136' },
  buttonText: { fontSize: 16, fontWeight: '600' }
});
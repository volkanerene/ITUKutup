import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions,useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList }         from '../AppNavigation'


import { registerUser, fetchUserProfile, fetchUserScore } from '../api/api';

/**
 * -------------------------------------------------------------
 * 📌  Navigation types
 * -------------------------------------------------------------
 */
type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Tutorial: undefined;
  Main: undefined;
};

type RegisterNavProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;
type RootNavProp = NativeStackNavigationProp<RootStackParamList>

/**
 * -------------------------------------------------------------
 * 📌  Component
 * -------------------------------------------------------------
 */
export default function RegisterScreen() {
  const navigation = useNavigation<RootNavProp>()

  // ── form state ───────────────────────────────────────────────
  const [email, setEmail]               = useState('');
  const [studentId, setStudentId]       = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── ui state ────────────────────────────────────────────────
  const [showPassword, setShowPassword]             = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms]           = useState(false);
  const [loading, setLoading]                       = useState(false);

  /**
   * -----------------------------------------------------------
   * 🔐  Validation helpers
   * -----------------------------------------------------------
   */
  const validateForm = (): boolean => {
    // email
    if (!email.trim()) {
      Alert.alert('Hata', 'E-posta adresinizi girin.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return false;
    }

    // student ID
    if (!studentId.trim()) {
      Alert.alert('Hata', 'Öğrenci numaranızı girin.');
      return false;
    }
    // 9 haneli sayı kontrolü
    if (!/^\d{9}$/.test(studentId.trim())) {
      Alert.alert('Hata', 'Öğrenci numarası 9 haneli olmalıdır.');
      return false;
    }

    // password
    if (!password) {
      Alert.alert('Hata', 'Şifrenizi girin.');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalıdır.');
      return false;
    }
    const hasUpper   = /[A-Z]/.test(password);
    const hasLower   = /[a-z]/.test(password);
    const hasNumber  = /\d/.test(password);
    if (!hasUpper || !hasLower || !hasNumber) {
      Alert.alert('Zayıf Şifre', 'Şifreniz en az bir büyük harf, küçük harf ve rakam içermelidir.');
      return false;
    }

    // confirm
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return false;
    }

    // terms
    if (!agreedToTerms) {
      Alert.alert('Hata', 'Kullanım şartlarını kabul etmelisiniz.');
      return false;
    }

    return true;
  };

  /**
   * -----------------------------------------------------------
   * 📨  Registration handler
   * -----------------------------------------------------------
   */
  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 1️⃣ Backend call
      const user = await registerUser(email.trim(), password, studentId.trim());

      // 2️⃣ Persist minimal session
      await AsyncStorage.multiSet([
        ['userId',    String(user.id)],
        ['userEmail', String(user.email)],
        ['studentId', String(user.studentId)]
      ]);

      // 3️⃣ Pre-fetch profile / score (best-effort)
      try {
        const [profile, score] = await Promise.all([
          fetchUserProfile(user.id),
          fetchUserScore(user.id)
        ]);
        await AsyncStorage.multiSet([
          ['userProfile', JSON.stringify(profile)],
          ['userScore',   String(score)]
        ]);
      } catch (err) {
        console.warn('Could not preload profile/score', err);
      }

      // 4️⃣ Success → jump to tutorial flow with navigation reset
      Alert.alert(
        'Kayıt Başarılı',
        `Hoş geldin, ${user.studentId}! Şimdi uygulamayı tanıyalım.`,
        [{
          text: 'Tamam',
  onPress: () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Tutorial' }],
      })
    )
  }
        }]
      );
    } catch (err: any) {
      let msg = 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.';
      if (typeof err?.message === 'string') {
        if (err.message.includes('already exists') || err.message.includes('409')) {
          msg = 'Bu e-posta adresi veya öğrenci numarası zaten kullanılıyor.';
        } else if (err.message.includes('network')) {
          msg = 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
        } else if (err.message.includes('400')) {
          msg = 'Girilen bilgiler geçersiz. Lütfen kontrol edin.';
        }
      }
      Alert.alert('Kayıt Hatası', msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * -----------------------------------------------------------
   * 🔑  Password strength helper (UI only)
   * -----------------------------------------------------------
   */
  const getPasswordStrength = () => {
    if (!password) return { label: '', color: '#ccc', score: 0 } as const;
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ];
    const score = checks.filter(Boolean).length;

    const map = [
      { label: 'Çok Zayıf', color: '#FF4136' },
      { label: 'Zayıf',     color: '#FF851B' },
      { label: 'Orta',      color: '#FFDC00' },
      { label: 'Güçlü',     color: '#2ECC40' },
      { label: 'Çok Güçlü', color: '#01FF70' }
    ];

    return { ...map[Math.max(0, score - 1)], score } as const;
  };

  const passwordStrength = getPasswordStrength();

  /**
   * -----------------------------------------------------------
   * 🎲  Sample student-id helper (dev UX)
   * -----------------------------------------------------------
   */
  const generateSampleStudentId = () => {
    // 9 haneli rastgele öğrenci numarası üret
    const firstDigit = Math.floor(Math.random() * 2) + 1; // 1 veya 2
    const middleDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    const lastDigit = Math.floor(Math.random() * 10);
    const id = `${firstDigit}${middleDigits}${lastDigit}`;

    Alert.alert(
      'Örnek Öğrenci Numarası', 
      `${id}\n\nFormat: 9 haneli sayı`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kullan', onPress: () => setStudentId(id) }
      ]
    );
  };

  /**
   * -----------------------------------------------------------
   * 🖼  Render
   * -----------------------------------------------------------
   */
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="person-add" size={64} color="#0074D9" />
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>Kütüphane Rezervasyon Sistemi</Text>
        </View>

        {/* ── Form ────────────────────────────────────────────── */}
        <View style={styles.form}>
          {/* e-mail */}
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="E-posta adresiniz"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* student id */}
          <View style={styles.inputWrap}>
            <Ionicons name="school-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Öğrenci numaranız (9 haneli)"
              value={studentId}
              onChangeText={setStudentId}
              keyboardType="numeric"
              maxLength={9}
              editable={!loading}
            />
            <TouchableOpacity onPress={generateSampleStudentId}>
              <Ionicons name="help-circle-outline" size={20} color="#0074D9" />
            </TouchableOpacity>
          </View>

          {/* password */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Şifreniz (en az 8)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* strength bar */}
          {password !== '' && (
            <View style={styles.strengthRow}>
              <View style={styles.strengthBar}>
                <View
                  style={{
                    height: 4,
                    width: `${(passwordStrength.score / 5) * 100}%`,
                    backgroundColor: passwordStrength.color,
                    borderRadius: 2
                  }}
                />
              </View>
              <Text style={{ color: passwordStrength.color, fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                {passwordStrength.label}
              </Text>
            </View>
          )}

          {/* confirm password */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* confirm icon */}
          {confirmPassword !== '' && (
            <View style={styles.matchRow}>
              <Ionicons
                name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={password === confirmPassword ? '#2ECC40' : '#FF4136'}
              />
              <Text style={{ marginLeft: 6, fontSize: 12, color: password === confirmPassword ? '#2ECC40' : '#FF4136' }}>
                {password === confirmPassword ? 'Şifreler eşleşiyor' : 'Şifreler eşleşmiyor'}
              </Text>
            </View>
          )}

          {/* terms */}
          <TouchableOpacity style={styles.termsRow} onPress={() => setAgreedToTerms(!agreedToTerms)} disabled={loading}>
            <Ionicons name={agreedToTerms ? 'checkbox' : 'checkbox-outline'} size={20} color="#0074D9" />
            <Text style={styles.termsTxt}>
              <Text style={styles.link}>Kullanım Şartları</Text> ve{' '}
              <Text style={styles.link}>Gizlilik Politikası</Text>'nı okudum ve kabul ediyorum
            </Text>
          </TouchableOpacity>

          {/* submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { backgroundColor: '#999' }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Hesap Oluştur</Text>}
          </TouchableOpacity>

          {/* login link */}
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
            <Text style={styles.loginTxt}>
              Zaten hesabın var mı? <Text style={styles.loginBold}>Giriş Yap</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* footer */}
        <Text style={styles.footer}>Hesap oluşturarak tüm özelliklerden yararlanabilirsin.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * -------------------------------------------------------------
 * 🎨  Styles
 * -------------------------------------------------------------
 */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001f3f', paddingTop: 40 },
  scroll:    { padding: 20, paddingTop: 40 },

  /* header */
  header:   { alignItems: 'center', marginBottom: 32, position: 'relative' },
  backBtn:  { position: 'absolute', left: 0, top: 0, padding: 8 },
  title:    { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  subtitle: { color: '#ccc', fontSize: 16, marginTop: 4 },

  /* form */
  form:       { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 4 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, backgroundColor: '#f9f9f9' },
  icon:       { marginRight: 12 },
  input:      { flex: 1, height: 50, fontSize: 16, color: '#333' },

  strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  strengthBar: { flex: 1, height: 4, backgroundColor: '#eee', borderRadius: 2 },

  matchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  termsTxt: { flex: 1, fontSize: 14, color: '#666', marginLeft: 12, lineHeight: 20 },
  link:     { color: '#0074D9', fontWeight: '500' },

  submitBtn: { backgroundColor: '#0074D9', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  submitTxt: { color: '#fff', fontSize: 18, fontWeight: '600' },

  loginTxt:  { textAlign: 'center', fontSize: 16, color: '#666' },
  loginBold: { color: '#0074D9', fontWeight: '600' },

  footer:  { marginTop: 24, fontSize: 12, color: '#ccc', textAlign: 'center', lineHeight: 18 }
});
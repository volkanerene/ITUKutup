// src/screens/LoginScreen.tsx
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { loginUser, fetchUserProfile, fetchUserScore } from '../api/api';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

type LoginNavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved credentials on component mount
  React.useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const shouldRemember = await AsyncStorage.getItem('rememberMe');
      
      if (savedEmail && shouldRemember === 'true') {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.warn('Could not load saved credentials:', error);
    }
  };

  const validateForm = () => {
    if (!email.trim()) {
      Alert.alert('Hata', 'E-posta adresinizi girin.');
      return false;
    }

    if (!email.includes('@')) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return false;
    }

    if (!password.trim()) {
      Alert.alert('Hata', 'Şifrenizi girin.');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Attempt login
      const user = await loginUser(email.trim(), password);
      
      // Store user data
      await AsyncStorage.setItem('userId', user.id.toString());
      await AsyncStorage.setItem('userEmail', user.email);
      await AsyncStorage.setItem('studentId', user.studentId != null
      ? String(user.studentId)
      : '');
      
      // Save credentials if remember me is checked
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email.trim());
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await AsyncStorage.removeItem('savedEmail');
        await AsyncStorage.removeItem('rememberMe');
      }
      
      // Fetch additional user data
      try {
        const [userProfile, userScore] = await Promise.all([
          fetchUserProfile(user.id),
          fetchUserScore(user.id)
        ]);
        
        // Store additional data for offline use
        await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
        await AsyncStorage.setItem('userScore', userScore.toString());
      } catch (profileError) {
        console.warn('Could not fetch additional user data:', profileError);
        // Continue with login even if additional data fails
      }

      // Show success message
      Alert.alert(
        'Giriş Başarılı', 
        `Hoş geldin, ${user.studentId}!`, 
        [
          {
            text: 'Tamam',
            onPress: () => navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            })
          }
        ]
      );

    } catch (error: any) {
      let errorMessage = 'Giriş yapılamadı. Lütfen tekrar deneyin.';
      
      if (error.message) {
        if (error.message.includes('404') || error.message.includes('401')) {
          errorMessage = 'E-posta veya şifre hatalı.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Giriş Hatası', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('E-posta Gerekli', 'Şifremi unuttum özelliği için önce e-posta adresinizi girin.');
      return;
    }

    Alert.alert(
      'Şifremi Unuttum',
      `${email} adresine şifre sıfırlama bağlantısı gönderilecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Gönder', 
          onPress: () => {
            // In a real app, this would call a password reset API
            Alert.alert('Bilgi', 'Şifre sıfırlama özelliği yakında aktif olacak.');
          }
        }
      ]
    );
  };

  const fillDemoCredentials = () => {
    setEmail('volkan@gmail.com');
    setPassword('volkaneren1');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="library" size={64} color="#0074D9" />
            <Text style={styles.appTitle}>ITU Kütüphane Rezervasyon</Text>
            <Text style={styles.appSubtitle}>Akıllı Rezervasyon Sistemi</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Giriş Yap</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="E-posta adresiniz"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="Şifreniz"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <Ionicons
                name={rememberMe ? "checkbox" : "checkbox-outline"}
                size={20}
                color="#0074D9"
              />
              <Text style={styles.checkboxText}>Beni Hatırla</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPassword}>Şifremi Unuttum</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.demoButton}
            onPress={fillDemoCredentials}
            disabled={loading}
          >
            <Ionicons name="flash-outline" size={20} color="#FF851B" />
            <Text style={styles.demoButtonText}>Demo Verilerini Kullan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={styles.registerText}>
              Hesabın yok mu? <Text style={styles.registerTextBold}>Kaydol</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Giriş yaparak Kullanım Şartları'nı ve Gizlilik Politikası'nı kabul etmiş olursunuz.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001f3f'
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 40
  },
  logoContainer: {
    alignItems: 'center'
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center'
  },
  appSubtitle: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center'
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#001f3f',
    textAlign: 'center',
    marginBottom: 24
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9'
  },
  inputIcon: {
    marginRight: 12
  },
  textInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333'
  },
  eyeIcon: {
    padding: 4
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkboxText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666'
  },
  forgotPassword: {
    fontSize: 14,
    color: '#0074D9',
    fontWeight: '500'
  },
  loginButton: {
    backgroundColor: '#0074D9',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc'
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd'
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666'
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF851B',
    height: 50,
    borderRadius: 12,
    marginBottom: 16
  },
  demoButtonText: {
    color: '#FF851B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 12
  },
  registerText: {
    fontSize: 16,
    color: '#666'
  },
  registerTextBold: {
    color: '#0074D9',
    fontWeight: '600'
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 20
  },
  footerText: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 18
  }
});
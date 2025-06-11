// src/screens/TutorialScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  RootStackParamList,
  MainTabParamList
} from '../AppNavigation';

type TutorialNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList, 'Tutorial'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const { width, height } = Dimensions.get('window');

const slides = [
  {
    title: 'Hoş Geldiniz!',
    text: 'ITU Mustafa İnan Kütüphane rezervasyon uygulamasına hoş geldiniz. Basit birkaç adımda sandalye ayırtabilirsiniz.',
    animation: require('../assets/welcome.json'),
    bgColor: '#001f3f',
    accentColor: '#0074D9'
  },
  {
    title: 'Rezervasyon Yap',
    text: 'Ana sayfadan "Rezervasyon Yap" butonuna dokunun, tarih ve saat seçin. Sistem size en uygun zamanları önerecek.',
    animation: require('../assets/calendar.json'),
    bgColor: '#2ECC40',
    accentColor: '#27AE60'
  },
  {
    title: 'Sandalyenizi Seçin',
    text: 'Kat planından uygun sandalyeyi seçin. Yeşil sandalyeler müsait, kırmızılar dolu, turuncular beklemede.',
    animation: require('../assets/map.json'),
    bgColor: '#FF851B',
    accentColor: '#E67E22'
  },
  {
    title: 'Onayla',
    text: 'Seçiminizi gözden geçirin ve "Rezervasyonu Tamamla" ile işlemi tamamlayın. Bildirim alacaksınız.',
    animation: require('../assets/confirm.json'),
    bgColor: '#9B59B6',
    accentColor: '#8E44AD'
  },
  {
    title: 'Takip Edin',
    text: 'Rezervasyonlarım ekranında aktif ve geçmiş rezervasyonlarınızı görebilir, puanlarınızı takip edebilirsiniz.',
    animation: require('../assets/takip.json'),
    bgColor: '#E74C3C',
    accentColor: '#C0392B'
  }
];

export default function TutorialScreen() {
  const navigation = useNavigation<TutorialNavProp>();
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Check authentication and tutorial status
  useEffect(() => {
    const checkAuthAndTutorial = async () => {
      try {
        const uid = await AsyncStorage.getItem('userId');
        if (!uid) {
          // Not logged in, redirect to login
          navigation.replace('Login');
          return;
        }
        
        const seen = await AsyncStorage.getItem('tutorialSeen');
        if (seen === 'true') {
          // Tutorial already seen, go to main
          navigation.replace('Main');
          return;
        }
        
        // All good, show tutorial
        setLoading(false);
      } catch (error) {
        console.error('Error checking auth/tutorial status:', error);
        navigation.replace('Login');
      }
    };

    checkAuthAndTutorial();
  }, [navigation]);

  const onNext = async () => {
    if (page < slides.length - 1) {
      const next = page + 1;
      setPage(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      // Mark tutorial as seen and navigate to main
      try {
        await AsyncStorage.setItem('tutorialSeen', 'true');
        navigation.replace('Main');
      } catch (error) {
        console.error('Error saving tutorial status:', error);
        navigation.replace('Main');
      }
    }
  };

  const onPrevious = () => {
    if (page > 0) {
      const prev = page - 1;
      setPage(prev);
      scrollRef.current?.scrollTo({ x: prev * width, animated: true });
    }
  };

  const onSkip = async () => {
    Alert.alert(
      'Eğitimi Atla',
      'Eğitimi atlamak istediğinize emin misiniz? Daha sonra ayarlardan tekrar görebilirsiniz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Atla',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.setItem('tutorialSeen', 'true');
              navigation.replace('Main');
            } catch (error) {
              console.error('Error saving tutorial status:', error);
              navigation.replace('Main');
            }
          }
        }
      ]
    );
  };

  const goToPage = (pageIndex: number) => {
    setPage(pageIndex);
    scrollRef.current?.scrollTo({ x: pageIndex * width, animated: true });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" backgroundColor="#001f3f" />
        <LottieView
          source={require('../assets/welcome.json')}
          autoPlay
          loop
          style={styles.loadingAnimation}
        />
        <Text style={styles.loadingText}>Hazırlanıyor...</Text>
      </SafeAreaView>
    );
  }

  const currentSlide = slides[page];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentSlide.bgColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={currentSlide.bgColor} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Ionicons name="library" size={32} color="#fff" />
          <Text style={styles.appName}>Kütüphane</Text>
        </View>
        
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(idx);
        }}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width, backgroundColor: slide.bgColor }]}>
            <View style={styles.animationContainer}>
              <LottieView
                source={slide.animation}
                autoPlay
                loop={false}
                style={styles.animation}
                speed={0.8}
              />
            </View>
            
            <View style={styles.contentContainer}>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideText}>{slide.text}</Text>
              
              {/* Features List */}
              {index === 0 && (
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#2ECC40" />
                    <Text style={styles.featureText}>Kolay rezervasyon</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#2ECC40" />
                    <Text style={styles.featureText}>Gerçek zamanlı doluluk</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#2ECC40" />
                    <Text style={styles.featureText}>Puan sistemi</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Page Indicators */}
      <View style={styles.pageIndicators}>
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.pageIndicator,
              page === index && styles.activePageIndicator
            ]}
            onPress={() => goToPage(index)}
          />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navButton, page === 0 && styles.disabledButton]}
          onPress={onPrevious}
          disabled={page === 0}
        >
          <Ionicons 
            name="chevron-back" 
            size={24} 
            color={page === 0 ? '#666' : '#fff'} 
          />
          <Text style={[styles.navButtonText, page === 0 && styles.disabledText]}>
            Geri
          </Text>
        </TouchableOpacity>

        <View style={styles.pageCounter}>
          <Text style={styles.pageCounterText}>
            {page + 1} / {slides.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={onNext}>
          <Text style={styles.nextButtonText}>
            {page === slides.length - 1 ? 'Başla' : 'İleri'}
          </Text>
          <Ionicons 
            name={page === slides.length - 1 ? "checkmark" : "chevron-forward"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#001f3f'
  },
  loadingAnimation: {
    width: 150,
    height: 150
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '500'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  appName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8
  },
  placeholder: {
    width: 60
  },
  scrollView: {
    flex: 1
  },
  slide: {
    flex: 1,
    paddingHorizontal: 30,
    paddingVertical: 20
  },
  animationContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  animation: {
    width: Math.min(width * 0.8, 300),
    height: Math.min(width * 0.8, 300)
  },
  contentContainer: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  slideTitle: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center'
  },
  slideText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10
  },
  featuresList: {
    marginTop: 24,
    alignSelf: 'stretch'
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500'
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4
  },
  activePageIndicator: {
    backgroundColor: '#fff',
    width: 24,
    height: 8,
    borderRadius: 4
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 80,
    justifyContent: 'center'
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4
  },
  disabledText: {
    color: '#666'
  },
  pageCounter: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  pageCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#fff',
    minWidth: 100,
    justifyContent: 'center'
  },
  nextButtonText: {
    color: '#001f3f',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4
  }
});
// src/screens/SummaryScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useNavigation,
  useRoute,
  RouteProp,
  CompositeNavigationProp
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  ReservationStackParamList,
  MainTabParamList
} from '../AppNavigation';
import { createReservation } from '../api/api';

type SummaryNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ReservationStackParamList, 'Summary'>,
  BottomTabNavigationProp<MainTabParamList>
>;

type SummaryRouteProp = RouteProp<ReservationStackParamList, 'Summary'>;

export default function SummaryScreen() {
  const navigation = useNavigation<SummaryNavProp>();
  const route = useRoute<SummaryRouteProp>();
  const { date, startTime, endTime, floor, table, seat } = route.params;
  const [loading, setLoading] = useState(false);

  /**
   * Yerel zamanı "yyyy-MM-dd'T'HH:mm:ss" formatında döndürür
   * (milisaniye ve 'Z' yok).
   */
  const buildIso = (
    y: number,
    m: number,
    d: number,
    hh: number,
    mm: number
  ): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
  };

  /**
   * Sends the reservation payload to the backend and handles UI feedback.
   */
  const confirm = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);

    // ➡️ We declare the payload in the outer scope so it is visible in `catch`.
    let payload: {
      userId: number;
      roomId: string;
      deskId: string;
      startTime: string;
      endTime: string;
    } | null = null;

    try {
      const idStr = await AsyncStorage.getItem('userId');
      if (!idStr) throw new Error('Giriş yapmış kullanıcı bulunamadı. Lütfen tekrar giriş yapın.');

      const userId = parseInt(idStr, 10);
      const [year, month, day] = date.split('-').map(Number);
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);

      // Gece yarısını geçtiyse (end ≤ start)
      let startDate = new Date(year, month - 1, day, sh, sm);
      let endDate = new Date(year, month - 1, day, eh, em);
      
      // Eğer bitiş saati başlangıçtan küçük veya eşitse, ertesi güne geçiyoruz
      if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }

      // API'nin beklediği format: "2025-05-26T12:30:00" (milisaniye ve 'Z' yok)
      const startIso = buildIso(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        startDate.getDate(),
        startDate.getHours(),
        startDate.getMinutes()
      );
      
      const endIso = buildIso(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        endDate.getDate(),
        endDate.getHours(),
        endDate.getMinutes()
      );

      payload = {
        userId: userId,
        roomId: 'ROOM-001',
        deskId: `${table}-${seat}`,
        startTime: startIso,
        endTime: endIso
      };

      console.log('🚀 Creating reservation →', payload);

      const created = await createReservation(payload);

      Alert.alert(
        'Rezervasyon Başarılı! 🎉',
        `Rezervasyonunuz oluşturuldu.\n\n` +
          `📅 ${formatDateTime()}\n` +
          `⏰ ${startTime} – ${endTime}\n` +
          `🏢 Kat: ${floor}\n` +
          `🪑 Masa ${table}, Sandalye ${seat}\n` +
          `📝 Rezervasyon ID: #${created.id}`,
        [
          { text: 'Rezervasyonlarımı Gör', onPress: () => navigation.getParent()?.navigate('MyReservations') },
          { text: 'Ana Sayfa', onPress: () => navigation.getParent()?.navigate('Home') }
        ]
      );
    } catch (err: any) {
      // -------------------- ERROR HANDLING -------------------- //
      console.error('❌ Reservation failed', err, payload);

      const parsed = parseError(err);

      Alert.alert(parsed.title, `${parsed.message}\n\n${parsed.debug}`, [
        {
          text: 'Debug Bilgisi',
          onPress: () => showDebugInfo(payload, err)
        },
        {
          text: 'Tekrar Dene',
          onPress: confirm
        },
        {
          text: 'Geri Dön',
          style: 'cancel',
          onPress: () => navigation.goBack()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Maps common backend / network errors to human-friendly titles & messages.
   */
  const parseError = (error: any): { title: string; message: string; debug: string } => {
    const raw = `${error?.message || ''}`.toLowerCase();
    let title = 'Hata';
    let message = 'Rezervasyon oluşturulamadı.';

    if (raw.includes('400') || raw.includes('bad request')) {
      title = 'Geçersiz Bilgi';
      message = 'Gönderilen rezervasyon verileri geçersiz görünüyor.';
    } else if (raw.includes('409') || raw.includes('conflict')) {
      title = 'Çakışma';
      message = 'Bu zaman aralığı için başka bir rezervasyon mevcut.';
    } else if (raw.includes('401') || raw.includes('403')) {
      title = 'Yetki Hatası';
      message = 'Lütfen oturum açtığınızdan emin olun.';
    } else if (raw.includes('network') || raw.includes('bağlantı')) {
      title = 'Bağlantı Hatası';
      message = 'İnternet bağlantınızı kontrol edin.';
    } else if (raw.includes('500') || raw.includes('sunucu')) {
      title = 'Sunucu Hatası';
      message = 'Sunucuda bir sorun oluştu. Daha sonra tekrar deneyin.';
    }

    return { title, message, debug: error?.message || '' };
  };

  /**
   * Developer-friendly debug dialog.
   */
  const showDebugInfo = (pl: any, err: any) => {
    Alert.alert(
      'Debug Bilgisi',
      JSON.stringify({ payload: pl, error: err }, null, 2),
      [{ text: 'Tamam' }]
    );
  };

  // -------------------------- Helpers -------------------------- //
  const formatDateTime = () => {
    try {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  };

  const calculateDuration = () => {
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      let start = sh * 60 + sm;
      let end = eh * 60 + em;
      if (end <= start) end += 1440; // wrap
      const mins = end - start;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m === 0 ? `${h} saat` : `${h} saat ${m} dk`;
    } catch {
      return 'Bilinmiyor';
    }
  };

  // --------------------------- UI --------------------------- //
  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Rezervasyon Özeti</Text>
      </View>

      {/* content */}
      <View style={styles.content}>
        <Ionicons name="checkmark-circle" size={80} color="#2ECC40" style={{ alignSelf: 'center', marginVertical: 20 }} />
        <Text style={styles.subtitle}>Rezervasyon Detayları</Text>

        {/* details card */}
        <View style={styles.card}>
          {/** Tarih */}
          <DetailRow icon="calendar" label="Tarih" value={formatDateTime()} />
          {/** Saat */}
          <DetailRow icon="time" label="Saat" value={`${startTime} – ${endTime}`} sub={calculateDuration()} />
          {/** Kat */}
          <DetailRow icon="business" label="Kat" value={`${floor}. Kat`} />
          {/** Masa */}
          <DetailRow icon="restaurant" label="Masa & Sandalye" value={`Masa ${table}, Sandalye ${seat}`} />
        </View>
      </View>

      {/* footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, styles.cancel]}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelTxt}>Değiştir</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.confirm, loading && styles.disabledBtn]}
          onPress={confirm}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.confirmTxt}>Rezervasyonu Tamamla</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------------------- Small Components ---------------------- */
interface DRProps { icon: string; label: string; value: string; sub?: string; }
const DetailRow: React.FC<DRProps> = ({ icon, label, value, sub }) => (
  <View style={dStyles.row}>
    <Ionicons name={icon as any} size={20} color="#0074D9" />
    <View style={{ flex: 1, marginLeft: 16 }}>
      <Text style={dStyles.label}>{label}</Text>
      <Text style={dStyles.val}>{value}</Text>
      {sub && <Text style={dStyles.sub}>{sub}</Text>}
    </View>
  </View>
);

/* --------------------------- Styles --------------------------- */
const baseText = { color: '#fff' } as const;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#001f3f' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  back: { padding: 8, marginRight: 16 },
  title: { ...baseText, fontSize: 22, fontWeight: '600', flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  subtitle: { ...baseText, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 30, gap: 12 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  cancel: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#fff' },
  confirm: { backgroundColor: '#2ECC40' },
  disabledBtn: { backgroundColor: '#666' },
  cancelTxt: { ...baseText, fontSize: 16, fontWeight: '600' },
  confirmTxt: { ...baseText, fontSize: 16, fontWeight: '600', marginLeft: 8 }
});

const dStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  val: { fontSize: 16, fontWeight: '600', color: '#001f3f' },
  sub: { fontSize: 12, color: '#999', marginTop: 2 }
});
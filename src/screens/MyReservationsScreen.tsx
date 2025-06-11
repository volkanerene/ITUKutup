// src/screens/MyReservationsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { MainTabParamList } from '../AppNavigation';
import {
  fetchUserReservations,
  fetchActiveReservations,
  fetchReservationById,
  cancelReservation,
  completeReservation,
  fetchUserProfile,
  fetchUserScore,
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  scanLibraryEntryOrExit,
  Reservation,
  User,
  Notification,
} from '../api/api';

type NavProp = BottomTabNavigationProp<MainTabParamList, 'MyReservations'>;

interface UserStats {
  totalReservations: number;
  completedReservations: number;
  canceledReservations: number;
  noShowCount: number;
  currentStreak: number;
  libraryScore: number;
}

export default function MyReservationsScreen() {
  const nav = useNavigation<NavProp>();

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    totalReservations: 0,
    completedReservations: 0,
    canceledReservations: 0,
    noShowCount: 0,
    currentStreak: 0,
    libraryScore: 0
  });
  const [systemActiveCount, setSystemActiveCount] = useState(0);
  const [active, setActive] = useState<Reservation | null>(null);
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [past, setPast] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = await AsyncStorage.getItem('userId');
      if (!uid) throw new Error('Kullanıcı oturumu bulunamadı.');

      const userId = +uid;

      // Load user profile and score
      const [userProfile, userScore] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserScore(userId)
      ]);
      
      setUser(userProfile);

      // Fetch all user reservations
      const all = await fetchUserReservations(userId);
      const now = Date.now();

      const activeRes = all.find(
        (r) =>
          new Date(r.startTime).getTime() <= now &&
          now <= new Date(r.endTime).getTime()
      ) || null;

      const upcomingRes = all.filter((r) => new Date(r.startTime).getTime() > now);
      const pastRes = all.filter((r) => new Date(r.endTime).getTime() < now);

      setActive(activeRes);
      setUpcoming(upcomingRes);
      setPast(pastRes);

      // Calculate user statistics
      const completedCount = pastRes.filter(r => r.status === 'COMPLETED').length;
      const canceledCount = pastRes.filter(r => r.status === 'CANCELLED').length;
      
      setUserStats({
        totalReservations: all.length,
        completedReservations: completedCount,
        canceledReservations: canceledCount,
        noShowCount: userProfile.noShowStreak,
        currentStreak: userProfile.successfulCompletionsStreak,
        libraryScore: userScore
      });

      // Fetch total active reservations system-wide
      const sysList = await fetchActiveReservations();
      setSystemActiveCount(sysList.length);

      // Load notifications
      const userNotifications = await fetchUserNotifications(
        userId, 
        showOnlyUnread ? false : undefined
      );
      setNotifications(userNotifications);

    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [showOnlyUnread]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onPressReservation = async (r: Reservation) => {
    try {
      const full = await fetchReservationById(r.id);
      Alert.alert(
        `Rezervasyon #${full.id}`,
        `Durum: ${full.status}\nOluşturulma: ${new Date(
          full.createdAt!
        ).toLocaleString()}\nSon Güncelleme: ${new Date(
          full.updatedAt!
        ).toLocaleString()}`
      );
    } catch {
      Alert.alert('Hata', 'Detaylar alınamadı.');
    }
  };

  const cancelActive = () => {
    if (!active) return;
    Alert.alert('İptal Et', 'Bu rezervasyonu iptal etmek istediğine emin misin?', [
      { text: 'Hayır', style: 'cancel' },
      {
        text: 'Evet',
        onPress: async () => {
          try {
            await cancelReservation(active.id, 'User request');
            load();
            Alert.alert('Başarılı', 'Rezervasyon iptal edildi.');
          } catch {
            Alert.alert('Hata', 'İptal edilemedi.');
          }
        },
      },
    ]);
  };

  const completeActive = () => {
    if (!active) return;
    Alert.alert(
      'Tamamlandı',
      'Rezervasyonu tamamlandı olarak işaretlemek istiyor musun?',
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            try {
              await completeReservation(active.id, true);
              
              // Also scan library exit
              if (user) {
                try {
                  await scanLibraryEntryOrExit({
                    studentId: +user.studentId,
                    scanType: 'EXIT',
                    timestamp: new Date().toISOString()
                  });
                } catch (scanError) {
                  console.warn('Failed to scan library exit:', scanError);
                }
              }
              
              load();
              Alert.alert('Başarılı', 'Rezervasyon tamamlandı ve çıkış kaydedildi.');
            } catch {
              Alert.alert('Hata', 'Güncellenemedi.');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      }

      // If notification has reservationId, show reservation details
      if (notification.reservationId) {
        try {
          const reservation = await fetchReservationById(notification.reservationId);
          Alert.alert(
            'Rezervasyon Detayları',
            `Rezervasyon #${reservation.id}\nDurum: ${reservation.status}\nMasa: ${reservation.deskId}`
          );
        } catch {
          Alert.alert('Bildirim', notification.message);
        }
      } else {
        Alert.alert('Bildirim', notification.message);
      }
    } catch (error) {
      Alert.alert('Hata', 'Bildirim işlenemedi.');
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      Alert.alert('Başarılı', 'Tüm bildirimler okundu olarak işaretlendi.');
    } catch {
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

  const deleteNotificationHandler = async (notificationId: number) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch {
      Alert.alert('Hata', 'Bildirim silinemedi.');
    }
  };

  const renderReservation = (r: Reservation) => {
    const dateStr = new Date(r.startTime).toISOString().slice(0, 10);
    const startStr = new Date(r.startTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endStr = new Date(r.endTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const [table, seat] = r.deskId.split('-');

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'ACTIVE': return '#2ECC40';
        case 'COMPLETED': return '#0074D9';
        case 'CANCELLED': return '#FF4136';
        case 'NO_SHOW': return '#FF851B';
        default: return '#666';
      }
    };

    return (
      <TouchableOpacity
        key={r.id}
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => onPressReservation(r)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.line}>#{r.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(r.status) }]}>
            <Text style={styles.statusText}>{r.status}</Text>
          </View>
        </View>
        <Text style={styles.line}>Tarih: {dateStr}</Text>
        <Text style={styles.line}>Saat: {startStr} – {endStr}</Text>
        <Text style={styles.line}>Masa: {table}, Sandalye: {seat}</Text>
        <Text style={styles.detailTip}>Detay için dokun</Text>
      </TouchableOpacity>
    );
  };

  const renderNotification = (notification: Notification) => (
    <View key={notification.id} style={[
      styles.notificationCard,
      !notification.isRead && styles.unreadNotification
    ]}>
      <TouchableOpacity
        style={styles.notificationContent}
        onPress={() => handleNotificationPress(notification)}
      >
        <Text style={[
          styles.notificationMessage,
          !notification.isRead && styles.unreadMessage
        ]}>
          {notification.message}
        </Text>
        <Text style={styles.notificationTime}>
          {new Date(notification.createdAt).toLocaleString()}
        </Text>
        <Text style={styles.notificationType}>{notification.type}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => deleteNotificationHandler(notification.id)}
      >
        <Ionicons name="trash-outline" size={16} color="#FF4136" />
      </TouchableOpacity>
    </View>
  );

  const filteredNotifications = showOnlyUnread 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      {/* User Statistics */}
      {user && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Profil: {user.studentId}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userStats.libraryScore}</Text>
              <Text style={styles.statLabel}>Puan</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userStats.currentStreak}</Text>
              <Text style={styles.statLabel}>Başarı Serisi</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userStats.totalReservations}</Text>
              <Text style={styles.statLabel}>Toplam Rezervasyon</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userStats.completedReservations}</Text>
              <Text style={styles.statLabel}>Tamamlanan</Text>
            </View>
          </View>
        </View>
      )}

      <Text style={styles.subtitle}>
        Şu anda toplam {systemActiveCount} aktif rezervasyon var.
      </Text>
      
      {/* Notifications Section */}
      <View style={styles.sectionHeader}>
        <TouchableOpacity 
          style={styles.sectionToggle}
          onPress={() => setShowNotifications(!showNotifications)}
        >
          <Text style={styles.sec}>
            Bildirimler ({notifications.filter(n => !n.isRead).length})
          </Text>
          <Ionicons 
            name={showNotifications ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      {showNotifications && (
        <View style={styles.notificationsSection}>
          <View style={styles.notificationControls}>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Sadece Okunmamış</Text>
              <Switch
                value={showOnlyUnread}
                onValueChange={setShowOnlyUnread}
                trackColor={{ false: '#ccc', true: '#0074D9' }}
              />
            </View>
            <TouchableOpacity 
              style={styles.markAllBtn}
              onPress={markAllAsRead}
            >
              <Text style={styles.markAllText}>Tümünü Okundu İşaretle</Text>
            </TouchableOpacity>
          </View>
          
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(renderNotification)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={48} color="#ccc" />
              <Text style={styles.empty}>Bildirim yok</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.title}>Rezervasyonlarım</Text>

      <Text style={styles.sec}>Aktif</Text>
      {active ? (
        <>
          {renderReservation(active)}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancel} onPress={cancelActive}>
              <Text style={styles.cancelText}>İptal Et</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.complete} onPress={completeActive}>
              <Text style={styles.completeText}>Tamamlandı</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="hourglass-outline" size={48} color="#ccc" />
          <Text style={styles.empty}>Aktif rezervasyon yok</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => nav.navigate('Reservation')}
          >
            <Text style={styles.linkText}>Rezervasyon Yap</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sec}>Gelecek ({upcoming.length})</Text>
      {upcoming.length > 0 ? (
        upcoming.map(renderReservation)
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color="#ccc" />
          <Text style={styles.empty}>Gelecek rezervasyon yok</Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => nav.navigate('Reservation')}
          >
            <Text style={styles.linkText}>Rezervasyon Yap</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sec}>Geçmiş ({past.length})</Text>
      {past.length > 0 ? (
        past.slice(0, 10).map(renderReservation) // Show only recent 10
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={48} color="#ccc" />
          <Text style={styles.empty}>Geçmiş rezervasyon yok</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001f3f',
    padding: 16,
    paddingTop: 60,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#001f3f',
    marginBottom: 12,
    textAlign: 'center'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 8
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0074D9'
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    marginVertical: 8
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sec: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500'
  },
  notificationsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  notificationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  switchLabel: {
    color: '#fff',
    marginRight: 8,
    fontSize: 14
  },
  markAllBtn: {
    backgroundColor: '#0074D9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  unreadNotification: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0074D9'
  },
  notificationContent: {
    flex: 1
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333'
  },
  unreadMessage: {
    fontWeight: '600'
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  notificationType: {
    fontSize: 11,
    color: '#0074D9',
    fontWeight: '500'
  },
  deleteBtn: {
    padding: 8
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600'
  },
  line: {
    fontSize: 16,
    marginBottom: 4,
  },
  detailTip: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancel: {
    flex: 1,
    marginRight: 8,
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#FF4136',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  complete: {
    flex: 1,
    marginLeft: 8,
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#2ECC40',
    alignItems: 'center',
  },
  completeText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  empty: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  linkButton: {
    marginTop: 8,
    padding: 8,
  },
  linkText: {
    color: '#0074D9',
    fontWeight: '600',
  },
});
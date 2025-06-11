// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  CompositeNavigationProp
} from '@react-navigation/native';
import {
  NativeStackNavigationProp
} from '@react-navigation/native-stack';
import {
  BottomTabNavigationProp
} from '@react-navigation/bottom-tabs';
import {
  HomeStackParamList,
  MainTabParamList
} from '../AppNavigation';
import { 
  fetchUserReservations, 
  fetchUserProfile,
  fetchUserScore,
  fetchUnreadNotificationCount,
  fetchUserNotifications,
  fetchRoomPendingReservations,
  scanLibraryEntryOrExit,
  Reservation,
  User,
  Notification
} from '../api/api';

type HomeNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList,'HomeMain'>,
  BottomTabNavigationProp<MainTabParamList,'Home'>
>;

interface TimeSlot { label: string; value: number; }

export default function HomeScreen() {
  const nav = useNavigation<HomeNavProp>();
  const [user, setUser] = useState<User | null>(null);
  const [userScore, setUserScore] = useState<number>(0);
  const [res, setRes] = useState<Reservation|null>(null);
  const [remaining, setRemaining] = useState(0);
  const [breakRemaining, setBreakRemaining] = useState(15*60*1000);
  const [onBreak, setOnBreak] = useState(false);
  
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selSlot, setSelSlot] = useState(0);
  const [occupancy, setOccupancy] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const timerRef = useRef<number|null>(null);

  // Load user data and initialize
  const loadUserData = async () => {
    try {
      const uid = await AsyncStorage.getItem('userId');
      if (!uid) return;
      
      const userId = +uid;
      
      // Load user profile
      const userProfile = await fetchUserProfile(userId);
      setUser(userProfile);
      
      // Load user score
      const score = await fetchUserScore(userId);
      setUserScore(score);
      
      // Load unread notification count
      try {
        const unreadCount = await fetchUnreadNotificationCount(userId);
        setUnreadCount(unreadCount);
      } catch (error) {
        console.warn('Could not fetch unread notification count:', error);
        setUnreadCount(0);
      }
      
      // Load active reservation
      const all = await fetchUserReservations(userId);
      const now = +new Date();
      const act = all.find(r=>{
        const s=+new Date(r.startTime), e=+new Date(r.endTime);
        return s<=now && now<=e;
      })||null;
      setRes(act);
      if(act){
        setRemaining(+new Date(act.endTime)-now);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Load notifications
  const loadNotifications = async () => {
    try {
      const uid = await AsyncStorage.getItem('userId');
      if (!uid) return;
      
      const notifs = await fetchUserNotifications(+uid);
      setNotifications(notifs.slice(0, 5)); // Show only recent 5
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  useEffect(()=>{
    timerRef.current = setInterval(()=>{
      setRemaining(rem=>rem>0?(onBreak?rem:rem-1000):0);
      if(onBreak){
        setBreakRemaining(br=>br>0?br-1000:0);
      }
    },1000) as unknown as number;
    return ()=>clearInterval(timerRef.current!);
  },[onBreak]);

  const fmt = (ms:number)=>{
    const s=Math.floor(ms/1000)%60,
          m=Math.floor(ms/60000)%60,
          h=Math.floor(ms/3600000);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const toggleBreak = ()=> setOnBreak(b=>!b);

  // Generate time slots
  useEffect(()=>{
    const slots:TimeSlot[]=[];
    const now=new Date();
    for(let i=0;i<24;i++){
      const s=new Date(now.getTime()+i*3600000),
            e=new Date(s.getTime()+3600000),
            fmtH=(d:Date)=>d.getHours().toString().padStart(2,'0')+':00';
      slots.push({label:`${fmtH(s)}–${fmtH(e)}`,value:i});
    }
    setTimeSlots(slots);
  },[]);

  // Calculate occupancy based on pending reservations
  useEffect(()=> {
    const calculateOccupancy = async () => {
      try {
        const now = new Date();
        const selectedTime = new Date(now.getTime() + selSlot * 3600000);
        const endTime = new Date(selectedTime.getTime() + 3600000);
        
        const pendingReservations = await fetchRoomPendingReservations(
          'ROOM-001',
          selectedTime.toISOString(),
          endTime.toISOString()
        );
        
        // Assuming 200 total seats in the library
        const occupancyPercent = Math.min(Math.round((pendingReservations.length / 200) * 100), 100);
        setOccupancy(occupancyPercent);
      } catch (error) {
        // Fallback to random if API fails
        setOccupancy(Math.floor(Math.random()*101));
      }
    };
    
    calculateOccupancy();
  }, [selSlot]);

  // Quick entry/exit scan with improved error handling
  const handleQuickScan = async (scanType: 'ENTRY' | 'EXIT') => {
    try {
      if (!user) {
        Alert.alert('Hata', 'Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Check if user has active reservation for ENTRY
      if (scanType === 'ENTRY' && !res) {
        Alert.alert(
          'Aktif Rezervasyon Gerekli', 
          'Kütüphaneye giriş yapabilmek için aktif bir rezervasyonunuz olması gerekiyor.',
          [
            { text: 'Tamam', style: 'default' },
            { 
              text: 'Rezervasyon Yap', 
              onPress: () => nav.navigate('Reservation') 
            }
          ]
        );
        return;
      }

      // For EXIT, check if user has active reservation
      if (scanType === 'EXIT' && !res) {
        Alert.alert(
          'Uyarı', 
          'Aktif rezervasyonunuz bulunmuyor. Yine de çıkış yapmak istiyor musunuz?',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Çıkış Yap', onPress: () => performScan(scanType) }
          ]
        );
        return;
      }

      await performScan(scanType);

    } catch (error) {
      console.error('Error in handleQuickScan:', error);
      Alert.alert('Hata', 'Tarama işlemi başarısız oldu.');
    }
  };

  const performScan = async (scanType: 'ENTRY' | 'EXIT') => {
    try {
      if (!user) return;

      // Convert studentId to number if it's a string
      const studentIdNumber = typeof user.studentId === 'string' 
        ? parseInt(user.studentId.replace(/\D/g, ''), 10) // Extract numbers only
        : Number(user.studentId);

      if (isNaN(studentIdNumber)) {
        Alert.alert('Hata', 'Öğrenci numarası geçersiz format.');
        return;
      }

      await scanLibraryEntryOrExit({
        studentId: studentIdNumber,
        scanType,
        timestamp: new Date().toISOString()
      });
      
      const message = scanType === 'ENTRY' 
        ? 'Kütüphane girişiniz kaydedildi. İyi çalışmalar!' 
        : 'Kütüphane çıkışınız kaydedildi. Tekrar görüşmek üzere!';
        
      Alert.alert('Başarılı', message);
      
      // Refresh user score after scan
      try {
        const newScore = await fetchUserScore(user.id);
        setUserScore(newScore);
      } catch (scoreError) {
        console.warn('Could not refresh user score:', scoreError);
      }

      // If EXIT scan and has active reservation, suggest completion
      if (scanType === 'EXIT' && res) {
        setTimeout(() => {
          Alert.alert(
            'Rezervasyon Tamamla',
            'Çıkış yaptığınıza göre rezervasyonunuzu tamamlamak ister misiniz?',
            [
              { text: 'Şimdi Değil', style: 'cancel' },
              { 
                text: 'Tamamla', 
                onPress: () => nav.navigate('MyReservations')
              }
            ]
          );
        }, 1000);
      }

    } catch (error: any) {
      console.error('Error in performScan:', error);
      
      let errorMessage = 'Tarama işlemi başarısız oldu.';
      
      if (error.message) {
        if (error.message.includes('404')) {
          errorMessage = 'Öğrenci numarası sistemde bulunamadı.';
        } else if (error.message.includes('400')) {
          errorMessage = 'Geçersiz tarama verisi.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
        }
      }
      
      Alert.alert('Tarama Başarısız', errorMessage);
    }
  };

  const toggleNotifications = () => {
    if (!showNotifications) {
      loadNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  return (
    <SafeAreaView style={styles.c}>
      <ScrollView contentContainerStyle={{paddingBottom:100}}>
        {/* Header with user info and notifications */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Hoş Geldiniz!</Text>
            {user && (
              <Text style={styles.userInfo}>
                {user.studentId} • Puan: {userScore}
              </Text>
            )}
          </View>
          <TouchableOpacity 
            style={styles.notificationBtn}
            onPress={toggleNotifications}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Notifications Panel */}
        {showNotifications && (
          <View style={styles.notificationPanel}>
            <Text style={styles.notificationTitle}>Son Bildirimler</Text>
            {notifications.length > 0 ? (
              notifications.map(notif => (
                <View key={notif.id} style={[styles.notificationItem, !notif.isRead && styles.unreadNotification]}>
                  <Text style={styles.notificationMessage}>{notif.message}</Text>
                  <Text style={styles.notificationTime}>
                    {new Date(notif.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noNotifications}>Bildirim yok</Text>
            )}
          </View>
        )}

        {/* Quick Scan Buttons - Only show if user is loaded */}
        {user && (
          <View style={styles.scanButtons}>
            <TouchableOpacity 
              style={[styles.scanBtn, styles.entryBtn]}
              onPress={() => handleQuickScan('ENTRY')}
            >
              <Text style={styles.scanBtnText}>Hızlı Giriş</Text>
              <Text style={styles.scanBtnSubtext}>
                {res ? 'Rezervasyonla' : 'Rezervasyon Gerekli'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.scanBtn, styles.exitBtn]}
              onPress={() => handleQuickScan('EXIT')}
            >
              <Text style={styles.scanBtnText}>Hızlı Çıkış</Text>
              <Text style={styles.scanBtnSubtext}>
                {res ? 'Rezervasyondan' : 'Serbest Çıkış'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active Reservation Timer */}
        {res && (
          <View style={styles.counter}>
            <Text style={styles.countLabel}>Aktif Rezervasyon</Text>
            <Text style={styles.reservationInfo}>
              Masa {res.deskId.split('-')[0]}, Sandalye {res.deskId.split('-')[1]}
            </Text>
            <Text style={styles.countLabel}>Kalan Süre:</Text>
            <Text style={styles.count}>{fmt(remaining)}</Text>
            <Text style={styles.countLabel}>Molada Kalan:</Text>
            <Text style={styles.count}>{fmt(breakRemaining)}</Text>
            <TouchableOpacity
              style={[styles.breakBtn,onBreak&&styles.breakActive]}
              onPress={toggleBreak}
            >
              <Text style={styles.breakText}>
                {onBreak?'Moladan Döndüm':'Molaya Çıktım'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Actions */}
        <TouchableOpacity
          style={styles.reserveBtn}
          onPress={()=>nav.navigate('Reservation')}
        >
          <Text style={styles.reserveText}>Rezervasyon Yap</Text>
        </TouchableOpacity>

        {/* Library Occupancy */}
        <Text style={styles.section}>Kütüphane Doluluk</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={selSlot}
            onValueChange={(val) => setSelSlot(val)}
            mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
            dropdownIconColor="#fff"
            style={styles.picker}
          >
            {timeSlots.map(ts=>(
              <Picker.Item key={ts.value} label={ts.label} value={ts.value}/>
            ))}
          </Picker>
        </View>
        <View style={styles.bar}>
          <View style={[styles.fill,{width:`${occupancy}%`}]} />
        </View>
        <Text style={styles.occText}>{occupancy}% dolu</Text>

        {/* Rankings Button */}
        <TouchableOpacity
          style={styles.rankBtn}
          onPress={()=>nav.navigate('Ranking')}
        >
          <Text style={styles.rankText}>Sıralamaları Gör</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex:1,backgroundColor:'#001f3f' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    margin: 16 
  },
  welcome: { fontSize:24,color:'#fff',fontWeight:'600' },
  userInfo: { fontSize:14,color:'#ccc',marginTop:4 },
  notificationBtn: { 
    position: 'relative',
    padding: 8 
  },
  notificationIcon: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF4136',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  notificationPanel: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8
  },
  notificationTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginBottom: 12 
  },
  notificationItem: {
    paddingVertical: 8,
    borderBottomColor: '#eee',
    borderBottomWidth: 1
  },
  unreadNotification: { backgroundColor: '#f0f8ff' },
  notificationMessage: { fontSize: 14, marginBottom: 4 },
  notificationTime: { fontSize: 12, color: '#666' },
  noNotifications: { 
    textAlign: 'center', 
    color: '#666', 
    fontStyle: 'italic' 
  },
  scanButtons: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8
  },
  scanBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  entryBtn: { backgroundColor: '#2ECC40' },
  exitBtn: { backgroundColor: '#FF851B' },
  scanBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  scanBtnSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4
  },
  counter: { backgroundColor:'#fff',margin:16,padding:16,borderRadius:8 },
  countLabel: { fontSize:16,fontWeight:'600',marginTop:8 },
  reservationInfo: {
    fontSize: 14,
    color: '#0074D9',
    fontWeight: '500',
    marginTop: 4
  },
  count: { fontSize:20,fontWeight:'700',marginTop:4 },
  breakBtn: { marginTop:12,padding:10,backgroundColor:'#FFDC00',borderRadius:6,alignItems:'center' },
  breakActive: { backgroundColor:'#2ECC40' },
  breakText: { fontSize:16,fontWeight:'600' },
  reserveBtn: { backgroundColor:'#0074D9',margin:16,height:52,borderRadius:8,alignItems:'center',justifyContent:'center' },
  reserveText: { color:'#fff',fontSize:18,fontWeight:'600' },
  section: { color:'#fff',fontSize:18,marginTop:24,marginHorizontal:16 },
  pickerWrap: { marginHorizontal:16, backgroundColor:'#fff', borderRadius:8 },
  picker: { height:44, width:Dimensions.get('window').width - 32 },
  bar: { height:12,backgroundColor:'#ccc',borderRadius:6,marginHorizontal:16,marginTop:8 },
  fill: { height:12, backgroundColor:'#0074D9' },
  occText: { color:'#fff',fontSize:16,margin:16 },
  rankBtn: { backgroundColor:'#fff',margin:16,padding:14,borderRadius:8,alignItems:'center',marginTop:40 },
  rankText: { color:'#001f3f',fontSize:16,fontWeight:'600' },
});
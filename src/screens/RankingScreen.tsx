// src/screens/RankingScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CompositeNavigationProp,
  useNavigation
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  HomeStackParamList,
  MainTabParamList
} from '../AppNavigation';
import { 
  fetchAllUsers, 
  fetchUserProfile,
  fetchUserScore,
  User 
} from '../api/api';

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Ranking'>,
  BottomTabNavigationProp<MainTabParamList>
>;

interface StudentItem { 
  id: number;
  name: string; 
  score: number;
  streak: number;
  email: string;
  isCurrentUser: boolean;
}

interface FacultyItem { 
  name: string; 
  score: number;
  studentCount: number;
  averageScore: number;
}

// Union type for list items
type ListItem = StudentItem | FacultyItem;

// Mock faculty data - in real app, this would come from API
const FACULTY_MAPPING: Record<string, string> = {
  'CS': 'Bilgisayar Mühendisliği',
  'EE': 'Elektrik-Elektronik',
  'ME': 'Makine Mühendisliği',
  'IE': 'Endüstri Mühendisliği',
  'AR': 'Mimarlık',
  'CE': 'İnşaat Mühendisliği',
  'CH': 'Kimya Mühendisliği'
};

// Type guard functions
const isStudentItem = (item: ListItem): item is StudentItem => {
  return 'id' in item && 'streak' in item && 'email' in item && 'isCurrentUser' in item;
};

const isFacultyItem = (item: ListItem): item is FacultyItem => {
  return 'studentCount' in item && 'averageScore' in item;
};

export default function RankingScreen() {
  const navigation = useNavigation<NavProp>();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [activeTab, setActiveTab] = useState<'students'|'faculties'>('students');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'score' | 'streak'>('score');

  const loadRankings = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Get current user info
      const userId = await AsyncStorage.getItem('userId');
      let currentUserData: User | null = null;
      
      if (userId) {
        try {
          currentUserData = await fetchUserProfile(+userId);
          setCurrentUser(currentUserData);
        } catch (error) {
          console.warn('Could not fetch current user profile:', error);
        }
      }

      // Fetch all users
      const allUsers = await fetchAllUsers();
      
      // Process student rankings - ensure studentId is always a string
      const studentRankings: StudentItem[] = allUsers
        .map(user => {
          const studentIdStr = String(user.studentId || '');
          return {
            id: user.id,
            name: studentIdStr,
            score: user.libraryScore,
            streak: user.successfulCompletionsStreak,
            email: user.email,
            isCurrentUser: currentUserData ? user.id === currentUserData.id : false
          };
        })
        .sort((a, b) => {
          if (sortBy === 'score') {
            return b.score - a.score;
          } else {
            return b.streak - a.streak;
          }
        });

      setStudents(studentRankings);

      // Find current user rank
      if (currentUserData) {
        const userRank = studentRankings.findIndex(s => s.id === currentUserData.id) + 1;
        setCurrentUserRank(userRank);
      }

      // Process faculty rankings (mock implementation based on student IDs)
      const facultyStats: Record<string, { totalScore: number; count: number; students: StudentItem[] }> = {};
      
      studentRankings.forEach(student => {
        // Extract faculty code from student ID (assuming format like CS2021001)
        const facultyCode = student.name.match(/^[A-Z]+/)?.[0] || 'OTHER';
        const facultyName = FACULTY_MAPPING[facultyCode] || 'Diğer';
        
        if (!facultyStats[facultyName]) {
          facultyStats[facultyName] = { totalScore: 0, count: 0, students: [] };
        }
        
        facultyStats[facultyName].totalScore += student.score;
        facultyStats[facultyName].count += 1;
        facultyStats[facultyName].students.push(student);
      });

      const facultyRankings: FacultyItem[] = Object.entries(facultyStats)
        .map(([name, stats]) => ({
          name,
          score: stats.totalScore,
          studentCount: stats.count,
          averageScore: Math.round(stats.totalScore / stats.count)
        }))
        .sort((a, b) => b.averageScore - a.averageScore);

      setFaculties(facultyRankings);

    } catch (error) {
      console.error('Error loading rankings:', error);
      Alert.alert('Hata', 'Sıralamalar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRankings();
  }, [sortBy]);

  const onRefresh = () => {
    loadRankings(true);
  };

  const showUserDetails = async (userId: number) => {
    try {
      const userProfile = await fetchUserProfile(userId);
      const userScore = await fetchUserScore(userId);
      
      Alert.alert(
        'Kullanıcı Detayları',
        `Öğrenci No: ${userProfile.studentId}\n` +
        `E-posta: ${userProfile.email}\n` +
        `Güncel Puan: ${userScore}\n` +
        `Başarı Serisi: ${userProfile.successfulCompletionsStreak}\n` +
        `No-Show Serisi: ${userProfile.noShowStreak}\n` +
        `Kural İhlali Serisi: ${userProfile.breakViolationStreak}`
      );
    } catch (error) {
      Alert.alert('Hata', 'Kullanıcı detayları alınamadı.');
    }
  };

  const toggleSort = () => {
    setSortBy(prev => prev === 'score' ? 'streak' : 'score');
  };

  const renderStudentItem = ({ item, index }: { item: StudentItem; index: number }) => {
    const getRankIcon = (rank: number) => {
      switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return `${rank}.`;
      }
    };

    const getRankColor = (rank: number) => {
      if (rank <= 3) return '#FFD700';
      if (rank <= 10) return '#C0C0C0';
      return '#CD7F32';
    };

    return (
      <TouchableOpacity
        style={[
          styles.card,
          item.isCurrentUser && styles.currentUserCard
        ]}
        onPress={() => showUserDetails(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rank, { color: getRankColor(index + 1) }]}>
            {getRankIcon(index + 1)}
          </Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={[styles.name, item.isCurrentUser && styles.currentUserText]}>
            {item.name} {item.isCurrentUser && '(Sen)'}
          </Text>
          <Text style={styles.email}>{item.email}</Text>
          {item.streak > 0 && (
            <Text style={styles.streak}>🔥 {item.streak} başarı serisi</Text>
          )}
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={[styles.score, item.isCurrentUser && styles.currentUserText]}>
            {sortBy === 'score' ? item.score : item.streak}
          </Text>
          <Text style={styles.scoreLabel}>
            {sortBy === 'score' ? 'puan' : 'seri'}
          </Text>
        </View>
        
        {item.isCurrentUser && (
          <Ionicons name="person" size={16} color="#0074D9" style={styles.userIcon} />
        )}
      </TouchableOpacity>
    );
  };

  const renderFacultyItem = ({ item, index }: { item: FacultyItem; index: number }) => (
    <View style={styles.card}>
      <Text style={styles.rank}>{index + 1}.</Text>
      <View style={styles.facultyInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.facultyStats}>
          {item.studentCount} öğrenci • Ortalama: {item.averageScore} puan
        </Text>
      </View>
      <Text style={styles.score}>{item.score}</Text>
    </View>
  );

  // Generic render function that uses type guards
  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if (isStudentItem(item)) {
      return renderStudentItem({ item, index });
    } else if (isFacultyItem(item)) {
      return renderFacultyItem({ item, index });
    }
    return null;
  };

  const data: ListItem[] = activeTab === 'students' ? students : faculties;

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Sıralamalar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sıralamalar</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Current User Info */}
      {currentUser && activeTab === 'students' && (
        <View style={styles.currentUserInfo}>
          <Text style={styles.currentUserTitle}>Senin Durumun</Text>
          <View style={styles.currentUserStats}>
            <View style={styles.currentUserStat}>
              <Text style={styles.currentUserStatValue}>#{currentUserRank}</Text>
              <Text style={styles.currentUserStatLabel}>Sıralama</Text>
            </View>
            <View style={styles.currentUserStat}>
              <Text style={styles.currentUserStatValue}>{currentUser.libraryScore}</Text>
              <Text style={styles.currentUserStatLabel}>Puan</Text>
            </View>
            <View style={styles.currentUserStat}>
              <Text style={styles.currentUserStatValue}>{currentUser.successfulCompletionsStreak}</Text>
              <Text style={styles.currentUserStatLabel}>Seri</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab==='students' && styles.tabActive]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab==='students' && styles.tabTextActive]}>
            Öğrenciler ({students.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab==='faculties' && styles.tabActive]}
          onPress={() => setActiveTab('faculties')}
        >
          <Text style={[styles.tabText, activeTab==='faculties' && styles.tabTextActive]}>
            Fakülteler ({faculties.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sort Controls for Students */}
      {activeTab === 'students' && (
        <View style={styles.sortControls}>
          <TouchableOpacity style={styles.sortButton} onPress={toggleSort}>
            <Text style={styles.sortButtonText}>
              Sıralama: {sortBy === 'score' ? 'Puan' : 'Başarı Serisi'}
            </Text>
            <Ionicons name="swap-vertical" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList<ListItem>
        data={data}
        keyExtractor={(item, index) => {
          if (isStudentItem(item)) {
            return `student-${item.id}`;
          } else if (isFacultyItem(item)) {
            return `faculty-${item.name}`;
          }
          return `item-${index}`;
        }}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#001f3f', paddingTop:70 },
  loadingContainer: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 16, 
    fontSize: 16 
  },
  header: { 
    flexDirection:'row', 
    alignItems:'center', 
    paddingHorizontal:16, 
    marginBottom:16,
    justifyContent: 'space-between'
  },
  back: { color:'#fff', fontSize:16 },
  title: { 
    color:'#fff', 
    fontSize:20, 
    fontWeight:'600' 
  },
  currentUserInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  currentUserTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12
  },
  currentUserStats: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  currentUserStat: {
    alignItems: 'center'
  },
  currentUserStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold'
  },
  currentUserStatLabel: {
    color: '#ccc',
    fontSize: 12
  },
  tabs: { 
    flexDirection:'row', 
    margin:16, 
    borderRadius:8, 
    overflow:'hidden' 
  },
  tab: { 
    flex:1, 
    paddingVertical:12, 
    backgroundColor:'rgba(255, 255, 255, 0.2)', 
    alignItems:'center' 
  },
  tabActive: { backgroundColor:'#0074D9' },
  tabText: { color:'#fff', fontSize:16 },
  tabTextActive: { color:'#fff', fontWeight: '600' },
  sortControls: {
    paddingHorizontal: 16,
    marginBottom: 8
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8
  },
  list: { paddingHorizontal:16, paddingBottom: 20 },
  card: {
    flexDirection:'row',
    backgroundColor:'#fff',
    borderRadius:12,
    padding:16,
    alignItems:'center',
    marginBottom:12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: '#0074D9',
    backgroundColor: '#f0f8ff'
  },
  rankContainer: {
    width: 40,
    alignItems: 'center'
  },
  rank: { 
    fontSize: 18,
    fontWeight: 'bold'
  },
  userInfo: {
    flex: 1,
    marginLeft: 12
  },
  name: { 
    fontSize: 16,
    fontWeight: '600',
    color: '#001f3f'
  },
  currentUserText: {
    color: '#0074D9'
  },
  email: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  streak: {
    fontSize: 12,
    color: '#FF851B',
    marginTop: 2
  },
  facultyInfo: {
    flex: 1,
    marginLeft: 12
  },
  facultyStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  scoreContainer: {
    alignItems: 'center',
    minWidth: 60
  },
  score: { 
    fontSize: 18,
    fontWeight: 'bold',
    color: '#001f3f'
  },
  scoreLabel: {
    fontSize: 10,
    color: '#666'
  },
  userIcon: {
    marginLeft: 8
  }
});
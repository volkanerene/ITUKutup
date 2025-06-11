// src/api/api.ts - Test different reservation formats

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

export interface User {
  id: number;
  email: string;
  studentId: string;
  libraryScore: number;
  successfulCompletionsStreak: number;
  noShowStreak: number;
  breakViolationStreak: number;
}

export interface Reservation {
  id: number;
  userId: number;
  roomId: string;
  deskId: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

// Enhanced fetch with detailed error information
async function enhancedFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    console.log(`🌐 API Call: ${options?.method || 'GET'} ${url}`);
    if (options?.body) {
      console.log(`📤 Request Body:`, JSON.parse(options.body as string));
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        console.log(`📥 Error Response Body:`, errorBody);
        
        try {
          const errorJson = JSON.parse(errorBody);
          if (errorJson.message) {
            errorDetails = errorJson.message;
          } else if (errorJson.error) {
            errorDetails = errorJson.error;
          } else if (errorJson.detail) {
            errorDetails = errorJson.detail;
          } else if (errorJson.details) {
            errorDetails = errorJson.details;
          } else {
            errorDetails = errorBody;
          }
        } catch {
          errorDetails = errorBody;
        }
      } catch {
        errorDetails = `HTTP ${response.status}: ${response.statusText}`;
      }

      const error = new Error(`${response.statusText} - ${errorDetails}`);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      (error as any).details = errorDetails;
      throw error;
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      throw new Error('Bağlantı hatası. İnternet bağlantınızı kontrol edin.');
    }
    throw error;
  }
}

// src/api/api.ts - createReservation fonksiyonu
export async function createReservation(req: {
  userId: number;
  roomId: string;
  deskId: string;
  startTime: string; // ISO format without millis and Z: "2025-05-26T12:30:00"
  endTime: string;   // ISO format without millis and Z: "2025-05-26T12:30:00"
}) {
  const body = JSON.stringify({
    userId   : req.userId,   // ✅ camelCase – number
    roomId   : req.roomId,
    deskId   : req.deskId,
    startTime: req.startTime, // ✅ "2025-05-26T12:30:00"
    endTime  : req.endTime    // ✅ "2025-05-26T14:30:00"
  });

  const res = await enhancedFetch(`${BASE_URL}/api/reservations`, {
    method : 'POST',
    body
  });

  if (!res.ok) {
    let errorDetails = '';
    try {
      const errorBody = await res.text();
      errorDetails = errorBody;
    } catch {
      errorDetails = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(`API ${res.status} – ${errorDetails}`);
  }
  return res.json();   // ReservationDto
}
// Rest of the API functions remain the same...
export async function registerUser(
  email: string,
  password: string,
  studentId: string
): Promise<User> {
  const res = await enhancedFetch(`${BASE_URL}/api/users/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, studentId }),
  });
  return res.json();
}

export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const res = await enhancedFetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function fetchUserProfile(userId: number): Promise<User> {
  const res = await enhancedFetch(`${BASE_URL}/api/users/me?userId=${userId}`);
  return res.json();
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await enhancedFetch(`${BASE_URL}/api/users/all`);
  return res.json();
}

export async function fetchUserScore(userId: number): Promise<number> {
  const res = await enhancedFetch(`${BASE_URL}/api/users/me/score?userId=${userId}`);
  return res.json();
}

export async function fetchReservationById(reservationId: number): Promise<Reservation> {
  const res = await enhancedFetch(`${BASE_URL}/api/reservations/${reservationId}`);
  return res.json();
}

export async function fetchUserReservations(userId: number): Promise<Reservation[]> {
  const res = await enhancedFetch(`${BASE_URL}/api/reservations/user/${userId}`);
  return res.json();
}

export async function fetchRoomReservations(roomId: string = 'ROOM-001'): Promise<Reservation[]> {
  const res = await enhancedFetch(`${BASE_URL}/api/reservations/room/${roomId}`);
  return res.json();
}

export async function fetchActiveReservations(): Promise<Reservation[]> {
  const res = await enhancedFetch(`${BASE_URL}/api/reservations/active`);
  return res.json();
}

export async function cancelReservation(
  reservationId: number,
  reason: string = 'User request'
): Promise<Reservation> {
  const res = await enhancedFetch(
    `${BASE_URL}/api/reservations/${reservationId}/cancel?cancellationReason=${encodeURIComponent(reason)}`,
    { method: 'POST' }
  );
  return res.json();
}

export async function completeReservation(
  reservationId: number,
  wasCompliant: boolean = true
): Promise<Reservation> {
  const res = await enhancedFetch(
    `${BASE_URL}/api/reservations/${reservationId}/complete?wasCompliant=${wasCompliant}`,
    { method: 'POST' }
  );
  return res.json();
}

// Enhanced Reservation Queries with Fallbacks
export async function fetchRoomPendingReservations(
  roomId: string,
  startTime: string,
  endTime: string
): Promise<Reservation[]> {
  try {
    const url = `${BASE_URL}/api/reservations/room/${roomId}/pending?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
    const res = await enhancedFetch(url);
    return res.json();
  } catch (error) {
    console.warn('⚠️ fetchRoomPendingReservations not available, using fallback');
    try {
      const allReservations = await fetchRoomReservations(roomId);
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      
      return allReservations.filter(r => {
        const rStart = new Date(r.startTime).getTime();
        const rEnd = new Date(r.endTime).getTime();
        return rStart < end && start < rEnd && r.status === 'PENDING';
      });
    } catch (fallbackError) {
      console.warn('⚠️ Fallback also failed, returning empty array');
      return [];
    }
  }
}

export async function fetchPendingReservationsForTimeSlot(
  startTime: string,
  endTime: string
): Promise<Reservation[]> {
  try {
    const url = `${BASE_URL}/api/reservations/pending/time-slot?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;
    const res = await enhancedFetch(url);
    return res.json();
  } catch (error) {
    console.warn('⚠️ fetchPendingReservationsForTimeSlot not available, using fallback');
    try {
      const activeReservations = await fetchActiveReservations();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      
      const overlapping = activeReservations.filter(r => {
        const rStart = new Date(r.startTime).getTime();
        const rEnd = new Date(r.endTime).getTime();
        return rStart < end && start < rEnd;
      });
      
      return overlapping;
    } catch (fallbackError) {
      console.warn('⚠️ Fallback also failed, returning empty array');
      return [];
    }
  }
}

// Notification Management
export interface Notification {
  id: number;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  reservationId?: number;
  roomId?: string;
}

export async function fetchUserNotifications(
  userId: number,
  isRead?: boolean
): Promise<Notification[]> {
  try {
    const query = isRead !== undefined ? `?isRead=${isRead}` : '';
    const res = await enhancedFetch(`${BASE_URL}/api/notifications/user/${userId}${query}`);
    return res.json();
  } catch (error) {
    console.warn('⚠️ Notifications not available:', error);
    return [];
  }
}

export async function fetchUnreadNotificationCount(userId: number): Promise<number> {
  try {
    const res = await enhancedFetch(`${BASE_URL}/api/notifications/user/${userId}/unread/count`);
    return res.json();
  } catch (error) {
    console.warn('⚠️ Unread notification count not available:', error);
    return 0;
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  try {
    await enhancedFetch(`${BASE_URL}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  } catch (error) {
    console.warn('⚠️ Could not mark notification as read:', error);
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<void> {
  try {
    await enhancedFetch(`${BASE_URL}/api/notifications/user/${userId}/read-all`, {
      method: 'PUT',
    });
  } catch (error) {
    console.warn('⚠️ Could not mark all notifications as read:', error);
  }
}

export async function deleteNotification(notificationId: number): Promise<void> {
  try {
    await enhancedFetch(`${BASE_URL}/api/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('⚠️ Could not delete notification:', error);
  }
}

// Library Scan
export async function scanLibraryEntryOrExit(data: {
  studentId: number;
  scanType: 'ENTRY' | 'EXIT';
  timestamp: string;
}): Promise<void> {
  console.log('🚀 Library scan:', data);
  await enhancedFetch(`${BASE_URL}/adapter/library/scan`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  console.log('✅ Library scan completed');
}
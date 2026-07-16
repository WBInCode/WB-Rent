const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin`;

const TOKEN_KEY = 'wb-rent-admin-token';
const TOKEN_EXP_KEY = 'wb-rent-admin-token-exp';

// Get token from localStorage (null if missing or expired)
const getToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const exp = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0);
  if (exp && Date.now() >= exp) {
    adminLogout();
    return null;
  }
  return token;
};

// Auth headers
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

// Fetch wrapper: attaches auth, auto-logs out on expired/invalid session
async function adminFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res
    .json()
    .catch(() => ({ success: false, message: 'Błąd odpowiedzi serwera' }));
  if (res.status === 401 && getToken()) {
    // Session expired/invalid server-side - clear local session and show login
    adminLogout();
    window.location.assign('/admin');
  }
  return data;
}

// Login
export async function adminLogin(password: string) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();
  
  if (data.success && data.token) {
    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.expiresAt) {
      localStorage.setItem(TOKEN_EXP_KEY, String(data.expiresAt));
    }
  }

  return data;
}

// Logout
export function adminLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXP_KEY);
}

// Check if logged in
export function isAdminLoggedIn() {
  return !!getToken();
}

// Get stats
export async function getStats() {
  return adminFetch('/stats');
}

// Change admin password
export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  return adminFetch('/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// === RENTAL CONTRACTS ===
export interface CreateContractPayload {
  reservationId: number;
  renterAddress: string;
  documentType: 'dowod_osobisty' | 'paszport';
  documentNumber: string;
  pesel?: string;
  employeeName: string;
  deposit: number;
  accessories: string;
  conditionNotes: string;
}

export async function createContractSession(payload: CreateContractPayload) {
  return adminFetch('/contracts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getReservationContract(reservationId: number) {
  return adminFetch(`/contracts/reservation/${reservationId}`);
}

export async function downloadContractPdf(contractId: number) {
  const res = await fetch(`${API_BASE}/contracts/${contractId}/pdf`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Nie udało się pobrać umowy');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `umowa-${contractId}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Get reservations
export async function getReservations(status?: string) {
  return adminFetch(status ? `/reservations?status=${encodeURIComponent(status)}` : '/reservations');
}

// Update reservation status
export async function updateReservationStatus(id: number, status: string) {
  return adminFetch(`/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Get contacts
export async function getContacts() {
  return adminFetch('/contacts');
}

// Update contact status
export async function updateContactStatus(id: number, status: string) {
  return adminFetch(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Get single contact with replies
export async function getContact(id: number) {
  return adminFetch(`/contacts/${id}`);
}

// Reply to contact
export async function replyToContact(id: number, message: string) {
  return adminFetch(`/contacts/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// Delete single contact
export async function deleteContact(id: number) {
  return adminFetch(`/contacts/${id}`, {
    method: 'DELETE',
  });
}

// Delete multiple contacts
export async function deleteContacts(ids: number[]) {
  return adminFetch('/contacts/delete-many', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// Get revenue details
export async function getRevenue() {
  return adminFetch('/revenue');
}

// Send reminders (manual trigger)
export async function sendReminders() {
  return adminFetch('/send-reminders', {
    method: 'POST',
  });
}

// === NEWSLETTER API ===

// Get newsletter subscribers
export async function getNewsletterSubscribers() {
  return adminFetch('/newsletter/subscribers');
}

// Delete newsletter subscriber
export async function deleteNewsletterSubscriber(id: number) {
  return adminFetch(`/newsletter/subscribers/${id}`, {
    method: 'DELETE',
  });
}

// Get newsletter posts
export async function getNewsletterPosts() {
  return adminFetch('/newsletter/posts');
}

// Create newsletter post
export async function createNewsletterPost(title: string, content: string) {
  return adminFetch('/newsletter/posts', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
}

// Update newsletter post
export async function updateNewsletterPost(id: number, title: string, content: string, status: string) {
  return adminFetch(`/newsletter/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title, content, status }),
  });
}

// Delete newsletter post
export async function deleteNewsletterPost(id: number) {
  return adminFetch(`/newsletter/posts/${id}`, {
    method: 'DELETE',
  });
}

// Send newsletter post to all subscribers
export async function sendNewsletterPost(id: number) {
  return adminFetch(`/newsletter/posts/${id}/send`, {
    method: 'POST',
  });
}

// Get newsletter stats
export async function getNewsletterStats() {
  return adminFetch('/newsletter/stats');
}

// =============================================
// PRODUCT AVAILABILITY NOTIFICATIONS
// =============================================

// Get all product notifications
export async function getProductNotifications() {
  return adminFetch('/notifications');
}

// Get notification stats
export async function getNotificationStats() {
  return adminFetch('/notifications/stats');
}

// Delete notification
export async function deleteNotification(id: number) {
  return adminFetch(`/notifications/${id}`, {
    method: 'DELETE',
  });
}

// Send notifications for a product (manual trigger)
export async function sendProductNotifications(productId: string) {
  return adminFetch(`/notifications/send/${encodeURIComponent(productId)}`, {
    method: 'POST',
  });
}

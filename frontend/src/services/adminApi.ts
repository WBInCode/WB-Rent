const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin`;

// Get token from localStorage
const getToken = () => localStorage.getItem('wb-rent-admin-token');

// Auth headers
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`,
});

// Login
export async function adminLogin(password: string) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();
  
  if (data.success && data.token) {
    localStorage.setItem('wb-rent-admin-token', data.token);
  }

  return data;
}

// Logout
export function adminLogout() {
  localStorage.removeItem('wb-rent-admin-token');
}

// Check if logged in
export function isAdminLoggedIn() {
  return !!getToken();
}

// Get stats
export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Get reservations
export async function getReservations(status?: string) {
  const url = status ? `${API_BASE}/reservations?status=${status}` : `${API_BASE}/reservations`;
  const res = await fetch(url, {
    headers: authHeaders(),
  });
  return res.json();
}

// Update reservation status
export async function updateReservationStatus(id: number, status: string) {
  const res = await fetch(`${API_BASE}/reservations/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

// Get contacts
export async function getContacts() {
  const res = await fetch(`${API_BASE}/contacts`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Update contact status
export async function updateContactStatus(id: number, status: string) {
  const res = await fetch(`${API_BASE}/contacts/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

// Get single contact with replies
export async function getContact(id: number) {
  const res = await fetch(`${API_BASE}/contacts/${id}`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Reply to contact
export async function replyToContact(id: number, message: string) {
  const res = await fetch(`${API_BASE}/contacts/${id}/reply`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  return res.json();
}

// Delete single contact
export async function deleteContact(id: number) {
  const res = await fetch(`${API_BASE}/contacts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// Delete multiple contacts
export async function deleteContacts(ids: number[]) {
  const res = await fetch(`${API_BASE}/contacts/delete-many`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ids }),
  });
  return res.json();
}

// Get revenue details
export async function getRevenue() {
  const res = await fetch(`${API_BASE}/revenue`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Send reminders (manual trigger)
export async function sendReminders() {
  const res = await fetch(`${API_BASE}/send-reminders`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

// === NEWSLETTER API ===

// Get newsletter subscribers
export async function getNewsletterSubscribers() {
  const res = await fetch(`${API_BASE}/newsletter/subscribers`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Delete newsletter subscriber
export async function deleteNewsletterSubscriber(id: number) {
  const res = await fetch(`${API_BASE}/newsletter/subscribers/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// Get newsletter posts
export async function getNewsletterPosts() {
  const res = await fetch(`${API_BASE}/newsletter/posts`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Create newsletter post
export async function createNewsletterPost(title: string, content: string) {
  const res = await fetch(`${API_BASE}/newsletter/posts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

// Update newsletter post
export async function updateNewsletterPost(id: number, title: string, content: string, status: string) {
  const res = await fetch(`${API_BASE}/newsletter/posts/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title, content, status }),
  });
  return res.json();
}

// Delete newsletter post
export async function deleteNewsletterPost(id: number) {
  const res = await fetch(`${API_BASE}/newsletter/posts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// Send newsletter post to all subscribers
export async function sendNewsletterPost(id: number) {
  const res = await fetch(`${API_BASE}/newsletter/posts/${id}/send`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

// Get newsletter stats
export async function getNewsletterStats() {
  const res = await fetch(`${API_BASE}/newsletter/stats`, {
    headers: authHeaders(),
  });
  return res.json();
}

// =============================================
// PRODUCT AVAILABILITY NOTIFICATIONS
// =============================================

// Get all product notifications
export async function getProductNotifications() {
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Get notification stats
export async function getNotificationStats() {
  const res = await fetch(`${API_BASE}/notifications/stats`, {
    headers: authHeaders(),
  });
  return res.json();
}

// Delete notification
export async function deleteNotification(id: number) {
  const res = await fetch(`${API_BASE}/notifications/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

// Send notifications for a product (manual trigger)
export async function sendProductNotifications(productId: string) {
  const res = await fetch(`${API_BASE}/notifications/send/${productId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

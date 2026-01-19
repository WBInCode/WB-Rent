const API_BASE = 'http://localhost:3001/api/admin';

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

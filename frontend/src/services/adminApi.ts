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

export type ProductCondition = 'good' | 'attention' | 'service' | 'damaged';

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  category_id: string;
  image: string;
  images: string[];
  price_per_day: number;
  price_next_day: number;
  price_weekend: number;
  total_quantity: number;
  service_quantity: number;
  rentable_quantity: number;
  reserved_today: number;
  available_today: number;
  condition_status: ProductCondition;
  inventory_notes: string;
  features: string[];
  included_accessories: string[];
  optional_accessories: string[];
  accessory_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductInventoryPayload {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  images: string[];
  pricePerDay: number;
  priceNextDay: number;
  priceWeekend: number;
  totalQuantity: number;
  serviceQuantity: number;
  conditionStatus: ProductCondition;
  inventoryNotes: string;
  features: string[];
  includedAccessories: string[];
  optionalAccessories: string[];
  accessoryPrice: number;
  isActive: boolean;
}

export async function getAdminProducts() {
  return adminFetch('/products');
}

export async function createAdminProduct(payload: ProductInventoryPayload) {
  return adminFetch('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProduct(id: string, payload: ProductInventoryPayload) {
  return adminFetch(`/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminProduct(id: string) {
  return adminFetch(`/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function uploadProductImage(file: File) {
  const body = new FormData();
  body.append('image', file);
  const res = await fetch(`${API_BASE}/products/images`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body,
  });
  return res.json().catch(() => ({ success: false, message: 'Błąd odpowiedzi serwera' }));
}

export async function deleteUploadedProductImage(url: string) {
  const filename = url.split('/').pop();
  if (!filename || !url.startsWith('/api/product-images/')) {
    return { success: true };
  }
  return adminFetch(`/products/images/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

// === RENTAL CONTRACTS ===
export interface CreateContractPayload {
  reservationId: number;
  renterAddress: string;
  documentType: 'dowod_osobisty' | 'paszport';
  documentNumber: string;
  pesel: string;
  employeeName: string;
  deposit: number;
  accessories: string;
  conditionNotes: string;
  handoverItems?: string[];
}

export async function createContractSession(payload: CreateContractPayload) {
  return adminFetch('/contracts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function validateContractDetails(
  payload: Omit<CreateContractPayload, 'reservationId'>
) {
  return adminFetch('/contracts/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getHandoverTemplate(productIds: string[]) {
  return adminFetch(`/contracts/handover-template?products=${encodeURIComponent(productIds.join(','))}`);
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

export async function resendContractEmail(contractId: number) {
  return adminFetch(`/contracts/${contractId}/resend-email`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// Get reservations
export async function getReservations(status?: string) {
  return adminFetch(status ? `/reservations?status=${encodeURIComponent(status)}` : '/reservations');
}

export interface ReservationStatusChangePayload {
  note?: string;
  changedBy?: string;
  notifyCustomer?: boolean;
}

// Update reservation status
export async function updateReservationStatus(
  id: number,
  status: string,
  details: ReservationStatusChangePayload = {}
) {
  return adminFetch(`/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...details }),
  });
}

export async function getReservationStatusChanges(id: number) {
  return adminFetch(`/reservations/${id}/status-changes`);
}

export interface ReservationTermChangePayload {
  endDate: string | null;
  endTime: string;
  isIndefinite: boolean;
  note: string;
  changedBy: string;
}

export async function changeReservationTerm(id: number, payload: ReservationTermChangePayload) {
  return adminFetch(`/reservations/${id}/change-term`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getReservationTermChanges(id: number) {
  return adminFetch(`/reservations/${id}/term-changes`);
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

// =============================================
// DOCUMENT ARCHIVE
// =============================================

export type DocumentCategory =
  | 'contract' | 'invoice' | 'protocol' | 'identity' | 'insurance' | 'service' | 'other';

export interface AdminDocument {
  id: number;
  title: string;
  category: DocumentCategory;
  reservation_id: number | null;
  reservation_name: string | null;
  customer_email: string;
  document_date: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  source: 'manual' | 'system';
  notes: string;
  uploaded_by: string;
  archived_at: string | null;
  created_at: string;
}

export interface DocumentMetadataPayload {
  title: string;
  category: DocumentCategory;
  reservationId?: number | null;
  customerEmail?: string;
  documentDate?: string | null;
  notes?: string;
}

export async function getDocuments(filters: {
  archived?: boolean;
  category?: string;
  search?: string;
} = {}) {
  const params = new URLSearchParams();
  if (filters.archived !== undefined) params.set('archived', String(filters.archived));
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  return adminFetch(`/documents${query ? `?${query}` : ''}`);
}

export async function uploadDocument(file: File, metadata: DocumentMetadataPayload) {
  const body = new FormData();
  body.append('file', file);
  body.append('title', metadata.title);
  body.append('category', metadata.category);
  if (metadata.reservationId) body.append('reservationId', String(metadata.reservationId));
  if (metadata.customerEmail) body.append('customerEmail', metadata.customerEmail);
  if (metadata.documentDate) body.append('documentDate', metadata.documentDate);
  if (metadata.notes) body.append('notes', metadata.notes);

  const res = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body,
  });
  return res.json().catch(() => ({ success: false, message: 'Błąd odpowiedzi serwera' }));
}

export async function updateDocument(id: number, metadata: DocumentMetadataPayload) {
  return adminFetch(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(metadata),
  });
}

export async function setDocumentArchived(id: number, archived: boolean) {
  return adminFetch(`/documents/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify({ archived }),
  });
}

export async function deleteDocument(id: number) {
  return adminFetch(`/documents/${id}`, { method: 'DELETE' });
}

/** Streams the decrypted file and triggers a browser download. */
export async function downloadDocument(doc: Pick<AdminDocument, 'id' | 'file_name'>) {
  const res = await fetch(`${API_BASE}/documents/${doc.id}/download`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!res.ok) return { success: false, message: 'Nie udało się pobrać dokumentu' };
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = doc.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { success: true };
}

// =============================================
// DISCOUNTS
// =============================================

export type DiscountType = 'percent' | 'amount';

export interface AdminDiscount {
  id: number;
  name: string;
  description: string;
  discount_type: DiscountType;
  value: number;
  scope: 'all' | 'category' | 'product';
  scope_value: string;
  min_days: number;
  min_total: number;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
}

export interface DiscountPayload {
  name: string;
  description: string;
  discountType: DiscountType;
  value: number;
  scope: 'all' | 'category' | 'product';
  scopeValue: string;
  minDays: number;
  minTotal: number;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
}

export async function getDiscounts() {
  return adminFetch('/discounts');
}

export async function createDiscount(payload: DiscountPayload) {
  return adminFetch('/discounts', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateDiscount(id: number, payload: DiscountPayload) {
  return adminFetch(`/discounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteDiscount(id: number) {
  return adminFetch(`/discounts/${id}`, { method: 'DELETE' });
}

// =============================================
// COUPONS
// =============================================

export interface AdminCoupon {
  id: number;
  code: string;
  discount_type: DiscountType;
  value: number;
  status: 'active' | 'used' | 'cancelled';
  customer_email: string;
  customer_name: string;
  min_total: number;
  expires_on: string | null;
  issued_for_reservation_id: number | null;
  issued_for_name: string | null;
  used_reservation_id: number | null;
  used_at: string | null;
  note: string;
  email_sent_at: string | null;
  created_at: string;
}

export interface CouponPayload {
  discountType: DiscountType;
  value: number;
  customerEmail: string;
  customerName: string;
  minTotal: number;
  validDays: number;
  issuedForReservationId?: number | null;
  note: string;
  sendEmail: boolean;
}

export async function getCoupons(status?: string) {
  return adminFetch(status ? `/coupons?status=${encodeURIComponent(status)}` : '/coupons');
}

export async function createCoupon(payload: CouponPayload) {
  return adminFetch('/coupons', { method: 'POST', body: JSON.stringify(payload) });
}

export async function cancelCoupon(id: number) {
  return adminFetch(`/coupons/${id}/cancel`, { method: 'POST' });
}

export async function sendCouponByEmail(id: number, email?: string) {
  return adminFetch(`/coupons/${id}/send-email`, {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  });
}

/** Opens the printable voucher in a new tab. */
export async function openCouponPdf(id: number) {
  const res = await fetch(`${API_BASE}/coupons/${id}/pdf`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!res.ok) return { success: false, message: 'Nie udało się wygenerować kuponu' };
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { success: true };
}

// =============================================
// HANDOVER PHOTOS
// =============================================

export type PhotoPhase = 'before' | 'after';

export interface ReservationPhoto {
  id: number;
  reservation_id: number;
  product_id: string;
  phase: PhotoPhase;
  mime_type: string;
  size_bytes: number;
  note: string;
  taken_by: string;
  created_at: string;
}

export async function getReservationPhotos(reservationId: number) {
  return adminFetch(`/reservations/${reservationId}/photos`);
}

export async function uploadReservationPhoto(
  reservationId: number,
  file: File,
  meta: { phase: PhotoPhase; productId?: string; note?: string; takenBy?: string }
) {
  const body = new FormData();
  body.append('photo', file);
  body.append('phase', meta.phase);
  if (meta.productId) body.append('productId', meta.productId);
  if (meta.note) body.append('note', meta.note);
  if (meta.takenBy) body.append('takenBy', meta.takenBy);

  const res = await fetch(`${API_BASE}/reservations/${reservationId}/photos`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
    body,
  });
  // 413 przychodzi z nginxa jako HTML, więc bez tego użytkownik widziałby tylko "błąd serwera".
  const fallback = res.status === 413
    ? 'Zdjęcie jest za duże. Zrób je ponownie w niższej rozdzielczości.'
    : res.ok ? 'Błąd odpowiedzi serwera' : `Serwer odrzucił zdjęcie (HTTP ${res.status}).`;
  return res.json().catch(() => ({ success: false, message: fallback }));
}

export async function deleteReservationPhoto(photoId: number) {
  return adminFetch(`/photos/${photoId}`, { method: 'DELETE' });
}

/** Photos are private, so they need the auth header - not a plain <img src>. */
export async function loadPhotoObjectUrl(photoId: number): Promise<string | null> {
  const res = await fetch(`${API_BASE}/photos/${photoId}/file`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

/** Staff rental: same public endpoint, but the admin token unlocks price edits. */
export async function submitStaffReservation(payload: object) {
  const apiRoot = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const res = await fetch(`${apiRoot}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false, message: 'Błąd odpowiedzi serwera' }));
}

// =============================================
// BUSINESS SETTINGS
// =============================================

export interface BusinessSettings {
  company: {
    name: string; nip: string; regon: string; address: string;
    postalCode: string; city: string; bankAccount: string;
  };
  contact: { phone: string; email: string; openingHours: string; mapUrl: string };
  rental: {
    deliveryFee: number; weekendPickupFee: number; freeDeliveryFrom: number;
    depositDefault: number; minRentalDays: number; maxRentalDays: number; maxDeliveryKm: number;
  };
  coupons: {
    defaultValidDays: number; defaultType: DiscountType; defaultValue: number;
    autoIssueOnReturn: boolean; termsText: string;
  };
  notifications: {
    notifyOnReservation: boolean; notifyOnContractSigned: boolean;
    pickupReminderHours: number; returnReminderHours: number;
  };
  documents: { retentionMonths: number };
}

export async function getBusinessSettings() {
  return adminFetch('/settings');
}

export async function updateBusinessSettings(settings: BusinessSettings) {
  return adminFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

// API Service Layer for WB-Rent
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Types
export interface ApiError {
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: data.message || data.error || 'Wystąpił błąd',
          errors: data.errors,
        },
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error 
          ? error.message 
          : 'Nie można połączyć się z serwerem',
      },
    };
  }
}

// Reservation API
export interface ReservationPayload {
  productId: string;
  productName: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  days: number;
  delivery: boolean;
  city?: string;
  address?: string;
  weekendPickup: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  // Invoice data
  wantsInvoice: boolean;
  invoiceNip?: string;
  invoiceCompany?: string;
  invoiceAddress?: string;
  // Other
  notes?: string;
  totalPrice: number;
}

export interface ReservationResponse {
  id: number;
  message: string;
  /** Present when an online payment gateway is active */
  payment?: {
    redirectUrl: string;
    sessionId: string;
  } | null;
}

export async function submitReservation(
  payload: ReservationPayload
): Promise<ApiResponse<ReservationResponse>> {
  return apiFetch<ReservationResponse>('/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Contact API
export interface ContactPayload {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface ContactResponse {
  id: number;
  message: string;
}

export async function submitContact(
  payload: ContactPayload
): Promise<ApiResponse<ContactResponse>> {
  return apiFetch<ContactResponse>('/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Availability check API
export interface AvailabilityResponse {
  available: boolean;
  message: string;
  conflicts?: Array<{
    startDate: string;
    endDate: string;
    status: string;
  }>;
}

export async function checkAvailability(
  productId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<ApiResponse<AvailabilityResponse>> {
  const params = new URLSearchParams({ productId, startDate, endDate });
  return apiFetch<AvailabilityResponse>(
    `/reservations/check-availability?${params.toString()}`,
    { signal }
  );
}

// Blocked (reserved) date ranges for a product
export interface BlockedDatesResponse {
  productId: string;
  blockedDates: Array<{
    startDate: string;
    endDate: string;
    status: string;
  }>;
}

export async function getProductBlockedDates(
  productId: string,
  signal?: AbortSignal
): Promise<ApiResponse<BlockedDatesResponse>> {
  return apiFetch<BlockedDatesResponse>(
    `/reservations/product/${encodeURIComponent(productId)}`,
    { signal }
  );
}

// Products availability API - get today's availability for all products
export interface ProductsAvailabilityResponse {
  date: string;
  availability: Record<string, boolean>;
  reservedCount: number;
  totalProducts: number;
}

export async function getProductsAvailability(): Promise<ApiResponse<ProductsAvailabilityResponse>> {
  return apiFetch<ProductsAvailabilityResponse>('/products/availability');
}

// Notify me when product is available
export interface NotifyAvailabilityPayload {
  productId: string;
  email: string;
}

export async function notifyWhenAvailable(
  payload: NotifyAvailabilityPayload
): Promise<ApiResponse<{ message: string }>> {
  return apiFetch<{ message: string }>('/notifications/product', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// === PAYMENTS ===
export interface PaymentConfigResponse {
  enabled: boolean;
  provider: 'payu' | 'przelewy24' | 'stripe' | null;
}

export async function getPaymentConfig(): Promise<ApiResponse<PaymentConfigResponse>> {
  return apiFetch<PaymentConfigResponse>('/payments/config');
}

export interface PaymentStatusResponse {
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  amount: number;
  reservationId: number;
  provider: string;
}

export async function getPaymentStatus(
  sessionId: string
): Promise<ApiResponse<PaymentStatusResponse>> {
  return apiFetch<PaymentStatusResponse>(`/payments/status/${encodeURIComponent(sessionId)}`);
}

export interface CreatePaymentResponse {
  redirectUrl: string;
  sessionId: string;
}

export async function createPayment(
  reservationId: number,
  email: string
): Promise<ApiResponse<CreatePaymentResponse>> {
  return apiFetch<CreatePaymentResponse>('/payments/create', {
    method: 'POST',
    body: JSON.stringify({ reservationId, email }),
  });
}

// === MOJE REZERWACJE (magic-link) ===
export interface MyReservation {
  id: number;
  product_id: string;
  productName: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  status: string;
  days: number;
  total_price: number;
  delivery: number;
  city?: string;
  created_at: string;
  payment_status?: string;
  payment_provider?: string;
}

export async function requestMyReservationsLink(
  email: string
): Promise<ApiResponse<{ message: string }>> {
  return apiFetch<{ message: string }>('/my-reservations/request-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export interface MyReservationsResponse {
  email: string;
  data: MyReservation[];
}

export async function getMyReservations(
  token: string
): Promise<ApiResponse<MyReservationsResponse>> {
  return apiFetch<MyReservationsResponse>(`/my-reservations?token=${encodeURIComponent(token)}`);
}

export async function cancelMyReservation(
  id: number,
  token: string
): Promise<ApiResponse<{ message: string }>> {
  return apiFetch<{ message: string }>(`/my-reservations/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// === ELECTRONIC RENTAL CONTRACTS ===
export interface ContractSnapshot {
  contractNumber: string;
  templateVersion: string;
  generatedAt: string;
  lessor: { name: string; address: string; nip: string; representative: string };
  renter: {
    name: string;
    email: string;
    phone: string;
    address: string;
    documentType: 'dowod_osobisty' | 'paszport';
    documentNumber: string;
    pesel?: string;
  };
  rental: {
    reservationId: number;
    productId: string;
    productName: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    days: number;
    totalPrice: number;
    deposit: number;
    delivery: boolean;
    deliveryAddress?: string;
    accessories: string;
    conditionNotes: string;
  };
  clauses: Array<{ number: number; title: string; text: string }>;
}

export interface ContractPreviewResponse {
  id: number;
  status: string;
  contentHash: string;
  signedAt?: string | null;
  snapshot: ContractSnapshot;
}

export async function getContractPreview(token: string): Promise<ApiResponse<ContractPreviewResponse>> {
  return apiFetch<ContractPreviewResponse>(`/contracts/sign/${encodeURIComponent(token)}`);
}

export interface SignContractResponse {
  contractNumber: string;
  pdfHash: string;
  pdfUrl: string;
  payment?: { redirectUrl: string; sessionId: string } | null;
}

export async function submitContractSignature(
  token: string,
  signature: string,
  accepted: boolean
): Promise<ApiResponse<SignContractResponse>> {
  return apiFetch<SignContractResponse>(`/contracts/sign/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ signature, accepted }),
  });
}

// Export all API functions
export const api = {
  submitReservation,
  submitContact,
  checkAvailability,
  getProductsAvailability,
  notifyWhenAvailable,
};

export default api;

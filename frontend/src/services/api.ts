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
          message: data.error || 'Wystąpił błąd',
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
  notes?: string;
  totalPrice: number;
}

export interface ReservationResponse {
  id: number;
  message: string;
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
  endDate: string
): Promise<ApiResponse<AvailabilityResponse>> {
  return apiFetch<AvailabilityResponse>(
    `/availability/${productId}?startDate=${startDate}&endDate=${endDate}`
  );
}

// Export all API functions
export const api = {
  submitReservation,
  submitContact,
  checkAvailability,
};

export default api;

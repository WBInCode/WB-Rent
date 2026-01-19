import { useState, useCallback } from 'react';
import { type ApiResponse } from '@/services/api';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseSubmitFormOptions<TResponse> {
  onSuccess?: (data: TResponse) => void;
  onError?: (error: string) => void;
  resetOnSuccess?: boolean;
  successTimeout?: number;
}

interface UseSubmitFormReturn<TData, TResponse> {
  status: SubmitStatus;
  error: string | null;
  data: TResponse | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  submit: (payload: TData) => Promise<void>;
  reset: () => void;
}

export function useSubmitForm<TData, TResponse>(
  submitFn: (data: TData) => Promise<ApiResponse<TResponse>>,
  options: UseSubmitFormOptions<TResponse> = {}
): UseSubmitFormReturn<TData, TResponse> {
  const { 
    onSuccess, 
    onError, 
    resetOnSuccess = false,
    successTimeout = 5000,
  } = options;

  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TResponse | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setData(null);
  }, []);

  const submit = useCallback(async (payload: TData) => {
    setStatus('loading');
    setError(null);

    try {
      const response = await submitFn(payload);

      if (response.success && response.data) {
        setStatus('success');
        setData(response.data);
        onSuccess?.(response.data);

        // Auto-reset after success if configured
        if (resetOnSuccess && successTimeout > 0) {
          setTimeout(() => {
            reset();
          }, successTimeout);
        }
      } else {
        const errorMessage = response.error?.message || 'Wystąpił nieznany błąd';
        setStatus('error');
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Nie można połączyć się z serwerem';
      setStatus('error');
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [submitFn, onSuccess, onError, resetOnSuccess, successTimeout, reset]);

  return {
    status,
    error,
    data,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    submit,
    reset,
  };
}

import { createContext, useContext, useState, type ReactNode } from 'react';

interface ReservationPreFill {
  categoryId: string;
  productId: string;
  startDate: string;
  endDate: string;
  city: string;
  delivery: boolean;
}

interface ReservationContextType {
  preFillData: ReservationPreFill | null;
  setPreFillData: (data: ReservationPreFill | null) => void;
  clearPreFillData: () => void;
}

const ReservationContext = createContext<ReservationContextType | undefined>(undefined);

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [preFillData, setPreFillData] = useState<ReservationPreFill | null>(null);

  const clearPreFillData = () => setPreFillData(null);

  return (
    <ReservationContext.Provider value={{ preFillData, setPreFillData, clearPreFillData }}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservationContext() {
  const context = useContext(ReservationContext);
  if (!context) {
    throw new Error('useReservationContext must be used within ReservationProvider');
  }
  return context;
}

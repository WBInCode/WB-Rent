import { useState, useEffect, useEffectEvent } from 'react';
import { 
  adminLogin, 
  adminLogout, 
  isAdminLoggedIn, 
  getStats, 
  getReservations, 
  updateReservationStatus,
  getReservationStatusChanges,
  changeReservationTerm,
  getReservationTermChanges,
  getContacts,
  updateContactStatus,
  replyToContact,
  deleteContact,
  deleteContacts,
  getRevenue,
  sendReminders,
  getNewsletterSubscribers,
  getNewsletterPosts,
  createNewsletterPost,
  deleteNewsletterPost,
  sendNewsletterPost,
  deleteNewsletterSubscriber,
  getProductNotifications,
  deleteNotification,
  sendProductNotifications,
  changeAdminPassword,
  createContractSession,
  getReservationContract,
  downloadContractPdf,
  resendContractEmail,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  type AdminProduct,
  type ProductInventoryPayload,
  type CreateContractPayload,
} from '@/services/adminApi';
import { products } from '@/data/products';
import { Button, Card, Badge, Input, Select, Textarea } from '@/components/ui';
import { AdminAvailabilityCalendar } from '@/components/AdminAvailabilityCalendar';
import { ProductInventoryPanel } from '@/components/ProductInventoryPanel';
import DocumentsPanel from '@/components/DocumentsPanel';
import DiscountsPanel from '@/components/DiscountsPanel';
import CouponsPanel from '@/components/CouponsPanel';
import BusinessSettingsPanel from '@/components/BusinessSettingsPanel';
import { HandoverPhotos } from '@/components/HandoverPhotos';
import { PaymentLinkPanel } from '@/components/PaymentLinkPanel';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { 
  LogOut, 
  RefreshCw, 
  Calendar, 
  Mail, 
  DollarSign, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Phone,
  Package,
  Send,
  X,
  MessageSquare,
  Trash2,
  CheckSquare,
  Square,
  TrendingUp,
  Bell,
  Users,
  FileText,
  Plus,
  Settings,
  FileSignature,
  Download,
  Copy,
  ExternalLink,
  Loader2,
  CalendarDays,
  Menu,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  CalendarPlus,
  History,
  Infinity as InfinityIcon,
  Check,
  BadgePercent,
  Ticket,
  FolderArchive,
  Building2,
} from 'lucide-react';

type AdminTab = 'reservations' | 'products' | 'calendar' | 'contacts' | 'revenue' | 'reminders' | 'newsletter' | 'notifications' | 'documents' | 'discounts' | 'coupons' | 'business' | 'settings';

const VIEW_META: Record<AdminTab, { title: string; description: string }> = {
  reservations: { title: 'Rezerwacje', description: 'Obsługa wynajmów, umów, płatności i wydań sprzętu.' },
  products: { title: 'Produkty i magazyn', description: 'Oferta, ilości, dostępność oraz stan techniczny floty.' },
  calendar: { title: 'Kalendarz zajętości', description: 'Miesięczny widok wykorzystania całej floty.' },
  contacts: { title: 'Wiadomości', description: 'Kontakt z klientami i historia odpowiedzi.' },
  revenue: { title: 'Przychody', description: 'Wyniki sprzedaży, płatności oczekujące i trendy.' },
  reminders: { title: 'Przypomnienia', description: 'Powiadomienia o odbiorach i zwrotach sprzętu.' },
  newsletter: { title: 'Newsletter', description: 'Subskrybenci, publikacje i wysyłki.' },
  notifications: { title: 'Dostępność', description: 'Klienci oczekujący na zwolnienie urządzeń.' },
  documents: { title: 'Dokumenty', description: 'Archiwum umów, faktur i protokołów. Pliki są szyfrowane.' },
  discounts: { title: 'Rabaty', description: 'Promocje naliczane automatycznie przy rezerwacji.' },
  coupons: { title: 'Kupony', description: 'Kody rabatowe na kolejny najem — mail i wydruk.' },
  business: { title: 'Dane firmy', description: 'Dane kontaktowe, zasady najmu i wartości domyślne.' },
  settings: { title: 'Ustawienia', description: 'Bezpieczeństwo konta i konfiguracja panelu.' },
};

interface Reservation {
  id: number;
  product_id: string;
  items?: Array<{
    product_id: string;
    category_id: string;
    item_price: number;
    position: number;
  }>;
  category_id: string;
  start_date: string;
  end_date: string | null;
  is_indefinite: boolean;
  start_time?: string;
  end_time?: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  delivery: number;
  days: number;
  base_price: number;
  delivery_fee: number;
  total_price: number;
  status: string;
  notes?: string;
  // Invoice data
  wants_invoice: number;
  invoice_nip?: string;
  invoice_company?: string;
  invoice_address?: string;
  // Payments
  payment_status?: string;
  payment_provider?: string;
  contract_status?: 'not_prepared' | 'ready' | 'signed';
  created_at: string;
}

interface ReservationTermChange {
  id: number;
  previous_end_date: string | null;
  new_end_date: string | null;
  previous_is_indefinite: boolean;
  new_is_indefinite: boolean;
  previous_total_price: number;
  new_total_price: number;
  price_delta: number;
  note: string;
  changed_by: string;
  created_at: string;
}

interface ReservationStatusChange {
  id: number;
  previous_status: string;
  new_status: string;
  note: string;
  changed_by: string;
  notify_customer: boolean;
  created_at: string;
}

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const nextDay = (value?: string | null) => {
  const date = value ? new Date(`${value.slice(0, 10)}T12:00:00`) : new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
};

interface Contact {
  id: number;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: string;
  created_at: string;
}

interface Stats {
  reservations: {
    total: number;
    pending: number;
    confirmed: number;
    picked_up: number;
    returned: number;
    completed: number;
    rejected: number;
  };
  contacts: {
    total: number;
    new: number;
  };
  revenue: {
    today: number;
    month: number;
    total: number;
    pending: number;
  };
}

interface RevenueData {
  today: number;
  month: number;
  total: number;
  pending: number;
  byMonth: { month: string; revenue: number; count: number }[];
}

interface NewsletterSubscriber {
  id: number;
  email: string;
  name: string | null;
  status: string;
  created_at: string;
  unsubscribed_at: string | null;
}

interface NewsletterPost {
  id: number;
  title: string;
  content: string;
  status: string;
  sent_count: number;
  created_at: string;
  sent_at: string | null;
}

interface ProductNotification {
  id: number;
  product_id: string;
  productName: string;
  email: string;
  status: string;
  created_at: string;
  notified_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Oczekuje',
  confirmed: 'Potwierdzona',
  picked_up: 'Wydane',
  returned: 'Zwrócone',
  completed: 'Zakończona',
  rejected: 'Odrzucona',
  cancelled: 'Anulowana',
  new: 'Nowa',
  read: 'Przeczytana',
  replied: 'Odpowiedziano',
  archived: 'Zarchiwizowana',
};

const STATUS_COLORS: Record<string, 'warning' | 'success' | 'error' | 'default' | 'info'> = {
  pending: 'warning',
  confirmed: 'success',
  picked_up: 'info',
  returned: 'info',
  completed: 'success',
  rejected: 'error',
  cancelled: 'error',
  new: 'warning',
  read: 'default',
  replied: 'success',
  archived: 'default',
};

const RESERVATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Oczekuje' },
  { value: 'confirmed', label: 'Potwierdzona' },
  { value: 'picked_up', label: 'Wydane' },
  { value: 'returned', label: 'Zwrócone' },
  { value: 'completed', label: 'Zakończona' },
  { value: 'rejected', label: 'Odrzucona' },
  { value: 'cancelled', label: 'Anulowana' },
];

const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Przywraca rezerwację do kolejki oczekujących.',
  confirmed: 'Potwierdza termin i gotowość realizacji rezerwacji.',
  picked_up: 'Oznacza sprzęt jako wydany. Wymaga podpisanej umowy.',
  returned: 'Potwierdza fizyczny zwrot sprzętu i zwalnia termin.',
  completed: 'Kończy proces po zwrocie i rozliczeniu wynajmu.',
  rejected: 'Odrzuca rezerwację i zwalnia sprzęt dla innych klientów.',
  cancelled: 'Anuluje rezerwację i zwalnia zajęty termin.',
};

const CUSTOMER_STATUS_EMAILS = ['confirmed', 'rejected', 'picked_up', 'returned'];

// Product id -> display name (from the shared catalog)
const PRODUCT_NAMES: Record<string, string> = Object.fromEntries(
  products.map((p) => [p.id, p.name])
);

const reservationItems = (reservation: Reservation) => reservation.items?.length
  ? reservation.items
  : [{
      product_id: reservation.product_id,
      category_id: reservation.category_id,
      item_price: reservation.base_price,
      position: 0,
    }];

const reservationProductLabel = (reservation: Reservation) =>
  reservationItems(reservation)
    .map((item) => PRODUCT_NAMES[item.product_id] || item.product_id)
    .join(', ');

// CSV export (Excel-friendly: BOM + semicolon separator for PL locale)
function exportToCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeCell = (cell: string | number | null | undefined): string => {
    const s = cell == null ? '' : String(cell);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(';'))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(isAdminLoggedIn());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<AdminTab>('reservations');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Change password form state
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventoryProducts, setInventoryProducts] = useState<AdminProduct[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [statusFor, setStatusFor] = useState<Reservation | null>(null);
  const [statusHistoryOnly, setStatusHistoryOnly] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusHistory, setStatusHistory] = useState<ReservationStatusChange[]>([]);
  const [statusForm, setStatusForm] = useState({
    targetStatus: 'pending',
    note: '',
    changedBy: localStorage.getItem('wb-rent-employee-name') || '',
    notifyCustomer: false,
  });

  const [termFor, setTermFor] = useState<Reservation | null>(null);
  const [termSaving, setTermSaving] = useState(false);
  const [termHistory, setTermHistory] = useState<ReservationTermChange[]>([]);
  const [termForm, setTermForm] = useState({
    endDate: formatLocalDate(new Date()),
    endTime: '09:00',
    isIndefinite: false,
    note: '',
    changedBy: localStorage.getItem('wb-rent-employee-name') || '',
  });

  // Employee-assisted rental contract / kiosk flow
  const [contractFor, setContractFor] = useState<Reservation | null>(null);
  const [contractSaving, setContractSaving] = useState(false);
  const [contractSession, setContractSession] = useState<{
    signingUrl: string;
    contractNumber: string;
    expiresAt: string;
  } | null>(null);
  const [contractSignedId, setContractSignedId] = useState<number | null>(null);
  const [contractForm, setContractForm] = useState<Omit<CreateContractPayload, 'reservationId'>>({
    renterAddress: '',
    documentType: 'dowod_osobisty',
    documentNumber: '',
    pesel: '',
    employeeName: localStorage.getItem('wb-rent-employee-name') || '',
    deposit: 300,
    accessories: '',
    conditionNotes: 'Sprzęt sprawny, kompletny, bez widocznych uszkodzeń.',
  });

  // Reply modal state
  const [replyingTo, setReplyingTo] = useState<Contact | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // Contact selection state for deletion
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Revenue state
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);

  // Newsletter state
  const [newsletterSubscribers, setNewsletterSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [newsletterPosts, setNewsletterPosts] = useState<NewsletterPost[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Product notifications state
  const [productNotifications, setProductNotifications] = useState<ProductNotification[]>([]);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);

  // Custom toast/alert state
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Custom confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);  };

  /** Toast bridge for the standalone module panels. */
  const notifyPanel = (message: string, tone: 'success' | 'error' = 'success') =>
    showToast(tone, message);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const openContractModal = (reservation: Reservation) => {
    const product = products.find((item) => item.id === reservation.product_id);
    setContractSession(null);
    setContractSignedId(null);
    setContractFor(reservation);
    setContractForm((current) => ({
      ...current,
      renterAddress: reservation.address || '',
      documentNumber: '',
      pesel: '',
      accessories: product?.includedAccessories.join(', ') || 'Urządzenie wraz ze standardowym wyposażeniem',
      conditionNotes: 'Sprzęt sprawny, kompletny, bez widocznych uszkodzeń.',
    }));
  };

  const openStatusModal = async (reservation: Reservation, targetStatus: string) => {
    if (targetStatus === reservation.status) return;
    setStatusHistoryOnly(false);
    setStatusFor(reservation);
    setStatusHistory([]);
    setStatusForm({
      targetStatus,
      note: '',
      changedBy: localStorage.getItem('wb-rent-employee-name') || '',
      notifyCustomer: CUSTOMER_STATUS_EMAILS.includes(targetStatus),
    });
    const response = await getReservationStatusChanges(reservation.id);
    if (response.success && Array.isArray(response.data)) {
      setStatusHistory(response.data);
    }
  };

  const openStatusHistory = async (reservation: Reservation) => {
    setStatusHistoryOnly(true);
    setStatusFor(reservation);
    setStatusHistory([]);
    const response = await getReservationStatusChanges(reservation.id);
    if (response.success && Array.isArray(response.data)) {
      setStatusHistory(response.data);
    }
  };

  const handleManualStatusChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusFor) return;
    setStatusSaving(true);
    const response = await updateReservationStatus(statusFor.id, statusForm.targetStatus, {
      note: statusForm.note.trim(),
      changedBy: statusForm.changedBy.trim(),
      notifyCustomer: statusForm.notifyCustomer,
    });
    if (response.success) {
      localStorage.setItem('wb-rent-employee-name', statusForm.changedBy.trim());
      setReservations((current) => current.map((reservation) =>
        reservation.id === statusFor.id
          ? { ...reservation, status: statusForm.targetStatus }
          : reservation
      ));
      showToast('success', `${response.message}${statusForm.notifyCustomer ? ' • klient powiadomiony' : ''}`);
      setStatusFor(null);
      void loadData();
    } else {
      showToast('error', response.message || 'Nie udało się zmienić statusu');
    }
    setStatusSaving(false);
  };

  const openTermModal = async (reservation: Reservation) => {
    setTermFor(reservation);
    setTermHistory([]);
    setTermForm({
      endDate: reservation.is_indefinite
        ? formatLocalDate(new Date())
        : nextDay(reservation.end_date),
      endTime: reservation.end_time || '09:00',
      isIndefinite: false,
      note: '',
      changedBy: localStorage.getItem('wb-rent-employee-name') || '',
    });
    const response = await getReservationTermChanges(reservation.id);
    if (response.success && Array.isArray(response.data)) {
      setTermHistory(response.data);
    }
  };

  const handleTermChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!termFor) return;
    setTermSaving(true);
    const response = await changeReservationTerm(termFor.id, {
      endDate: termForm.isIndefinite ? null : termForm.endDate,
      endTime: termForm.endTime,
      isIndefinite: termForm.isIndefinite,
      note: termForm.note.trim(),
      changedBy: termForm.changedBy.trim(),
    });
    if (response.success) {
      localStorage.setItem('wb-rent-employee-name', termForm.changedBy.trim());
      const delta = Number(response.data?.priceDelta || 0);
      showToast(
        'success',
        `${response.message}${delta > 0 ? ` • dopłata ${delta.toFixed(2)} zł` : ''}${response.data?.emailDelivered ? ' • klient powiadomiony' : ''}`
      );
      setTermFor(null);
      void loadData();
    } else {
      showToast('error', response.message || 'Nie udało się zmienić terminu');
    }
    setTermSaving(false);
  };

  useEffect(() => {
    if (!contractSession || !contractFor || contractSignedId) return;
    let stopped = false;
    const check = async () => {
      const response = await getReservationContract(contractFor.id);
      if (stopped) return;
      if (response.success && response.data?.status === 'signed') {
        setContractSignedId(response.data.id);
        showToast('success', 'Klient podpisał umowę');
        loadDataEvent();
      }
    };
    void check();
    const interval = window.setInterval(check, 3000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [contractSession, contractFor, contractSignedId]);

  const handlePrepareContract = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contractFor) return;
    setContractSaving(true);
    const response = await createContractSession({
      reservationId: contractFor.id,
      ...contractForm,
      deposit: Number(contractForm.deposit),
    });
    if (response.success && response.data) {
      localStorage.setItem('wb-rent-employee-name', contractForm.employeeName);
      setContractSession(response.data);
      showToast('success', 'Umowa gotowa do podpisu');
      void loadData();
    } else {
      showToast('error', response.message || 'Nie udało się przygotować umowy');
    }
    setContractSaving(false);
  };

  const handleDownloadReservationContract = async (reservationId: number) => {
    try {
      const response = await getReservationContract(reservationId);
      if (!response.success || !response.data?.id) throw new Error(response.message);
      await downloadContractPdf(response.data.id);
    } catch {
      showToast('error', 'Nie udało się pobrać podpisanej umowy');
    }
  };

  const handleResendReservationContract = async (reservationId: number) => {
    try {
      const response = await getReservationContract(reservationId);
      if (!response.success || !response.data?.id) throw new Error(response.message);
      const result = await resendContractEmail(response.data.id);
      if (!result.success) throw new Error(result.message);
      showToast('success', result.message || 'Umowa została wysłana ponownie');
      void loadData();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Nie udało się wysłać umowy');
    }
  };

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  const loadDataEvent = useEffectEvent(() => {
    void loadData();
  });

  // Load data on login
  useEffect(() => {
    if (isLoggedIn) {
      loadDataEvent();
    }
  }, [isLoggedIn]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const interval = setInterval(() => {
      loadDataEvent();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, reservationsRes, productsRes, contactsRes, revenueRes, subscribersRes, postsRes, notificationsRes] = await Promise.all([
        getStats(),
        getReservations(statusFilter !== 'all' ? statusFilter : undefined),
        getAdminProducts(),
        getContacts(),
        getRevenue(),
        getNewsletterSubscribers(),
        getNewsletterPosts(),
        getProductNotifications(),
      ]);
      
      if (statsRes.success) setStats(statsRes.data);
      if (reservationsRes.success) setReservations(reservationsRes.data);
      if (productsRes.success) setInventoryProducts(productsRes.data);
      if (contactsRes.success) setContacts(contactsRes.data);
      if (revenueRes.success) setRevenueData(revenueRes.data);
      if (subscribersRes.success) setNewsletterSubscribers(subscribersRes.data);
      if (postsRes.success) setNewsletterPosts(postsRes.data);
      if (notificationsRes.success) setProductNotifications(notificationsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const result = await adminLogin(password);
    if (result.success) {
      setIsLoggedIn(true);
      setPassword('');
    } else {
      setLoginError(result.message || 'Błąd logowania');
    }
  };

  const handleLogout = () => {
    adminLogout();
    setIsLoggedIn(false);
    setStats(null);
    setReservations([]);
    setInventoryProducts([]);
    setContacts([]);
  };

  const handleSaveProduct = async (payload: ProductInventoryPayload, editingId?: string) => {
    const result = editingId
      ? await updateAdminProduct(editingId, payload)
      : await createAdminProduct(payload);
    if (!result.success) {
      showToast('error', result.message || 'Nie udało się zapisać produktu');
      return false;
    }
    showToast('success', result.message || 'Produkt został zapisany');
    await loadData();
    return true;
  };

  const handleDeleteProduct = (product: AdminProduct) => {
    showConfirm(`Usunąć produkt „${product.name}”?`, async () => {
      const result = await deleteAdminProduct(product.id);
      if (!result.success) {
        showToast('error', result.message || 'Nie udało się usunąć produktu');
        return;
      }
      showToast('success', result.message || 'Produkt został usunięty');
      await loadData();
    });
  };

  // Toggle contact selection
  const toggleContactSelection = (id: number) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select/deselect all contacts
  const toggleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  // Delete selected contacts
  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return;
    
    const confirmMsg = selectedContacts.length === 1 
      ? 'Czy na pewno chcesz usunąć tę wiadomość?' 
      : `Czy na pewno chcesz usunąć ${selectedContacts.length} wiadomości?`;
    
    showConfirm(confirmMsg, async () => {
      setDeleting(true);
      try {
        const result = await deleteContacts(selectedContacts);
        if (result.success) {
          setContacts(prev => prev.filter(c => !selectedContacts.includes(c.id)));
          setSelectedContacts([]);
          showToast('success', 'Wiadomości usunięte');
          loadData();
        } else {
          showToast('error', result.message || 'Błąd usuwania');
        }
      } catch {
        showToast('error', 'Błąd usuwania wiadomości');
      }
      setDeleting(false);
    });
  };

  // Delete single contact
  const handleDeleteContact = async (id: number) => {
    showConfirm('Czy na pewno chcesz usunąć tę wiadomość?', async () => {
      try {
        const result = await deleteContact(id);
        if (result.success) {
          setContacts(prev => prev.filter(c => c.id !== id));
          showToast('success', 'Wiadomość usunięta');
          loadData();
        } else {
          showToast('error', result.message || 'Błąd usuwania');
        }
      } catch {
        showToast('error', 'Błąd usuwania wiadomości');
      }
    });
  };

  const handleReplySubmit = async () => {
    if (!replyingTo || !replyMessage.trim()) return;
    
    setReplySending(true);
    try {
      const result = await replyToContact(replyingTo.id, replyMessage.trim());
      if (result.success) {
        setReplySuccess(true);
        // Update contact status in list
        setContacts(prev => 
          prev.map(c => c.id === replyingTo.id ? { ...c, status: 'replied' } : c)
        );
        // Close modal after short delay
        setTimeout(() => {
          setReplyingTo(null);
          setReplyMessage('');
          setReplySuccess(false);
          loadData(); // Refresh all data
        }, 1500);
      } else {
        showToast('error', result.message || 'Błąd wysyłania odpowiedzi');
      }
    } catch (error) {
      console.error('Reply error:', error);
      showToast('error', 'Błąd wysyłania odpowiedzi');
    }
    setReplySending(false);
  };

  const openReplyModal = (contact: Contact) => {
    setReplyingTo(contact);
    setReplyMessage('');
    setReplySuccess(false);
  };

  const handleStatusChange = async (id: number, newStatus: string, type: 'reservation' | 'contact') => {
    if (type === 'reservation') {
      const result = await updateReservationStatus(id, newStatus, {
        note: `Szybka akcja: ${STATUS_LABELS[newStatus] || newStatus}`,
        changedBy: localStorage.getItem('wb-rent-employee-name') || 'Panel administratora',
      });
      if (result.success) {
        setReservations(prev => 
          prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
        );
        showToast('success', result.message || 'Status został zmieniony');
        void loadData(); // Refresh stats
      } else {
        showToast('error', result.message || 'Nie udało się zmienić statusu');
      }
    } else {
      const result = await updateContactStatus(id, newStatus);
      if (result.success) {
        setContacts(prev => 
          prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
        );
        void loadData();
      } else {
        showToast('error', result.message || 'Nie udało się zmienić statusu');
      }
    }
  };

  const navigationGroups = [
    {
      label: 'Operacje',
      items: [
        { id: 'reservations' as const, label: 'Rezerwacje', icon: Calendar, badge: reservations.length },
        { id: 'products' as const, label: 'Produkty i magazyn', icon: Package, badge: inventoryProducts.filter((product) => Number(product.available_today) === 0).length || undefined },
        { id: 'calendar' as const, label: 'Kalendarz', icon: CalendarDays, badge: undefined },
        { id: 'revenue' as const, label: 'Przychody', icon: TrendingUp, badge: undefined },
      ],
    },
    {
      label: 'Komunikacja',
      items: [
        { id: 'contacts' as const, label: 'Wiadomości', icon: MessageSquare, badge: stats?.contacts.new || undefined },
        { id: 'reminders' as const, label: 'Przypomnienia', icon: Clock, badge: undefined },
        { id: 'newsletter' as const, label: 'Newsletter', icon: Mail, badge: newsletterSubscribers.filter((item) => item.status === 'active').length || undefined },
        { id: 'notifications' as const, label: 'Dostępność', icon: Bell, badge: productNotifications.filter((item) => item.status === 'waiting').length || undefined },
      ],
    },
    {
      label: 'Sprzedaż',
      items: [
        { id: 'discounts' as const, label: 'Rabaty', icon: BadgePercent, badge: undefined },
        { id: 'coupons' as const, label: 'Kupony', icon: Ticket, badge: undefined },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'documents' as const, label: 'Dokumenty', icon: FolderArchive, badge: undefined },
        { id: 'business' as const, label: 'Dane firmy', icon: Building2, badge: undefined },
        { id: 'settings' as const, label: 'Ustawienia', icon: Settings, badge: undefined },
      ],
    },
  ];

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const currentView = VIEW_META[activeTab];

  // Login form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-4xl grid md:grid-cols-[0.85fr_1.15fr] rounded-[--radius-sm] overflow-hidden border border-white/10 shadow-2xl bg-[#101010]">
          <div className="relative p-8 sm:p-10 bg-[#0d0d0d] border-b md:border-b-0 md:border-r border-white/10 overflow-hidden">
            <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
            <img src="/logo.png" alt="WB-Rent" className="h-14 w-auto relative" />
            <div className="relative mt-12">
              <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold">Panel operacyjny</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-3 leading-tight">Obsługa wynajmów w jednym miejscu</h1>
              <p className="text-sm text-text-secondary mt-4 leading-relaxed">
                Rezerwacje, umowy elektroniczne, płatności, wydania i kontakt z klientem.
              </p>
            </div>
            <div className="relative mt-10 space-y-3 text-xs text-text-muted">
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-400" /> Szyfrowana sesja pracownika</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> Automatyczne wylogowanie po 8 godzinach</div>
            </div>
          </div>

          <div className="p-8 sm:p-12 flex flex-col justify-center">
            <div className="max-w-sm w-full mx-auto">
              <p className="text-xs text-text-muted uppercase tracking-wider">Dostęp pracownika</p>
              <h2 className="text-2xl font-bold mt-2">Zaloguj się</h2>
              <p className="text-sm text-text-secondary mt-2 mb-7">Wprowadź hasło panelu, aby rozpocząć pracę.</p>
              <form onSubmit={handleLogin} className="space-y-5">
                <Input
                  type="password"
                  label="Hasło"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wprowadź hasło admina"
                  error={loginError}
                  autoFocus
                />
                <Button type="submit" className="w-full" size="lg">
                  Zaloguj się
                </Button>
              </form>
              <p className="text-[11px] text-text-muted text-center mt-6">
                Dostęp wyłącznie dla upoważnionych pracowników WB-Rent.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-[#090909] text-text-primary">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Zamknij menu"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[258px] bg-[#0d0d0d] border-r border-white/10 flex flex-col transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-[82px] px-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="WB-Rent" className="h-10 w-auto" />
            <div className="border-l border-white/15 pl-3">
              <p className="text-xs font-semibold text-white">Panel</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Operacyjny</p>
            </div>
          </div>
          <button type="button" className="lg:hidden p-2 text-text-muted hover:text-white" onClick={() => setSidebarOpen(false)} aria-label="Zamknij menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-5">
          <Button variant="primary" className="w-full" onClick={() => window.location.assign('/admin/nowy-wynajem')}>
            <Plus className="w-4 h-4 mr-2" /> Nowy wynajem
          </Button>
        </div>

        <nav className="flex-1 px-3 pb-5 overflow-y-auto" aria-label="Moduły panelu">
          {navigationGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/70">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        active ? 'bg-gold/12 text-gold border border-gold/20' : 'text-text-secondary border border-transparent hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                      <span className="font-medium">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`ml-auto min-w-5 h-5 px-1.5 rounded-md text-[10px] font-bold flex items-center justify-center ${active ? 'bg-gold text-black' : 'bg-white/[0.07] text-text-muted'}`}>
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.025]">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">System aktywny</p>
              <p className="text-[10px] text-text-muted">Bezpieczna sesja admina</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-30 h-[82px] bg-[#0b0b0b]/95 backdrop-blur-xl border-b border-white/10">
          <div className="h-full px-4 sm:px-6 xl:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" className="lg:hidden p-2 rounded-lg border border-border text-text-secondary" onClick={() => setSidebarOpen(true)} aria-label="Otwórz menu">
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">{currentView.title}</h1>
                <p className="hidden sm:block text-xs text-text-muted mt-0.5 truncate">{currentView.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} aria-label="Odśwież dane">
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Odśwież</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Wyloguj">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Wyloguj</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 xl:px-8 py-6 xl:py-8 max-w-[1600px] mx-auto">
          {stats && activeTab !== 'products' && (
            <div className="grid grid-cols-2 xl:grid-cols-4 rounded-[--radius-sm] border border-white/10 bg-[#101010] overflow-hidden mb-7 divide-x divide-y xl:divide-y-0 divide-white/10">
              <Metric icon={<Calendar className="w-5 h-5" />} label="Wszystkie rezerwacje" value={stats.reservations.total} tone="gold" />
              <Metric icon={<Clock className="w-5 h-5" />} label="Wymagają decyzji" value={stats.reservations.pending} tone="amber" />
              <Metric icon={<DollarSign className="w-5 h-5" />} label="Przychód dzisiaj" value={`${stats.revenue.today} zł`} tone="green" />
              <Metric icon={<MessageSquare className="w-5 h-5" />} label="Nowe wiadomości" value={stats.contacts.new} tone="blue" />
            </div>
          )}

        {/* Reservations Tab */}
        {activeTab === 'reservations' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2 p-2 rounded-[--radius-sm] border border-white/10 bg-[#101010] overflow-x-auto">
              <div className="flex gap-1.5 items-center min-w-max">
              {['all', 'pending', 'confirmed', 'picked_up', 'returned', 'completed', 'rejected'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(status);
                    if (status !== 'all') {
                      getReservations(status).then(res => {
                        if (res.success) setReservations(res.data);
                      });
                    } else {
                      getReservations().then(res => {
                        if (res.success) setReservations(res.data);
                      });
                    }
                  }}
                >
                  {status === 'all' ? 'Wszystkie' : STATUS_LABELS[status]}
                </Button>
              ))}
              </div>
              <div className="ml-auto shrink-0 pl-2 border-l border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    exportToCsv(
                      `rezerwacje-${new Date().toISOString().slice(0, 10)}.csv`,
                      ['ID', 'Status', 'Produkt', 'Od', 'Do', 'Godz. odbioru', 'Godz. zwrotu', 'Klient', 'Email', 'Telefon', 'Miasto', 'Dostawa', 'Dni', 'Cena bazowa', 'Dostawa (zł)', 'Razem', 'Faktura', 'NIP', 'Utworzono'],
                      reservations.map(r => [
                        r.id, STATUS_LABELS[r.status] || r.status, reservationProductLabel(r),
                        r.start_date, r.end_date, r.start_time || '', r.end_time || '',
                        r.name, r.email, r.phone, r.city, r.delivery ? 'tak' : 'nie',
                        r.days, r.base_price, r.delivery_fee, r.total_price,
                        r.wants_invoice ? 'tak' : 'nie', r.invoice_nip || '', r.created_at,
                      ])
                    );
                    showToast('success', `Wyeksportowano ${reservations.length} rezerwacji`);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Eksport CSV
                </Button>
              </div>
            </div>

            {/* Reservations list */}
            {reservations.length === 0 ? (
              <Card variant="glass" className="p-12 text-center border-dashed">
                <div className="w-12 h-12 rounded-[--radius-sm] bg-gold/10 text-gold flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="font-semibold">Brak rezerwacji w tym widoku</h3>
                <p className="text-sm text-text-muted mt-1">Zmień filtr lub utwórz nowy wynajem.</p>
              </Card>
            ) : (
              reservations
                .filter((reservation) => {
                  // W zakładce "Wszystkie" nie pokazuj odrzuconych i zakończonych
                  if (statusFilter === 'all') {
                    return !['rejected', 'completed', 'cancelled'].includes(reservation.status);
                  }
                  return true;
                })
                .map((reservation) => (
                <Card key={reservation.id} variant="glass" padding="none" className="overflow-hidden border-white/10 bg-[#101010]">
                  <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                    {/* Main info */}
                    <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                      <div className="hidden sm:flex w-20 h-20 rounded-lg bg-white border border-border overflow-hidden shrink-0">
                        <img
                          src={products.find((product) => product.id === reservation.product_id)?.image || '/favicon.svg'}
                          alt={PRODUCT_NAMES[reservation.product_id] || reservation.product_id}
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        <Badge variant={STATUS_COLORS[reservation.status] || 'default'}>
                          {STATUS_LABELS[reservation.status] || reservation.status}
                        </Badge>
                        {reservation.payment_status === 'paid' && (
                          <Badge variant="success"><Check className="w-3 h-3" aria-hidden="true" /> Opłacona{reservation.payment_provider ? ` (${reservation.payment_provider})` : ''}</Badge>
                        )}
                        {reservation.payment_status === 'pending' && (
                          <Badge variant="warning">Płatność w toku</Badge>
                        )}
                        {(reservation.payment_status === 'failed' || reservation.payment_status === 'cancelled') && (
                          <Badge variant="error">Płatność nieudana</Badge>
                        )}
                        {reservation.contract_status === 'ready' && (
                          <Badge variant="warning">Umowa czeka na podpis</Badge>
                        )}
                        {reservation.contract_status === 'signed' && (
                          <Badge variant="success"><Check className="w-3 h-3" aria-hidden="true" /> Umowa podpisana</Badge>
                        )}
                        {reservation.status === 'picked_up' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openTermModal(reservation)}
                            title="Przedłuż wynajem lub zmień go na bezterminowy"
                          >
                            <CalendarPlus className="w-4 h-4 mr-1.5" /> {reservation.is_indefinite ? 'Ustal zwrot' : 'Termin'}
                          </Button>
                        )}
                        <span className="text-xs text-text-muted ml-auto sm:ml-1">#{reservation.id}</span>
                        <span className="text-xs text-text-muted">
                          {new Date(reservation.created_at).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      
                      <h3 className="text-base sm:text-lg font-semibold text-text-primary truncate">
                        {reservation.name}
                      </h3>
                      {reservationItems(reservation).length === 1 ? (
                        <p className="text-sm text-gold/90 mt-0.5 truncate">
                          {reservationProductLabel(reservation)}
                        </p>
                      ) : (
                        <div className="mt-1.5">
                          <p className="text-sm font-semibold text-gold">Zestaw {reservationItems(reservation).length} urządzeń</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {reservationItems(reservation).map((item) => (
                              <span key={item.product_id} className="px-2 py-1 rounded-[--radius-sm] bg-white/[0.04] border border-white/[0.08] text-[11px] text-text-secondary">
                                {PRODUCT_NAMES[item.product_id] || item.product_id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm text-text-secondary mt-2">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-text-muted" />
                          {reservation.start_date} {reservation.start_time || '09:00'} → {reservation.is_indefinite ? 'bezterminowo' : `${reservation.end_date} ${reservation.end_time || '09:00'} (${reservation.days} ${reservation.days === 1 ? 'doba' : reservation.days < 5 ? 'doby' : 'dób'})`}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-text-muted" />
                          {reservation.phone}
                        </span>
                      </div>
                      </div>
                    </div>

                    {/* Price & actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 xl:pl-4 xl:border-l xl:border-white/10">
                      <div className="sm:text-right min-w-[110px]">
                        <p className="text-xl sm:text-2xl font-bold text-gold">{reservation.total_price} zł</p>
                        <p className="text-xs text-text-muted">
                          {reservation.is_indefinite ? 'kwota bieżąca' : reservation.delivery ? 'z dostawą' : 'odbiór osobisty'}
                        </p>
                      </div>

                      <div className="w-full sm:w-[190px] shrink-0">
                        <Select
                          id={`reservation-status-${reservation.id}`}
                          label="Status wynajmu"
                          value={reservation.status}
                          options={RESERVATION_STATUS_OPTIONS}
                          onChange={(event) => void openStatusModal(reservation, event.target.value)}
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {['pending', 'confirmed'].includes(reservation.status) && reservation.contract_status !== 'signed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openContractModal(reservation)}
                            title="Przygotuj umowę i uruchom ekran podpisu"
                          >
                            <FileSignature className="w-4 h-4 mr-1.5" /> Umowa
                          </Button>
                        )}
                        {reservation.contract_status === 'signed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendReservationContract(reservation.id)}
                              title="Wyślij podpisaną umowę ponownie na e-mail klienta"
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReservationContract(reservation.id)}
                              title="Pobierz podpisaną umowę PDF"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === reservation.id ? null : reservation.id)}
                          title={expandedId === reservation.id ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void openStatusHistory(reservation)}
                          title="Historia zmian statusu"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        
                        {/* Pending: Potwierdź lub Odrzuć */}
                        {reservation.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStatusChange(reservation.id, 'confirmed', 'reservation')}
                              title="Potwierdź rezerwację"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStatusChange(reservation.id, 'rejected', 'reservation')}
                              title="Odrzuć rezerwację"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        
                        {/* Confirmed: Wydaj sprzęt */}
                        {reservation.status === 'confirmed' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStatusChange(reservation.id, 'picked_up', 'reservation')}
                            title="Oznacz jako wydane"
                            disabled={reservation.contract_status !== 'signed'}
                          >
                            <Package className="w-4 h-4 mr-1.5" /> Wydaj
                          </Button>
                        )}
                        
                        {/* Picked up: Oznacz jako zwrócone */}
                        {reservation.status === 'picked_up' && !reservation.is_indefinite && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStatusChange(reservation.id, 'returned', 'reservation')}
                            title="Oznacz jako zwrócone"
                          >
                            <RotateCcw className="w-4 h-4 mr-1.5" /> Zwrot
                          </Button>
                        )}
                        
                        {/* Returned: Zakończ (rozlicz) */}
                        {reservation.status === 'returned' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStatusChange(reservation.id, 'completed', 'reservation')}
                            title="Zakończ i rozlicz"
                          >
                            <CheckCircle className="w-4 h-4 mr-1.5" /> Zakończ
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === reservation.id && (
                    <div className="px-4 sm:px-5 pb-5 pt-4 mt-1 border-t border-border grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-text-muted mb-1">Email:</p>
                        <p className="text-text-primary">{reservation.email}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-1">Telefon:</p>
                        <p className="text-text-primary">{reservation.phone}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-1">Miasto:</p>
                        <p className="text-text-primary">{reservation.city}</p>
                      </div>
                      {reservation.address && (
                        <div>
                          <p className="text-text-muted mb-1">Adres dostawy:</p>
                          <p className="text-text-primary">{reservation.address}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-text-muted mb-1">Cena bazowa:</p>
                        <p className="text-text-primary">{reservation.base_price} zł</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-1">Dostawa:</p>
                        <p className="text-text-primary">{reservation.delivery_fee} zł</p>
                      </div>
                      {reservation.notes && (
                        <div className="md:col-span-2">
                          <p className="text-text-muted mb-1">Notatki:</p>
                          <p className="text-text-primary">{reservation.notes}</p>
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <PaymentLinkPanel reservationId={reservation.id} onNotify={notifyPanel} />
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-text-muted mb-2">Zdjęcia stanu sprzętu:</p>
                        <HandoverPhotos reservationId={reservation.id} onNotify={notifyPanel} />
                      </div>
                      {reservationItems(reservation).length > 1 && (
                        <div className="md:col-span-2 p-4 bg-white/[0.025] border border-white/[0.08] rounded-[--radius-sm]">
                          <p className="text-text-muted mb-3">Pozycje na umowie:</p>
                          <div className="space-y-2">
                            {reservationItems(reservation).map((item, index) => (
                              <div key={item.product_id} className="flex justify-between gap-4 text-sm">
                                <span>{index + 1}. {PRODUCT_NAMES[item.product_id] || item.product_id}</span>
                                <span className="text-gold whitespace-nowrap">{Number(item.item_price).toFixed(2)} zł</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {reservation.wants_invoice === 1 && (
                        <div className="md:col-span-2 mt-4 p-4 bg-gold/10 border border-gold/30 rounded-lg">
                          <p className="text-gold font-semibold mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Dane do faktury
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {reservation.invoice_nip && (
                              <div>
                                <p className="text-text-muted">NIP:</p>
                                <p className="text-text-primary font-medium">{reservation.invoice_nip}</p>
                              </div>
                            )}
                            {reservation.invoice_company && (
                              <div>
                                <p className="text-text-muted">Firma:</p>
                                <p className="text-text-primary font-medium">{reservation.invoice_company}</p>
                              </div>
                            )}
                            {reservation.invoice_address && (
                              <div>
                                <p className="text-text-muted">Adres:</p>
                                <p className="text-text-primary font-medium">{reservation.invoice_address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* Availability Calendar Tab */}
        {activeTab === 'calendar' && (
          <AdminAvailabilityCalendar reservations={reservations} productNames={PRODUCT_NAMES} />
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {/* Bulk actions */}
            {contacts.length > 0 && (
              <div className="flex items-center justify-between gap-4 p-3 bg-bg-card rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-bg-secondary rounded transition-colors"
                    title={selectedContacts.length === contacts.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                  >
                    {selectedContacts.length === contacts.length ? (
                      <CheckSquare className="w-5 h-5 text-gold" />
                    ) : (
                      <Square className="w-5 h-5 text-text-muted" />
                    )}
                  </button>
                  <span className="text-sm text-text-muted">
                    {selectedContacts.length > 0 
                      ? `Zaznaczono: ${selectedContacts.length}` 
                      : `Wszystkich: ${contacts.length}`}
                  </span>
                </div>
                
                {selectedContacts.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="text-error border-error/30 hover:bg-error/10"
                  >
                    {deleting ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Usuń zaznaczone ({selectedContacts.length})
                  </Button>
                )}

                {selectedContacts.length === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      exportToCsv(
                        `wiadomosci-${new Date().toISOString().slice(0, 10)}.csv`,
                        ['ID', 'Status', 'Imię', 'Email', 'Temat', 'Wiadomość', 'Utworzono'],
                        contacts.map(c => [
                          c.id, STATUS_LABELS[c.status || 'new'] || c.status,
                          c.name, c.email, c.subject || '', c.message, c.created_at,
                        ])
                      );
                      showToast('success', `Wyeksportowano ${contacts.length} wiadomości`);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Eksport CSV
                  </Button>
                )}
              </div>
            )}

            {contacts.length === 0 ? (
              <Card variant="glass" className="p-8 text-center">
                <p className="text-text-muted">Brak wiadomości</p>
              </Card>
            ) : (
              contacts.map((contact) => (
                <Card key={contact.id} variant="glass" className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleContactSelection(contact.id)}
                      className="p-1 mt-1 hover:bg-bg-secondary rounded transition-colors shrink-0"
                    >
                      {selectedContacts.includes(contact.id) ? (
                        <CheckSquare className="w-5 h-5 text-gold" />
                      ) : (
                        <Square className="w-5 h-5 text-text-muted" />
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={STATUS_COLORS[contact.status || 'new'] || 'warning'}>
                          {STATUS_LABELS[contact.status || 'new']}
                        </Badge>
                        <span className="text-sm text-text-muted">
                          {new Date(contact.created_at).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-text-primary">
                        {contact.name}
                      </h3>
                      <p className="text-sm text-text-secondary mb-2">{contact.email}</p>
                      
                      {contact.subject && (
                        <p className="text-sm text-gold mb-2">Temat: {contact.subject}</p>
                      )}
                      
                      <p className="text-text-primary whitespace-pre-wrap">{contact.message}</p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {(contact.status === 'new' || !contact.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange(contact.id, 'read', 'contact')}
                          title="Oznacz jako przeczytane"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openReplyModal(contact)}
                        title="Odpowiedz"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Odpowiedz
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                        title="Usuń"
                        className="text-error hover:bg-error/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 xl:grid-cols-4 border border-white/10 rounded-[--radius-sm] overflow-hidden bg-[#101010] divide-x divide-y xl:divide-y-0 divide-white/10">
              <RevenueMetric icon={<DollarSign className="w-5 h-5" />} label="Dzisiaj" value={revenueData?.today || 0} tone="green" />
              <RevenueMetric icon={<Calendar className="w-5 h-5" />} label="Ten miesiąc" value={revenueData?.month || 0} tone="blue" />
              <RevenueMetric icon={<TrendingUp className="w-5 h-5" />} label="Całkowity przychód" value={revenueData?.total || 0} tone="gold" />
              <RevenueMetric icon={<Clock className="w-5 h-5" />} label="Oczekujące" value={revenueData?.pending || 0} tone="amber" />
            </div>
            
            {/* Charts Grid - Side by Side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-w-0">
              {/* Area Chart - Revenue */}
              <Card variant="glass" className="p-6 relative overflow-hidden min-w-0">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  Przychody miesięczne
                </h3>
                {revenueData?.byMonth && revenueData.byMonth.length > 0 ? (
                  <div className="h-72 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288} initialDimension={{ width: 520, height: 288 }}>
                      <AreaChart
                        data={[...revenueData.byMonth].reverse().map(item => ({
                          name: new Date(item.month + '-01').toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }),
                          przychód: item.revenue,
                          rezerwacje: item.count,
                        }))}
                        margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.6}/>
                            <stop offset="50%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                              <feMergeNode in="coloredBlur"/>
                              <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#6b7280" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: '#ffffff10' }}
                          dy={10}
                        />
                        <YAxis 
                          stroke="#6b7280" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value}`}
                          dx={-5}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(17, 17, 17, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            padding: '12px 16px',
                          }}
                          itemStyle={{ color: '#fff' }}
                          labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}
                          formatter={(value, name) => [
                            <span key="value" style={{ color: '#10b981', fontWeight: 600, fontSize: '16px' }}>
                              {name === 'przychód' ? `${value ?? 0} zł` : (value ?? 0)}
                            </span>,
                            <span key="name" style={{ color: '#9ca3af' }}>
                              {name === 'przychód' ? 'Przychód' : 'Rezerwacje'}
                            </span>
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="przychód"
                          stroke="#10b981"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          name="przychód"
                          dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2, filter: 'url(#glow)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-text-muted">Brak danych do wyświetlenia</p>
                    </div>
                  </div>
                )}
              </Card>
              
              {/* Bar Chart - Reservations */}
              <Card variant="glass" className="p-6 relative overflow-hidden min-w-0">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                  Liczba rezerwacji
                </h3>
                {revenueData?.byMonth && revenueData.byMonth.length > 0 ? (
                  <div className="h-72 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288} initialDimension={{ width: 520, height: 288 }}>
                      <BarChart
                        data={[...revenueData.byMonth].reverse().map(item => ({
                          name: new Date(item.month + '-01').toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }),
                          rezerwacje: item.count,
                          revenue: item.revenue,
                        }))}
                        margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
                        barCategoryGap="20%"
                      >
                        <defs>
                          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#d97706" stopOpacity={0.8}/>
                          </linearGradient>
                          <linearGradient id="colorBarHover" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fbbf24" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.9}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#6b7280" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: '#ffffff10' }}
                          dy={10}
                        />
                        <YAxis 
                          stroke="#6b7280" 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          dx={-5}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 4 }}
                          contentStyle={{
                            backgroundColor: 'rgba(17, 17, 17, 0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            padding: '12px 16px',
                          }}
                          itemStyle={{ color: '#fff' }}
                          labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}
                          formatter={(value, name) => [
                            <span key="value" style={{ color: '#f59e0b', fontWeight: 600, fontSize: '16px' }}>
                              {value ?? 0}
                            </span>,
                            <span key="name" style={{ color: '#9ca3af' }}>
                              {name === 'rezerwacje' ? 'Rezerwacje' : 'Przychód'}
                            </span>
                          ]}
                        />
                        <Bar 
                          dataKey="rezerwacje" 
                          fill="url(#colorBar)"
                          radius={[4, 4, 0, 0]}
                          name="rezerwacje"
                          animationDuration={1000}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center">
                    <div className="text-center">
                      <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-text-muted">Brak danych</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Card variant="glass" className="p-6 relative overflow-hidden">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <div className="p-2 rounded-[--radius-sm] bg-gold/10">
                  <Calendar className="w-5 h-5 text-gold" />
                </div>
                Szczegóły miesięczne
              </h3>
              {revenueData?.byMonth && revenueData.byMonth.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {revenueData.byMonth.map((item, index) => (
                    <div 
                      key={item.month} 
                      className="relative p-5 bg-white/[0.025] rounded-[--radius-sm] border border-white/10 hover:border-gold/25 transition-colors"
                    >
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-[--radius-sm] bg-white/5 flex items-center justify-center text-xs text-text-muted font-bold">
                        {index + 1}
                      </div>
                      <p className="font-semibold text-white text-lg capitalize mb-1">
                        {new Date(item.month + '-01').toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-text-muted mb-4 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {item.count} {item.count === 1 ? 'rezerwacja' : item.count < 5 ? 'rezerwacje' : 'rezerwacji'}
                      </p>
                      <p className="text-2xl font-bold text-green-400">
                        {item.revenue.toLocaleString('pl-PL')} zł
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-text-muted">Brak danych o przychodach</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="space-y-6">
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">Automatyczne przypomnienia</h3>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                <p className="text-green-400 font-medium mb-1 flex items-center gap-2"><CheckCircle className="w-4 h-4" aria-hidden="true" /> Automatyczne przypomnienia włączone</p>
                <p className="text-text-muted text-sm">
                  System automatycznie wysyła przypomnienia codziennie o 9:00:
                </p>
                <ul className="text-text-muted text-sm mt-2 space-y-1">
                  <li>• Przypomnienie o odbiorze - dzień przed datą rozpoczęcia</li>
                  <li>• Przypomnienie o zwrocie - dzień przed datą zakończenia</li>
                </ul>
              </div>
            </Card>
            
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">Ręczne wysyłanie</h3>
              <p className="text-text-secondary mb-4">
                Możesz ręcznie wysłać przypomnienia dla jutrzejszych terminów (odbiór i zwrot):
              </p>
              <Button
                variant="primary"
                onClick={async () => {
                  setSendingReminders(true);
                  try {
                    const result = await sendReminders();
                    if (result.success) {
                      showToast('success', result.message);
                    } else {
                      showToast('error', result.message);
                    }
                  } catch {
                    showToast('error', 'Błąd wysyłania');
                  }
                  setSendingReminders(false);
                }}
                disabled={sendingReminders}
              >
                {sendingReminders ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Wyślij przypomnienia teraz
                  </>
                )}
              </Button>
            </Card>
            
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">Typy przypomnień</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden="true" /> Przypomnienie o odbiorze</h4>
                  <p className="text-text-muted text-sm">
                    Wysyłane do klientów z potwierdzoną rezerwacją, którzy mają odebrać sprzęt następnego dnia.
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <h4 className="text-orange-400 font-medium mb-2 flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden="true" /> Przypomnienie o zwrocie</h4>
                  <p className="text-text-muted text-sm">
                    Wysyłane do klientów, którzy mają zwrócić sprzęt następnego dnia.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Newsletter Tab */}
        {activeTab === 'newsletter' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Users className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">
                      {newsletterSubscribers.filter(s => s.status === 'active').length}
                    </p>
                    <p className="text-sm text-text-muted">Aktywnych subskrybentów</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">{newsletterPosts.length}</p>
                    <p className="text-sm text-text-muted">Wszystkich postów</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gold/10">
                    <Send className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text-primary">
                      {newsletterPosts.filter(p => p.status === 'sent').length}
                    </p>
                    <p className="text-sm text-text-muted">Wysłanych newsletterów</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Create new post */}
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gold">Nowy post / newsletter</h3>
                <Button
                  variant={showCreatePost ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => setShowCreatePost(!showCreatePost)}
                >
                  {showCreatePost ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Anuluj
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Utwórz nowy
                    </>
                  )}
                </Button>
              </div>

              {showCreatePost && (
                <div className="space-y-4">
                  <Input
                    label="Tytuł"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="np. Nowy sprzęt w ofercie!"
                  />
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Treść
                    </label>
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Treść newslettera..."
                      rows={6}
                      className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg 
                               text-text-primary placeholder:text-text-muted
                               focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                               resize-none"
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (!newPostTitle.trim() || !newPostContent.trim()) {
                        showToast('error', 'Wypełnij tytuł i treść');
                        return;
                      }
                      try {
                        const result = await createNewsletterPost(newPostTitle.trim(), newPostContent.trim());
                        if (result.success) {
                          setNewPostTitle('');
                          setNewPostContent('');
                          setShowCreatePost(false);
                          showToast('success', 'Post utworzony');
                          loadData();
                        } else {
                          showToast('error', result.message);
                        }
                      } catch {
                        showToast('error', 'Błąd tworzenia postu');
                      }
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Utwórz post
                  </Button>
                </div>
              )}
            </Card>

            {/* Posts list */}
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">Posty / Newslettery</h3>
              {newsletterPosts.length === 0 ? (
                <p className="text-text-muted text-center py-8">Brak postów. Utwórz pierwszy!</p>
              ) : (
                <div className="space-y-4">
                  {newsletterPosts.map((post) => (
                    <div key={post.id} className="bg-bg-primary border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-text-primary">{post.title}</h4>
                            <Badge variant={post.status === 'sent' ? 'success' : 'default'}>
                              {post.status === 'sent' ? 'Wysłany' : 'Szkic'}
                            </Badge>
                          </div>
                          <p className="text-text-secondary text-sm line-clamp-2 mb-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-text-muted">
                            <span>Utworzono: {new Date(post.created_at).toLocaleDateString('pl-PL')}</span>
                            {post.sent_at && (
                              <span>Wysłano: {new Date(post.sent_at).toLocaleDateString('pl-PL')}</span>
                            )}
                            {post.sent_count > 0 && (
                              <span className="text-green-400 inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Wysłano do {post.sent_count} osób</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {post.status !== 'sent' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                const activeCount = newsletterSubscribers.filter(s => s.status === 'active').length;
                                if (activeCount === 0) {
                                  showToast('error', 'Brak aktywnych subskrybentów');
                                  return;
                                }
                                showConfirm(`Czy na pewno chcesz wysłać ten newsletter do ${activeCount} subskrybentów?`, async () => {
                                  setSendingNewsletter(true);
                                  try {
                                    const result = await sendNewsletterPost(post.id);
                                    if (result.success) {
                                      showToast('success', result.message);
                                      loadData();
                                    } else {
                                      showToast('error', result.message);
                                    }
                                  } catch {
                                    showToast('error', 'Błąd wysyłania');
                                  }
                                  setSendingNewsletter(false);
                                });
                              }}
                              disabled={sendingNewsletter}
                            >
                              {sendingNewsletter ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-4 h-4 mr-1" />
                                  Wyślij
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              showConfirm('Czy na pewno chcesz usunąć ten post?', async () => {
                                try {
                                  const result = await deleteNewsletterPost(post.id);
                                  if (result.success) {
                                    showToast('success', 'Post usunięty');
                                    loadData();
                                  } else {
                                    showToast('error', result.message);
                                  }
                                } catch {
                                  showToast('error', 'Błąd usuwania');
                                }
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Subscribers list */}
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">
                Subskrybenci ({newsletterSubscribers.filter(s => s.status === 'active').length})
              </h3>
              {newsletterSubscribers.filter(s => s.status === 'active').length === 0 ? (
                <p className="text-text-muted text-center py-8">
                  Brak aktywnych subskrybentów. Dodaj formularz zapisu na stronie!
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Email</th>
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Imię</th>
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Data zapisu</th>
                        <th className="text-right py-3 px-2 text-text-muted font-medium">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newsletterSubscribers.filter(s => s.status === 'active').map((subscriber) => (
                        <tr key={subscriber.id} className="border-b border-border/50 hover:bg-bg-card/50">
                          <td className="py-3 px-2 text-text-primary">{subscriber.email}</td>
                          <td className="py-3 px-2 text-text-secondary">{subscriber.name || '-'}</td>
                          <td className="py-3 px-2 text-text-muted">
                            {new Date(subscriber.created_at).toLocaleDateString('pl-PL')}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                showConfirm('Czy na pewno chcesz usunąć tego subskrybenta?', async () => {
                                  try {
                                    const result = await deleteNewsletterSubscriber(subscriber.id);
                                    if (result.success) {
                                      showToast('success', 'Subskrybent usunięty');
                                      loadData();
                                    }
                                  } catch {
                                    showToast('error', 'Błąd usuwania');
                                  }
                                });
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gold">Powiadomienia o dostępności</h2>
              <Button variant="ghost" size="sm" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Odśwież
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gold">
                      {productNotifications.filter(n => n.status === 'waiting').length}
                    </p>
                    <p className="text-sm text-text-muted">Oczekujących</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gold">
                      {productNotifications.filter(n => n.status === 'sent').length}
                    </p>
                    <p className="text-sm text-text-muted">Wysłanych</p>
                  </div>
                </div>
              </Card>
              <Card variant="glass" className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gold">
                      {new Set(productNotifications.map(n => n.product_id)).size}
                    </p>
                    <p className="text-sm text-text-muted">Produktów</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Notifications Table */}
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gold mb-4">Lista powiadomień</h3>
              
              {productNotifications.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Brak zapisanych powiadomień</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Produkt</th>
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Email</th>
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Status</th>
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Data zapisu</th>
                        <th className="text-left py-3 px-2 text-text-muted font-medium">Data wysłania</th>
                        <th className="text-right py-3 px-2 text-text-muted font-medium">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productNotifications.map((notification) => (
                        <tr key={notification.id} className="border-b border-border/50 hover:bg-bg-card/50">
                          <td className="py-3 px-2 text-text-primary">{notification.productName}</td>
                          <td className="py-3 px-2 text-text-secondary">{notification.email}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              notification.status === 'waiting' 
                                ? 'bg-yellow-500/20 text-yellow-400' 
                                : 'bg-green-500/20 text-green-400'
                            }`}>
                              {notification.status === 'waiting' ? 'Oczekuje' : 'Wysłano'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-text-muted">
                            {new Date(notification.created_at).toLocaleDateString('pl-PL')}
                          </td>
                          <td className="py-3 px-2 text-text-muted">
                            {notification.notified_at 
                              ? new Date(notification.notified_at).toLocaleDateString('pl-PL')
                              : '-'
                            }
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {notification.status === 'waiting' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={sendingNotification === notification.product_id}
                                  onClick={async () => {
                                    try {
                                      setSendingNotification(notification.product_id);
                                      await sendProductNotifications(notification.product_id);
                                      showToast('success', 'Powiadomienia wysłane');
                                      loadData();
                                    } catch {
                                      showToast('error', 'Błąd wysyłania powiadomień');
                                    } finally {
                                      setSendingNotification(null);
                                    }
                                  }}
                                  title="Wyślij powiadomienia dla tego produktu"
                                >
                                  <Send className="w-4 h-4 text-blue-400" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  showConfirm('Czy na pewno chcesz usunąć to powiadomienie?', async () => {
                                    try {
                                      await deleteNotification(notification.id);
                                      showToast('success', 'Powiadomienie usunięte');
                                      loadData();
                                    } catch {
                                      showToast('error', 'Błąd usuwania');
                                    }
                                  });
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Products with waiting notifications - grouped */}
            {productNotifications.filter(n => n.status === 'waiting').length > 0 && (
              <Card variant="glass" className="p-6">
                <h3 className="text-lg font-semibold text-gold mb-4">Produkty z oczekującymi powiadomieniami</h3>
                <div className="space-y-3">
                  {Array.from(new Set(productNotifications.filter(n => n.status === 'waiting').map(n => n.product_id)))
                    .map(productId => {
                      const notifications = productNotifications.filter(n => n.product_id === productId && n.status === 'waiting');
                      const productName = notifications[0]?.productName || 'Nieznany produkt';
                      return (
                        <div key={productId} className="flex items-center justify-between p-3 bg-bg-dark/50 rounded-lg">
                          <div>
                            <p className="text-text-primary font-medium">{productName}</p>
                            <p className="text-sm text-text-muted">{notifications.length} oczekujących powiadomień</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={sendingNotification === productId}
                            onClick={async () => {
                              try {
                                setSendingNotification(productId);
                                await sendProductNotifications(productId);
                                showToast('success', 'Powiadomienia wysłane');
                                loadData();
                              } catch {
                                showToast('error', 'Błąd wysyłania powiadomień');
                              } finally {
                                setSendingNotification(null);
                              }
                            }}
                          >
                            {sendingNotification === productId ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Wysyłanie...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-2" />
                                Wyślij wszystkie
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  }
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <ProductInventoryPanel
            products={inventoryProducts}
            loading={loading}
            onSave={handleSaveProduct}
            onDelete={handleDeleteProduct}
          />
        )}

        {activeTab === 'documents' && <DocumentsPanel onNotify={notifyPanel} />}

        {activeTab === 'discounts' && <DiscountsPanel onNotify={notifyPanel} />}

        {activeTab === 'coupons' && <CouponsPanel onNotify={notifyPanel} />}

        {activeTab === 'business' && <BusinessSettingsPanel onNotify={notifyPanel} />}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <Card variant="glass" className="p-6 max-w-lg">
            <h2 className="text-lg font-bold text-gold mb-1">Zmiana hasła</h2>
            <p className="text-sm text-text-muted mb-6">
              Nowe hasło zastąpi hasło skonfigurowane na serwerze. Minimum 10 znaków.
            </p>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (pwdNew.length < 10) {
                  showToast('error', 'Nowe hasło musi mieć co najmniej 10 znaków');
                  return;
                }
                if (pwdNew !== pwdConfirm) {
                  showToast('error', 'Hasła nie są identyczne');
                  return;
                }
                setPwdSaving(true);
                try {
                  const res = await changeAdminPassword(pwdCurrent, pwdNew);
                  if (res.success) {
                    showToast('success', 'Hasło zmienione');
                    setPwdCurrent('');
                    setPwdNew('');
                    setPwdConfirm('');
                  } else {
                    showToast('error', res.message || 'Błąd zmiany hasła');
                  }
                } catch {
                  showToast('error', 'Błąd połączenia z serwerem');
                } finally {
                  setPwdSaving(false);
                }
              }}
            >
              <Input
                label="Obecne hasło"
                type="password"
                value={pwdCurrent}
                onChange={(e) => setPwdCurrent(e.target.value)}
                placeholder="Wprowadź obecne hasło"
                required
              />
              <Input
                label="Nowe hasło"
                type="password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                placeholder="Minimum 10 znaków"
                required
              />
              <Input
                label="Powtórz nowe hasło"
                type="password"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                placeholder="Powtórz nowe hasło"
                required
              />
              <Button type="submit" variant="primary" disabled={pwdSaving}>
                {pwdSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  'Zmień hasło'
                )}
              </Button>
            </form>
          </Card>
        )}
      </main>
      </div>

      {statusFor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[85] p-4">
          <Card variant="glass" className="w-full max-w-2xl max-h-[94vh] overflow-y-auto">
            <form onSubmit={handleManualStatusChange} className="p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase text-gold font-semibold">{statusHistoryOnly ? 'Historia procesu' : 'Ręczna zmiana'} • rezerwacja #{statusFor.id}</p>
                  <h2 className="text-xl font-bold mt-1">{statusHistoryOnly ? 'Historia zmian statusu' : 'Zmień status wynajmu'}</h2>
                  <p className="text-sm text-text-muted mt-1">
                    {statusFor.name} • {reservationProductLabel(statusFor)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" type="button" onClick={() => setStatusFor(null)} aria-label="Zamknij">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {!statusHistoryOnly && <>
              <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end mb-6">
                <div className="p-4 rounded-[--radius-sm] bg-white/[0.025] border border-white/10">
                  <p className="text-[11px] uppercase text-text-muted mb-2">Obecny status</p>
                  <Badge variant={STATUS_COLORS[statusFor.status] || 'default'}>
                    {STATUS_LABELS[statusFor.status] || statusFor.status}
                  </Badge>
                </div>
                <ChevronRight className="hidden sm:block w-5 h-5 text-text-muted mb-5" aria-hidden="true" />
                <div className="p-4 rounded-[--radius-sm] bg-gold/[0.05] border border-gold/20">
                  <p className="text-[11px] uppercase text-text-muted mb-2">Nowy status</p>
                  <Badge variant={STATUS_COLORS[statusForm.targetStatus] || 'default'}>
                    {STATUS_LABELS[statusForm.targetStatus] || statusForm.targetStatus}
                  </Badge>
                </div>
              </div>

              <Select
                id="manual-reservation-status"
                label="Wybierz status"
                value={statusForm.targetStatus}
                options={RESERVATION_STATUS_OPTIONS.filter((option) => option.value !== statusFor.status)}
                onChange={(event) => setStatusForm((current) => ({
                  ...current,
                  targetStatus: event.target.value,
                  notifyCustomer: CUSTOMER_STATUS_EMAILS.includes(event.target.value),
                }))}
              />

              <div className="mt-4 p-4 rounded-[--radius-sm] bg-sky-500/[0.06] border border-sky-500/20 text-sm text-text-secondary">
                {STATUS_DESCRIPTIONS[statusForm.targetStatus]}
              </div>

              {statusForm.targetStatus === 'picked_up' && statusFor.contract_status !== 'signed' && (
                <div className="mt-3 p-3 rounded-[--radius-sm] bg-red-500/[0.08] border border-red-500/25 flex items-start gap-2 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Wydanie zostanie zablokowane, dopóki umowa nie będzie podpisana.
                </div>
              )}
              {statusForm.targetStatus === 'returned' && statusFor.is_indefinite && (
                <div className="mt-3 p-3 rounded-[--radius-sm] bg-red-500/[0.08] border border-red-500/25 flex items-start gap-2 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Najpierw ustal faktyczny termin zwrotu wynajmu bezterminowego.
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <Input
                  label="Pracownik zmieniający status"
                  value={statusForm.changedBy}
                  onChange={(event) => setStatusForm((current) => ({ ...current, changedBy: event.target.value }))}
                  minLength={3}
                  required
                />
                <Textarea
                  label="Powód zmiany"
                  value={statusForm.note}
                  onChange={(event) => setStatusForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Np. korekta po rozmowie z klientem"
                  rows={3}
                  minLength={3}
                  required
                />
              </div>

              {CUSTOMER_STATUS_EMAILS.includes(statusForm.targetStatus) && (
                <label className={`mt-5 flex items-center justify-between gap-4 p-4 rounded-[--radius-sm] border cursor-pointer ${statusForm.notifyCustomer ? 'border-gold/40 bg-gold/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <span>
                    <span className="block text-sm font-semibold">Powiadom klienta e-mailem</span>
                    <span className="block text-xs text-text-muted mt-1">Wyśle wiadomość odpowiadającą nowemu statusowi.</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={statusForm.notifyCustomer}
                    onChange={(event) => setStatusForm((current) => ({ ...current, notifyCustomer: event.target.checked }))}
                    className="w-5 h-5 accent-gold shrink-0"
                  />
                </label>
              )}
              </>}

              {(statusHistoryOnly || statusHistory.length > 0) && (
                <div className="mt-6 pt-5 border-t border-white/10">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-gold" /> Ostatnie zmiany statusu
                  </h3>
                  {statusHistory.length === 0 ? (
                    <div className="p-5 rounded-[--radius-sm] border border-dashed border-white/10 text-sm text-text-muted text-center">
                      Brak zapisanych zmian statusu.
                    </div>
                  ) : <div className="space-y-2">
                    {statusHistory.slice(0, 5).map((change) => (
                      <div key={change.id} className="p-3 rounded-[--radius-sm] bg-white/[0.025] border border-white/[0.06] text-xs">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">
                            {STATUS_LABELS[change.previous_status] || change.previous_status}
                            {' → '}
                            {STATUS_LABELS[change.new_status] || change.new_status}
                          </span>
                          <span className="text-text-muted">{new Date(change.created_at).toLocaleString('pl-PL')}</span>
                        </div>
                        <p className="text-text-muted mt-1">{change.changed_by} • {change.note}</p>
                        {change.notify_customer && <p className="text-green-400 mt-1">Klient został powiadomiony</p>}
                      </div>
                    ))}
                  </div>}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setStatusFor(null)}>{statusHistoryOnly ? 'Zamknij' : 'Anuluj'}</Button>
                {!statusHistoryOnly && <Button
                  type="submit"
                  variant="primary"
                  disabled={statusSaving || statusForm.changedBy.trim().length < 3 || statusForm.note.trim().length < 3}
                >
                  {statusSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Zapisz status
                </Button>}
              </div>
            </form>
          </Card>
        </div>
      )}

      {termFor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <Card variant="glass" className="w-full max-w-2xl max-h-[94vh] overflow-y-auto">
            <form onSubmit={handleTermChange} className="p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase text-gold font-semibold">Wydany sprzęt • rezerwacja #{termFor.id}</p>
                  <h2 className="text-xl font-bold mt-1">Zarządzaj okresem wynajmu</h2>
                  <p className="text-sm text-text-muted mt-1">
                    {termFor.name} • {reservationProductLabel(termFor)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" type="button" onClick={() => setTermFor(null)} aria-label="Zamknij">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-px rounded-lg overflow-hidden border border-white/10 bg-white/10 mb-6">
                <div className="bg-[#111] p-4">
                  <p className="text-[11px] uppercase text-text-muted">Obecny termin</p>
                  <p className="font-semibold mt-1 flex items-center gap-2">
                    {termFor.is_indefinite ? <InfinityIcon className="w-4 h-4 text-gold" /> : <Calendar className="w-4 h-4 text-gold" />}
                    {termFor.is_indefinite ? 'Bezterminowo' : `${termFor.end_date} ${termFor.end_time || '09:00'}`}
                  </p>
                </div>
                <div className="bg-[#111] p-4">
                  <p className="text-[11px] uppercase text-text-muted">Bieżąca wartość</p>
                  <p className="font-semibold text-gold mt-1">{Number(termFor.total_price).toFixed(2)} zł</p>
                </div>
              </div>

              {!termFor.is_indefinite && (
                <label className={`mb-5 flex items-center justify-between gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${termForm.isIndefinite ? 'border-gold/50 bg-gold/10' : 'border-border bg-bg-primary/40'}`}>
                  <span>
                    <span className="block text-sm font-semibold">Zmień na wynajem bezterminowy</span>
                    <span className="block text-xs text-text-muted mt-1">Sprzęt pozostanie zablokowany do ustalenia daty zwrotu.</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={termForm.isIndefinite}
                    onChange={(event) => setTermForm((current) => ({ ...current, isIndefinite: event.target.checked }))}
                    className="w-5 h-5 accent-gold shrink-0"
                  />
                </label>
              )}

              {!termForm.isIndefinite && (
                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  <Input
                    label={termFor.is_indefinite ? 'Ustalona data zwrotu' : 'Nowa data zwrotu'}
                    type="date"
                    min={termFor.is_indefinite ? termFor.start_date : nextDay(termFor.end_date)}
                    value={termForm.endDate}
                    onChange={(event) => setTermForm((current) => ({ ...current, endDate: event.target.value }))}
                    required
                  />
                  <Input
                    label="Godzina zwrotu"
                    type="time"
                    value={termForm.endTime}
                    onChange={(event) => setTermForm((current) => ({ ...current, endTime: event.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Pracownik zatwierdzający"
                  value={termForm.changedBy}
                  onChange={(event) => setTermForm((current) => ({ ...current, changedBy: event.target.value }))}
                  minLength={3}
                  required
                />
                <Textarea
                  label="Uzgodnienie z klientem"
                  value={termForm.note}
                  onChange={(event) => setTermForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Np. uzgodniono telefonicznie 20.07"
                  rows={3}
                  minLength={3}
                  required
                />
              </div>

              <div className="mt-5 p-4 rounded-lg bg-sky-500/[0.07] border border-sky-500/20 text-xs text-text-secondary leading-relaxed">
                System sprawdzi dostępność, przeliczy pełny okres wynajmu i wyśle klientowi potwierdzenie zmiany. Podpisany PDF pozostanie niezmieniony, a uzgodnienie trafi do historii.
              </div>

              {termHistory.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/10">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-gold" /> Historia zmian
                  </h3>
                  <div className="space-y-2">
                    {termHistory.map((change) => (
                      <div key={change.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">
                            {change.previous_is_indefinite ? 'bezterminowo' : change.previous_end_date}
                            {' → '}
                            {change.new_is_indefinite ? 'bezterminowo' : change.new_end_date}
                          </span>
                          <span className="text-text-muted">{new Date(change.created_at).toLocaleString('pl-PL')}</span>
                        </div>
                        <p className="text-text-muted mt-1">{change.changed_by} • {change.note}</p>
                        {Number(change.price_delta) !== 0 && (
                          <p className="text-gold mt-1">Zmiana wartości: {Number(change.price_delta).toFixed(2)} zł</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
                <Button type="button" variant="ghost" onClick={() => setTermFor(null)}>Anuluj</Button>
                <Button type="submit" variant="primary" disabled={termSaving}>
                  {termSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
                  {termFor.is_indefinite ? 'Ustal termin zwrotu' : termForm.isIndefinite ? 'Zmień na bezterminowy' : 'Przedłuż wynajem'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Contract preparation / kiosk modal */}
      {contractFor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <Card variant="glass" className="w-full max-w-3xl max-h-[94vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gold mb-1">Rezerwacja #{contractFor.id}</p>
                  <h2 className="text-xl font-bold text-text-primary">Przygotowanie umowy najmu</h2>
                  <p className="text-sm text-text-muted mt-1">
                    {contractFor.name} • {reservationProductLabel(contractFor)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContractFor(null);
                    setContractSession(null);
                  }}
                  aria-label="Zamknij"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {contractSession ? (
                <div className="py-6 text-center">
                  <CheckCircle className={`w-14 h-14 mx-auto mb-4 ${contractSignedId ? 'text-green-500' : 'text-gold'}`} />
                  <h3 className="text-xl font-semibold text-text-primary">
                    {contractSignedId ? 'Umowa podpisana' : 'Umowa gotowa do podpisu'}
                  </h3>
                  <p className="text-gold mt-1">{contractSession.contractNumber}</p>
                  <p className="text-sm text-text-muted mt-2 mb-6">
                    {contractSignedId
                      ? 'PDF został zapisany i wysłany klientowi. Możesz teraz pobrać egzemplarz albo wydać sprzęt.'
                      : `Link wygasa ${new Date(contractSession.expiresAt).toLocaleString('pl-PL')}. Przekaż tablet klientowi i uruchom tryb podpisu.`}
                  </p>

                  {!contractSignedId && (
                    <div className="p-3 rounded-lg bg-bg-secondary border border-border text-left text-xs text-text-secondary break-all mb-5">
                      {contractSession.signingUrl}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {!contractSignedId && <Button
                      variant="primary"
                      onClick={() => window.open(contractSession.signingUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> Uruchom ekran podpisu
                    </Button>}
                    {!contractSignedId && <Button
                      variant="secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(contractSession.signingUrl);
                        showToast('success', 'Link skopiowany');
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" /> Kopiuj link
                    </Button>}
                    {contractSignedId && (
                      <Button variant="primary" onClick={() => downloadContractPdf(contractSignedId)}>
                        <Download className="w-4 h-4 mr-2" /> Pobierz podpisany PDF
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePrepareContract} className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gold mb-3">Dane Najemcy z dokumentu</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input
                        label="Adres zamieszkania"
                        value={contractForm.renterAddress}
                        onChange={(event) => setContractForm((current) => ({ ...current, renterAddress: event.target.value }))}
                        placeholder="Ulica, numer, kod, miejscowość"
                        required
                      />
                      <Select
                        label="Rodzaj dokumentu"
                        value={contractForm.documentType}
                        onChange={(event) => setContractForm((current) => ({
                          ...current,
                          documentType: event.target.value as 'dowod_osobisty' | 'paszport',
                        }))}
                        options={[
                          { value: 'dowod_osobisty', label: 'Dowód osobisty' },
                          { value: 'paszport', label: 'Paszport' },
                        ]}
                        required
                      />
                      <Input
                        label="PESEL"
                        value={contractForm.pesel || ''}
                        onChange={(event) => setContractForm((current) => ({ ...current, pesel: event.target.value.replace(/\D/g, '').slice(0, 11) }))}
                        placeholder="11 cyfr"
                        inputMode="numeric"
                        minLength={11}
                        maxLength={11}
                        pattern="[0-9]{11}"
                        hint="Dokładnie 11 cyfr — identyfikuje Najemcę w umowie"
                        required
                      />
                      <Input
                        label="Numer dokumentu tożsamości (opcjonalnie)"
                        value={contractForm.documentNumber}
                        onChange={(event) => setContractForm((current) => ({ ...current, documentNumber: event.target.value.toUpperCase() }))}
                        placeholder="ABC 123456"
                        maxLength={30}
                        hint="Możesz zostawić puste — Najemcę identyfikuje PESEL"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gold mb-3">Wydanie sprzętu i rozliczenie</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input
                        label="Pracownik wydający"
                        value={contractForm.employeeName}
                        onChange={(event) => setContractForm((current) => ({ ...current, employeeName: event.target.value }))}
                        placeholder="Imię i nazwisko"
                        required
                      />
                      <Input
                        label="Kaucja (zł)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={contractForm.deposit}
                        onChange={(event) => setContractForm((current) => ({ ...current, deposit: Number(event.target.value) }))}
                        required
                      />
                    </div>
                    <div className="mt-4">
                      <Textarea
                        label="Wydawane akcesoria"
                        value={contractForm.accessories}
                        onChange={(event) => setContractForm((current) => ({ ...current, accessories: event.target.value }))}
                        rows={3}
                        required
                      />
                    </div>
                    <div className="mt-4">
                      <Textarea
                        label="Stan sprzętu przy wydaniu"
                        value={contractForm.conditionNotes}
                        onChange={(event) => setContractForm((current) => ({ ...current, conditionNotes: event.target.value }))}
                        rows={3}
                        required
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-gold/10 border border-gold/25 text-sm text-text-secondary">
                    Po kliknięciu system utworzy niezmienny, zaszyfrowany snapshot umowy.
                    Klient zobaczy całą treść przed polem podpisu. Płatność i wydanie sprzętu
                    pozostaną zablokowane do czasu podpisania.
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => setContractFor(null)}>
                      Anuluj
                    </Button>
                    <Button type="submit" variant="primary" disabled={contractSaving}>
                      {contractSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileSignature className="w-4 h-4 mr-2" />
                      )}
                      {contractSaving ? 'Przygotowywanie…' : 'Generuj umowę'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Reply Modal */}
      {replyingTo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card variant="glass" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gold">Odpowiedz na wiadomość</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Original message */}
              <div className="bg-bg-primary/50 rounded-lg p-4 mb-6 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="default">{replyingTo.name}</Badge>
                  <span className="text-sm text-text-muted">{replyingTo.email}</span>
                </div>
                {replyingTo.subject && (
                  <p className="text-sm text-gold mb-2">Temat: {replyingTo.subject}</p>
                )}
                <p className="text-text-secondary whitespace-pre-wrap text-sm">
                  {replyingTo.message}
                </p>
              </div>

              {/* Reply success message */}
              {replySuccess ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-green-400">
                    Odpowiedź wysłana!
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    Email został wysłany do {replyingTo.email}
                  </p>
                </div>
              ) : (
                <>
                  {/* Reply textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Twoja odpowiedź
                    </label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Napisz odpowiedź do klienta..."
                      rows={6}
                      className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg 
                               text-text-primary placeholder:text-text-muted
                               focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                               resize-none"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      Odpowiedź zostanie wysłana na adres: {replyingTo.email}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="ghost"
                      onClick={() => setReplyingTo(null)}
                    >
                      Anuluj
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleReplySubmit}
                      disabled={replySending || replyMessage.trim().length < 5}
                    >
                      {replySending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Wysyłanie...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Wyślij odpowiedź
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Custom Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-5 py-3 rounded-[--radius-sm] shadow-xl border flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-green-500/20 border-green-500/50 text-green-400' 
              : toast.type === 'error' 
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5" />}
            {toast.type === 'info' && <Bell className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card variant="glass" className="w-full max-w-md">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-7 h-7 text-gold" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Potwierdzenie</h3>
                <p className="text-text-muted">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setConfirmModal(null)}
                >
                  Anuluj
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                >
                  Potwierdź
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'gold' | 'amber' | 'green' | 'blue';
}) {
  const tones = {
    gold: 'bg-gold/10 text-gold',
    amber: 'bg-amber-500/10 text-amber-400',
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-sky-500/10 text-sky-400',
  };
  return (
    <div className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4 min-w-0">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold leading-none truncate">{value}</p>
        <p className="text-[11px] sm:text-xs text-text-muted mt-1.5 truncate">{label}</p>
      </div>
    </div>
  );
}

function RevenueMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'gold' | 'amber';
}) {
  const tones = {
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-sky-500/10 text-sky-400',
    gold: 'bg-gold/10 text-gold',
    amber: 'bg-amber-500/10 text-amber-400',
  };
  return (
    <div className="p-4 sm:p-5 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-[--radius-sm] flex items-center justify-center shrink-0 ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-bold leading-none truncate">{Number(value).toLocaleString('pl-PL')} zł</p>
        <p className="text-[11px] text-text-muted mt-1.5 truncate">{label}</p>
      </div>
    </div>
  );
}

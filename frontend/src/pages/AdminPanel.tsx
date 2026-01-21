import { useState, useEffect } from 'react';
import { 
  adminLogin, 
  adminLogout, 
  isAdminLoggedIn, 
  getStats, 
  getReservations, 
  updateReservationStatus,
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
  sendProductNotifications
} from '@/services/adminApi';
import { Button, Card, Badge, Input } from '@/components/ui';
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
  Plus
} from 'lucide-react';

interface Reservation {
  id: number;
  product_id: string;
  category_id: string;
  start_date: string;
  end_date: string;
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
  created_at: string;
}

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

export function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(isAdminLoggedIn());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'reservations' | 'contacts' | 'revenue' | 'reminders' | 'newsletter' | 'notifications'>('reservations');
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    setTimeout(() => setToast(null), 3000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  // Load data on login
  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const interval = setInterval(() => {
      loadData();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, reservationsRes, contactsRes, revenueRes, subscribersRes, postsRes, notificationsRes] = await Promise.all([
        getStats(),
        getReservations(statusFilter !== 'all' ? statusFilter : undefined),
        getContacts(),
        getRevenue(),
        getNewsletterSubscribers(),
        getNewsletterPosts(),
        getProductNotifications(),
      ]);
      
      if (statsRes.success) setStats(statsRes.data);
      if (reservationsRes.success) setReservations(reservationsRes.data);
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
    setContacts([]);
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
      } catch (error) {
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
      } catch (error) {
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
      const result = await updateReservationStatus(id, newStatus);
      if (result.success) {
        setReservations(prev => 
          prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
        );
        loadData(); // Refresh stats
      }
    } else {
      const result = await updateContactStatus(id, newStatus);
      if (result.success) {
        setContacts(prev => 
          prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
        );
        loadData();
      }
    }
  };

  // Login form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <Card variant="glass" className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-gold mb-6 text-center">
            WB-Rent Admin
          </h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="password"
              label="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wprowadź hasło admina"
              error={loginError}
            />
            
            <Button type="submit" className="w-full">
              Zaloguj się
            </Button>
          </form>
          
          <p className="text-text-muted text-sm text-center mt-6">
            Domyślne hasło: <code className="text-gold">wbrent2026</code>
          </p>
        </Card>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gold">WB-Rent Admin</h1>
          
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Odśwież
            </Button>
            
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Wyloguj
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card variant="glass" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <Calendar className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.reservations.total}</p>
                  <p className="text-sm text-text-muted">Rezerwacji</p>
                </div>
              </div>
            </Card>
            
            <Card variant="glass" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.reservations.pending}</p>
                  <p className="text-sm text-text-muted">Oczekujących</p>
                </div>
              </div>
            </Card>
            
            <Card variant="glass" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.revenue.today} zł</p>
                  <p className="text-sm text-text-muted">Dzisiejszy przychód</p>
                </div>
              </div>
            </Card>
            
            <Card variant="glass" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stats.contacts.new}</p>
                  <p className="text-sm text-text-muted">Nowych wiadomości</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={activeTab === 'reservations' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('reservations')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Rezerwacje ({reservations.length})
          </Button>
          <Button
            variant={activeTab === 'contacts' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('contacts')}
          >
            <Mail className="w-4 h-4 mr-2" />
            Wiadomości ({contacts.length})
          </Button>
          <Button
            variant={activeTab === 'revenue' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('revenue')}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Przychody
          </Button>
          <Button
            variant={activeTab === 'reminders' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('reminders')}
          >
            <Clock className="w-4 h-4 mr-2" />
            Przypomnienia
          </Button>
          <Button
            variant={activeTab === 'newsletter' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('newsletter')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Nowości ({newsletterSubscribers.filter(s => s.status === 'active').length})
          </Button>
          <Button
            variant={activeTab === 'notifications' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell className="w-4 h-4 mr-2" />
            Powiadomienia ({productNotifications.filter(n => n.status === 'waiting').length})
          </Button>
        </div>

        {/* Reservations Tab */}
        {activeTab === 'reservations' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
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

            {/* Reservations list */}
            {reservations.length === 0 ? (
              <Card variant="glass" className="p-8 text-center">
                <p className="text-text-muted">Brak rezerwacji</p>
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
                <Card key={reservation.id} variant="glass" className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Main info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={STATUS_COLORS[reservation.status] || 'default'}>
                          {STATUS_LABELS[reservation.status] || reservation.status}
                        </Badge>
                        <span className="text-sm text-text-muted">
                          #{reservation.id}
                        </span>
                        <span className="text-sm text-text-muted">
                          {new Date(reservation.created_at).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-text-primary mb-1">
                        {reservation.name}
                      </h3>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {reservation.product_id}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {reservation.start_date} → {reservation.end_date} ({reservation.days} dni)
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {reservation.phone}
                        </span>
                      </div>
                    </div>

                    {/* Price & actions */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gold">{reservation.total_price} zł</p>
                        <p className="text-sm text-text-muted">
                          {reservation.delivery ? 'z dostawą' : 'odbiór osobisty'}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === reservation.id ? null : reservation.id)}
                        >
                          <Eye className="w-4 h-4" />
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
                          >
                            📦 Wydaj
                          </Button>
                        )}
                        
                        {/* Picked up: Oznacz jako zwrócone */}
                        {reservation.status === 'picked_up' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStatusChange(reservation.id, 'returned', 'reservation')}
                            title="Oznacz jako zwrócone"
                          >
                            ↩️ Zwrot
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
                            ✅ Zakończ
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === reservation.id && (
                    <div className="mt-4 pt-4 border-t border-border grid md:grid-cols-2 gap-4 text-sm">
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
            {/* Revenue Stats Grid - Enhanced */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card variant="glass" className="p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-3">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                    {revenueData?.today || 0} zł
                  </p>
                  <p className="text-text-muted mt-2 text-sm uppercase tracking-wide">Dzisiaj</p>
                </div>
              </Card>
              
              <Card variant="glass" className="p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 mb-3">
                    <Calendar className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
                    {revenueData?.month || 0} zł
                  </p>
                  <p className="text-text-muted mt-2 text-sm uppercase tracking-wide">Ten miesiąc</p>
                </div>
              </Card>
              
              <Card variant="glass" className="p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 mb-3">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                    {revenueData?.total || 0} zł
                  </p>
                  <p className="text-text-muted mt-2 text-sm uppercase tracking-wide">Całkowity przychód</p>
                </div>
              </Card>
              
              <Card variant="glass" className="p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 mb-3">
                    <Clock className="w-6 h-6 text-orange-400" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                    {revenueData?.pending || 0} zł
                  </p>
                  <p className="text-text-muted mt-2 text-sm uppercase tracking-wide">Oczekujące</p>
                </div>
              </Card>
            </div>
            
            {/* Charts Grid - Side by Side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Area Chart - Revenue */}
              <Card variant="glass" className="p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  Przychody miesięczne
                </h3>
                {revenueData?.byMonth && revenueData.byMonth.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
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
                            borderRadius: '12px',
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
              <Card variant="glass" className="p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                  Liczba rezerwacji
                </h3>
                {revenueData?.byMonth && revenueData.byMonth.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
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
                            borderRadius: '12px',
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
                          radius={[8, 8, 0, 0]}
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

            {/* Monthly breakdown list - Enhanced */}
            <Card variant="glass" className="p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                Szczegóły miesięczne
              </h3>
              {revenueData?.byMonth && revenueData.byMonth.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {revenueData.byMonth.map((item, index) => (
                    <div 
                      key={item.month} 
                      className="relative p-5 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 group hover:scale-[1.02]"
                    >
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 font-bold">
                        {index + 1}
                      </div>
                      <p className="font-semibold text-white text-lg capitalize mb-1">
                        {new Date(item.month + '-01').toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-text-muted mb-4 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {item.count} {item.count === 1 ? 'rezerwacja' : item.count < 5 ? 'rezerwacje' : 'rezerwacji'}
                      </p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
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
                <p className="text-green-400 font-medium mb-1">✅ Automatyczne przypomnienia włączone</p>
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
                  } catch (e) {
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
                  <h4 className="text-blue-400 font-medium mb-2">⏰ Przypomnienie o odbiorze</h4>
                  <p className="text-text-muted text-sm">
                    Wysyłane do klientów z potwierdzoną rezerwacją, którzy mają odebrać sprzęt następnego dnia.
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <h4 className="text-orange-400 font-medium mb-2">⏰ Przypomnienie o zwrocie</h4>
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
                      } catch (e) {
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
                              <span className="text-green-400">✓ Wysłano do {post.sent_count} osób</span>
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
                                  } catch (e) {
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
                                } catch (e) {
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
                                  } catch (e) {
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
                                    } catch (e) {
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
                                    } catch (e) {
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
                              } catch (e) {
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
      </main>

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
          <div className={`px-5 py-3 rounded-xl shadow-xl border flex items-center gap-3 ${
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

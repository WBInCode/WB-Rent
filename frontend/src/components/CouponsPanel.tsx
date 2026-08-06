import { useEffect, useState } from 'react';
import { Ban, Copy, Mail, Plus, Printer, Ticket, X } from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import {
  cancelCoupon,
  createCoupon,
  getCoupons,
  openCouponPdf,
  sendCouponByEmail,
} from '@/services/adminApi';
import type { AdminCoupon, CouponPayload, DiscountType } from '@/services/adminApi';

interface CouponsPanelProps {
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const STATUS_STYLES: Record<AdminCoupon['status'], string> = {
  active: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 light:text-emerald-700',
  used: 'bg-sky-500/10 border-sky-500/25 text-sky-300 light:text-sky-700',
  cancelled: 'bg-white/[0.06] border-white/10 text-text-muted',
};

const STATUS_LABEL: Record<AdminCoupon['status'], string> = {
  active: 'aktywny',
  used: 'wykorzystany',
  cancelled: 'anulowany',
};

const emptyForm: CouponPayload = {
  discountType: 'percent',
  value: 10,
  customerEmail: '',
  customerName: '',
  minTotal: 0,
  validDays: 180,
  issuedForReservationId: null,
  note: '',
  sendEmail: false,
};

const formatValue = (type: DiscountType, value: number) =>
  type === 'percent' ? `${value}%` : `${Number(value).toFixed(2)} zł`;

export default function CouponsPanel({ onNotify }: CouponsPanelProps) {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, used: 0, cancelled: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponPayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async (status?: string) => {
    setLoading(true);
    const response = await getCoupons(status ?? statusFilter);
    setLoading(false);
    if (response.success) {
      setCoupons(response.data || []);
      if (response.stats) setStats(response.stats);
    } else {
      onNotify(response.message || 'Nie udało się pobrać kuponów', 'error');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setSaving(true);
    const response = await createCoupon(form);
    setSaving(false);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się wygenerować kuponu', 'error');
      return;
    }
    onNotify(response.message || 'Kupon wygenerowany');
    setModalOpen(false);
    void load();
  };

  const cancel = async (coupon: AdminCoupon) => {
    if (!window.confirm(`Anulować kupon ${coupon.code}? Klient nie będzie mógł go użyć.`)) return;
    const response = await cancelCoupon(coupon.id);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się anulować kuponu', 'error');
      return;
    }
    onNotify('Kupon anulowany');
    void load();
  };

  const resend = async (coupon: AdminCoupon) => {
    const email = coupon.customer_email
      || window.prompt('Podaj adres e-mail, na który wysłać kupon:')
      || '';
    if (!email) return;
    const response = await sendCouponByEmail(coupon.id, email);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się wysłać kuponu', 'error');
      return;
    }
    onNotify(response.message || 'Kupon wysłany');
    void load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      onNotify(`Skopiowano kod ${code}`);
    } catch {
      onNotify('Nie udało się skopiować kodu', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 rounded-[--radius-sm] border border-white/10 bg-[#101010] overflow-hidden divide-x divide-y xl:divide-y-0 divide-white/10">
        <Metric label="Wszystkich" value={stats.total} />
        <Metric label="Aktywnych" value={stats.active} tone="text-emerald-300 light:text-emerald-700" />
        <Metric label="Wykorzystanych" value={stats.used} tone="text-sky-300 light:text-sky-700" />
        <Metric label="Anulowanych" value={stats.cancelled} tone="text-text-muted" />
      </div>

      <div className="rounded-[--radius-sm] border border-white/10 bg-[#101010]">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">Kupony rabatowe</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Wygeneruj kupon na kolejny najem, wyślij mailem lub wydrukuj z kodem.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-48 shrink-0">
              <Select
                size="sm"
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); void load(event.target.value); }}
                options={[
                  { value: '', label: 'Wszystkie statusy' },
                  { value: 'active', label: 'Aktywne' },
                  { value: 'used', label: 'Wykorzystane' },
                  { value: 'cancelled', label: 'Anulowane' },
                ]}
                aria-label="Filtruj kupony"
              />
            </div>
            <Button variant="primary" size="sm" className="shrink-0" onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
              <Plus size={15} className="mr-1.5" />
              Generuj kupon
            </Button>
          </div>
        </div>

        {loading && <p className="p-6 text-sm text-text-muted">Ładowanie…</p>}

        {!loading && coupons.length === 0 && (
          <div className="p-10 text-center">
            <Ticket size={30} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-secondary">Brak kuponów w wybranym widoku.</p>
          </div>
        )}

        {!loading && coupons.length > 0 && (
          <ul className="divide-y divide-white/10">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono font-semibold text-text-primary tracking-wider">{coupon.code}</code>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gold/12 text-gold border border-gold/20">
                      -{formatValue(coupon.discount_type, Number(coupon.value))}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${STATUS_STYLES[coupon.status]}`}>
                      {STATUS_LABEL[coupon.status]}
                    </span>
                    {coupon.email_sent_at && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.06] text-text-muted border border-white/10">
                        wysłany
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {coupon.customer_name || coupon.customer_email || 'bez przypisania'}
                    {coupon.expires_on && ` · ważny do ${String(coupon.expires_on).slice(0, 10)}`}
                    {Number(coupon.min_total) > 0 && ` · od ${Number(coupon.min_total).toFixed(2)} zł`}
                    {coupon.used_reservation_id && ` · użyty w rezerwacji #${coupon.used_reservation_id}`}
                  </p>
                  {coupon.note && <p className="mt-1 text-xs text-text-secondary line-clamp-2">{coupon.note}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconButton label="Kopiuj kod" onClick={() => void copyCode(coupon.code)}>
                    <Copy size={15} />
                  </IconButton>
                  <IconButton label="Drukuj kupon (PDF)" onClick={() => void openCouponPdf(coupon.id)}>
                    <Printer size={15} />
                  </IconButton>
                  <IconButton label="Wyślij mailem" onClick={() => void resend(coupon)}>
                    <Mail size={15} />
                  </IconButton>
                  {coupon.status === 'active' && (
                    <IconButton label="Anuluj kupon" danger onClick={() => void cancel(coupon)}>
                      <Ban size={15} />
                    </IconButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card padding="none" className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[#101010] border-white/10">
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-white/10 bg-[#141414] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Generuj kupon</h3>
                <p className="text-xs text-text-muted mt-0.5">Kod powstaje losowo i jest jednorazowy.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-md text-text-muted hover:text-white hover:bg-white/5"
                aria-label="Zamknij"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Select
                  label="Typ rabatu"
                  value={form.discountType}
                  onChange={(event) => setForm({ ...form, discountType: event.target.value as DiscountType })}
                  options={[
                    { value: 'percent', label: 'Procentowy (%)' },
                    { value: 'amount', label: 'Kwotowy (zł)' },
                  ]}
                />
                <Input
                  label={form.discountType === 'percent' ? 'Wartość (%) *' : 'Wartość (zł) *'}
                  type="number"
                  value={String(form.value)}
                  onChange={(event) => setForm({ ...form, value: Number(event.target.value) })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Imię i nazwisko klienta"
                  value={form.customerName}
                  onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                  placeholder="Jan Kowalski"
                />
                <Input
                  label="E-mail klienta"
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) => setForm({ ...form, customerEmail: event.target.value })}
                  placeholder="klient@example.com"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <Input
                  label="Ważny (dni)"
                  type="number"
                  value={String(form.validDays)}
                  onChange={(event) => setForm({ ...form, validDays: Number(event.target.value) })}
                />
                <Input
                  label="Min. kwota (zł)"
                  type="number"
                  value={String(form.minTotal)}
                  onChange={(event) => setForm({ ...form, minTotal: Number(event.target.value) })}
                />
                <Input
                  label="Za rezerwację #"
                  type="number"
                  value={form.issuedForReservationId ? String(form.issuedForReservationId) : ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      issuedForReservationId: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </div>

              <Textarea
                label="Notatka"
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                rows={2}
                placeholder="Widoczna tylko w panelu"
              />

              <label className="flex items-start gap-3 p-4 rounded-lg border border-white/10 bg-white/[0.025] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sendEmail}
                  onChange={(event) => setForm({ ...form, sendEmail: event.target.checked })}
                  className="mt-1 accent-[#d4a853]"
                />
                <span className="text-sm text-text-secondary">
                  Wyślij kupon mailem od razu po wygenerowaniu (z kuponem PDF w załączniku).
                </span>
              </label>
            </div>

            <div className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-white/10 bg-[#141414] flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Anuluj</Button>
              <Button variant="primary" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Generowanie…' : 'Generuj kupon'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'text-text-primary' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="p-4">
      <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-2 rounded-md text-text-muted hover:bg-white/5 ${danger ? 'hover:text-red-400 light:text-red-700' : 'hover:text-gold'}`}
    >
      {children}
    </button>
  );
}

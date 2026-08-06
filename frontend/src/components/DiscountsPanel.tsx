import { useEffect, useState } from 'react';
import { BadgePercent, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { createDiscount, deleteDiscount, getDiscounts, updateDiscount } from '@/services/adminApi';
import type { AdminDiscount, DiscountPayload, DiscountType } from '@/services/adminApi';

interface DiscountsPanelProps {
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const CATEGORY_OPTIONS = [
  { value: 'odkurzacze-piorace', label: 'Odkurzacze piorące' },
  { value: 'odkurzacze-przemyslowe', label: 'Odkurzacze przemysłowe' },
  { value: 'ozonatory', label: 'Ozonatory i oczyszczacze' },
  { value: 'pozostale', label: 'Pozostały sprzęt' },
];

const emptyForm: DiscountPayload = {
  name: '',
  description: '',
  discountType: 'percent',
  value: 10,
  scope: 'all',
  scopeValue: '',
  minDays: 1,
  minTotal: 0,
  startsOn: null,
  endsOn: null,
  isActive: true,
};

const formatValue = (type: DiscountType, value: number) =>
  type === 'percent' ? `${value}%` : `${Number(value).toFixed(2)} zł`;

export default function DiscountsPanel({ onNotify }: DiscountsPanelProps) {
  const [discounts, setDiscounts] = useState<AdminDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DiscountPayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await getDiscounts();
    setLoading(false);
    if (response.success) setDiscounts(response.data || []);
    else onNotify(response.message || 'Nie udało się pobrać rabatów', 'error');
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (discount: AdminDiscount) => {
    setEditingId(discount.id);
    setForm({
      name: discount.name,
      description: discount.description,
      discountType: discount.discount_type,
      value: Number(discount.value),
      scope: discount.scope,
      scopeValue: discount.scope_value,
      minDays: discount.min_days,
      minTotal: Number(discount.min_total),
      startsOn: discount.starts_on ? String(discount.starts_on).slice(0, 10) : null,
      endsOn: discount.ends_on ? String(discount.ends_on).slice(0, 10) : null,
      isActive: discount.is_active,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    const response = editingId
      ? await updateDiscount(editingId, form)
      : await createDiscount(form);
    setSaving(false);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się zapisać rabatu', 'error');
      return;
    }
    onNotify(response.message || 'Rabat zapisany');
    setModalOpen(false);
    void load();
  };

  const remove = async (discount: AdminDiscount) => {
    if (!window.confirm(`Usunąć rabat "${discount.name}"?`)) return;
    const response = await deleteDiscount(discount.id);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się usunąć rabatu', 'error');
      return;
    }
    onNotify('Rabat został usunięty');
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[--radius-sm] border border-white/10 bg-[#101010]">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Rabaty automatyczne</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Naliczają się same przy rezerwacji. Klient dostaje jeden, najkorzystniejszy rabat —
              promocje i kupony nie sumują się.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={15} className="mr-1.5" />
            Nowy rabat
          </Button>
        </div>

        {loading && <p className="p-6 text-sm text-text-muted">Ładowanie…</p>}

        {!loading && discounts.length === 0 && (
          <div className="p-10 text-center">
            <BadgePercent size={30} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-secondary">Brak zdefiniowanych rabatów.</p>
          </div>
        )}

        {!loading && discounts.length > 0 && (
          <ul className="divide-y divide-white/10">
            {discounts.map((discount) => (
              <li key={discount.id} className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-primary">{discount.name}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gold/12 text-gold border border-gold/20">
                      -{formatValue(discount.discount_type, Number(discount.value))}
                    </span>
                    {!discount.is_active && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.06] text-text-muted border border-white/10">
                        wyłączony
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {discount.scope === 'all'
                      ? 'Cała oferta'
                      : discount.scope === 'category'
                        ? `Kategoria: ${discount.scope_value}`
                        : `Produkt: ${discount.scope_value}`}
                    {' · '}od {discount.min_days} dni
                    {Number(discount.min_total) > 0 && ` · od ${Number(discount.min_total).toFixed(2)} zł`}
                    {discount.starts_on && ` · od ${String(discount.starts_on).slice(0, 10)}`}
                    {discount.ends_on && ` · do ${String(discount.ends_on).slice(0, 10)}`}
                  </p>
                  {discount.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{discount.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(discount)}
                    title="Edytuj"
                    aria-label={`Edytuj rabat ${discount.name}`}
                    className="p-2 rounded-md text-text-muted hover:text-gold hover:bg-white/5"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(discount)}
                    title="Usuń"
                    aria-label={`Usuń rabat ${discount.name}`}
                    className="p-2 rounded-md text-text-muted hover:text-red-400 hover:bg-white/5"
                  >
                    <Trash2 size={15} />
                  </button>
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
              <h3 className="text-lg font-semibold text-text-primary">
                {editingId ? 'Edytuj rabat' : 'Nowy rabat'}
              </h3>
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
              <Input
                label="Nazwa *"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="np. Rabat weekendowy -15%"
              />

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
                <Select
                  label="Zakres"
                  value={form.scope}
                  onChange={(event) =>
                    setForm({ ...form, scope: event.target.value as DiscountPayload['scope'], scopeValue: '' })
                  }
                  options={[
                    { value: 'all', label: 'Cała oferta' },
                    { value: 'category', label: 'Wybrana kategoria' },
                    { value: 'product', label: 'Wybrany produkt' },
                  ]}
                />
                {form.scope === 'category' && (
                  <Select
                    label="Kategoria *"
                    value={form.scopeValue}
                    onChange={(event) => setForm({ ...form, scopeValue: event.target.value })}
                    options={[{ value: '', label: 'Wybierz kategorię' }, ...CATEGORY_OPTIONS]}
                  />
                )}
                {form.scope === 'product' && (
                  <Input
                    label="ID produktu *"
                    value={form.scopeValue}
                    onChange={(event) => setForm({ ...form, scopeValue: event.target.value })}
                    placeholder="np. puzzi-10-1"
                  />
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Minimalna liczba dni"
                  type="number"
                  value={String(form.minDays)}
                  onChange={(event) => setForm({ ...form, minDays: Number(event.target.value) })}
                />
                <Input
                  label="Minimalna kwota najmu (zł)"
                  type="number"
                  value={String(form.minTotal)}
                  onChange={(event) => setForm({ ...form, minTotal: Number(event.target.value) })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Obowiązuje od"
                  type="date"
                  value={form.startsOn || ''}
                  onChange={(event) => setForm({ ...form, startsOn: event.target.value || null })}
                />
                <Input
                  label="Obowiązuje do"
                  type="date"
                  value={form.endsOn || ''}
                  onChange={(event) => setForm({ ...form, endsOn: event.target.value || null })}
                />
              </div>

              <Textarea
                label="Opis"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={2}
                placeholder="Widoczny tylko w panelu"
              />

              <label className="flex items-start gap-3 p-4 rounded-lg border border-white/10 bg-white/[0.025] cursor-pointer">
                <input spellCheck={false}
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="mt-1 accent-[#d4a853]"
                />
                <span className="text-sm text-text-secondary">
                  Rabat aktywny — naliczany automatycznie przy spełnieniu warunków.
                </span>
              </label>
            </div>

            <div className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-white/10 bg-[#141414] flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Anuluj</Button>
              <Button variant="primary" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Zapisywanie…' : 'Zapisz rabat'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

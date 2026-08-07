import { useEffect, useState } from 'react';
import { Bell, Building2, FileText, Save, Ticket, Truck } from 'lucide-react';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { getBusinessSettings, updateBusinessSettings } from '@/services/adminApi';
import type { BusinessSettings, DiscountType } from '@/services/adminApi';

interface BusinessSettingsPanelProps {
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const defaults: BusinessSettings = {
  company: { name: '', nip: '', regon: '', address: '', postalCode: '', city: '', bankAccount: '' },
  contact: { phone: '', email: '', openingHours: '', mapUrl: '' },
  rental: {
    deliveryFee: 40, weekendPickupFee: 30, freeDeliveryFrom: 0,
    depositDefault: 0, minRentalDays: 1, maxRentalDays: 90, maxDeliveryKm: 50,
  },
  coupons: {
    defaultValidDays: 180, defaultType: 'percent', defaultValue: 10,
    autoIssueOnReturn: false, termsText: '',
  },
  notifications: {
    notifyOnReservation: true, notifyOnContractSigned: true,
    pickupReminderHours: 24, returnReminderHours: 24,
  },
  documents: { retentionMonths: 60 },
};

export default function BusinessSettingsPanel({ onNotify }: BusinessSettingsPanelProps) {
  const [settings, setSettings] = useState<BusinessSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await getBusinessSettings();
      setLoading(false);
      if (response.success) setSettings({ ...defaults, ...response.data });
      else onNotify(response.message || 'Nie udało się pobrać ustawień', 'error');
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const response = await updateBusinessSettings(settings);
    setSaving(false);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się zapisać ustawień', 'error');
      return;
    }
    onNotify('Ustawienia zostały zapisane');
  };

  const patch = <K extends keyof BusinessSettings>(group: K, values: Partial<BusinessSettings[K]>) =>
    setSettings((prev) => ({ ...prev, [group]: { ...prev[group], ...values } }));

  if (loading) return <p className="text-sm text-text-muted">Ładowanie ustawień…</p>;

  return (
    <div className="space-y-5">
      <Section icon={<Building2 size={15} />} title="Dane firmy" description="Używane na umowach, fakturach i w stopce.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nazwa firmy" value={settings.company.name}
            onChange={(e) => patch('company', { name: e.target.value })} />
          <Input label="NIP" value={settings.company.nip}
            onChange={(e) => patch('company', { nip: e.target.value })} />
          <Input label="REGON" value={settings.company.regon}
            onChange={(e) => patch('company', { regon: e.target.value })} />
          <Input label="Numer konta" value={settings.company.bankAccount}
            onChange={(e) => patch('company', { bankAccount: e.target.value })} />
          <Input label="Adres" value={settings.company.address}
            onChange={(e) => patch('company', { address: e.target.value })} />
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Input label="Kod pocztowy" value={settings.company.postalCode}
              onChange={(e) => patch('company', { postalCode: e.target.value })} />
            <Input label="Miasto" value={settings.company.city}
              onChange={(e) => patch('company', { city: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section icon={<Bell size={15} />} title="Kontakt" description="Dane pokazywane klientom na stronie.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Telefon" value={settings.contact.phone}
            onChange={(e) => patch('contact', { phone: e.target.value })} />
          <Input label="E-mail" type="email" value={settings.contact.email}
            onChange={(e) => patch('contact', { email: e.target.value })} />
          <Input label="Godziny otwarcia" value={settings.contact.openingHours}
            onChange={(e) => patch('contact', { openingHours: e.target.value })}
            placeholder="np. Pn-Nd 08:00-20:00" />
          <Input label="Link do mapy" value={settings.contact.mapUrl}
            onChange={(e) => patch('contact', { mapUrl: e.target.value })} />
        </div>
      </Section>

      <Section icon={<Truck size={15} />} title="Zasady najmu" description="Opłaty i limity stosowane przy rezerwacjach.">
        <div className="grid sm:grid-cols-3 gap-4">
          <Input label="Opłata za dostawę (zł)" type="number" value={String(settings.rental.deliveryFee)}
            onChange={(e) => patch('rental', { deliveryFee: Number(e.target.value) })} />
          <Input label="Odbiór weekendowy (zł)" type="number" value={String(settings.rental.weekendPickupFee)}
            onChange={(e) => patch('rental', { weekendPickupFee: Number(e.target.value) })} />
          <Input label="Darmowa dostawa od (zł)" type="number" value={String(settings.rental.freeDeliveryFrom)}
            onChange={(e) => patch('rental', { freeDeliveryFrom: Number(e.target.value) })} />
          <Input label="Domyślna kaucja (zł)" type="number" value={String(settings.rental.depositDefault)}
            onChange={(e) => patch('rental', { depositDefault: Number(e.target.value) })} />
          <Input label="Min. dni najmu" type="number" value={String(settings.rental.minRentalDays)}
            onChange={(e) => patch('rental', { minRentalDays: Number(e.target.value) })} />
          <Input label="Maks. dni najmu" type="number" value={String(settings.rental.maxRentalDays)}
            onChange={(e) => patch('rental', { maxRentalDays: Number(e.target.value) })} />
          <Input label="Zasięg dostawy (km)" type="number" value={String(settings.rental.maxDeliveryKm)}
            onChange={(e) => patch('rental', { maxDeliveryKm: Number(e.target.value) })} />
        </div>
      </Section>

      <Section icon={<Ticket size={15} />} title="Kupony" description="Wartości domyślne przy generowaniu kuponów.">
        <div className="grid sm:grid-cols-3 gap-4">
          <Select
            label="Domyślny typ"
            value={settings.coupons.defaultType}
            onChange={(e) => patch('coupons', { defaultType: e.target.value as DiscountType })}
            options={[
              { value: 'percent', label: 'Procentowy (%)' },
              { value: 'amount', label: 'Kwotowy (zł)' },
            ]}
          />
          <Input label="Domyślna wartość" type="number" value={String(settings.coupons.defaultValue)}
            onChange={(e) => patch('coupons', { defaultValue: Number(e.target.value) })} />
          <Input label="Domyślna ważność (dni)" type="number" value={String(settings.coupons.defaultValidDays)}
            onChange={(e) => patch('coupons', { defaultValidDays: Number(e.target.value) })} />
        </div>
        <Textarea
          label="Regulamin kuponu (na wydruku i w mailu)"
          value={settings.coupons.termsText}
          onChange={(e) => patch('coupons', { termsText: e.target.value })}
          rows={3}
          placeholder="Kupon jednorazowy, nie łączy się z innymi promocjami…"
        />
      </Section>

      <Section icon={<Bell size={15} />} title="Powiadomienia" description="Kiedy system wysyła wiadomości.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Przypomnienie o odbiorze (godz. przed)" type="number"
            value={String(settings.notifications.pickupReminderHours)}
            onChange={(e) => patch('notifications', { pickupReminderHours: Number(e.target.value) })} />
          <Input label="Przypomnienie o zwrocie (godz. przed)" type="number"
            value={String(settings.notifications.returnReminderHours)}
            onChange={(e) => patch('notifications', { returnReminderHours: Number(e.target.value) })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Toggle
            checked={settings.notifications.notifyOnReservation}
            onChange={(checked) => patch('notifications', { notifyOnReservation: checked })}
            label="Powiadom mnie o nowej rezerwacji"
          />
          <Toggle
            checked={settings.notifications.notifyOnContractSigned}
            onChange={(checked) => patch('notifications', { notifyOnContractSigned: checked })}
            label="Powiadom mnie o podpisaniu umowy"
          />
        </div>
      </Section>

      <Section icon={<FileText size={15} />} title="Dokumenty" description="Zasady przechowywania archiwum.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Okres przechowywania (miesiące)" type="number"
            value={String(settings.documents.retentionMonths)}
            onChange={(e) => patch('documents', { retentionMonths: Number(e.target.value) })} />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          <Save size={15} className="mr-1.5" />
          {saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[--radius-sm] border border-border bg-bg-card">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-surface-soft border border-border flex items-center justify-center text-gold">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Toggle({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface-soft cursor-pointer">
      <input spellCheck={false}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 accent-[#d4a853]"
      />
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

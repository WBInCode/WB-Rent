import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  Eye,
  EyeOff,
  Images,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { deleteUploadedProductImage, uploadProductImage } from '@/services/adminApi';
import type {
  AdminProduct,
  ProductCondition,
  ProductInventoryPayload,
} from '@/services/adminApi';

interface ProductInventoryPanelProps {
  products: AdminProduct[];
  loading: boolean;
  onSave: (payload: ProductInventoryPayload, editingId?: string) => Promise<boolean>;
  onDelete: (product: AdminProduct) => void;
}

const CATEGORY_OPTIONS = [
  { value: 'odkurzacze-piorace', label: 'Odkurzacze piorące' },
  { value: 'odkurzacze-przemyslowe', label: 'Odkurzacze przemysłowe' },
  { value: 'ozonatory', label: 'Ozonatory i oczyszczacze' },
  { value: 'pozostale', label: 'Pozostały sprzęt' },
];

const CONDITION_OPTIONS: Array<{ value: ProductCondition; label: string }> = [
  { value: 'good', label: 'Sprawny' },
  { value: 'attention', label: 'Wymaga uwagi' },
  { value: 'service', label: 'W serwisie' },
  { value: 'damaged', label: 'Uszkodzony' },
];

const CONDITION_STYLES: Record<ProductCondition, string> = {
  good: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 light:text-emerald-700',
  attention: 'bg-amber-500/10 border-amber-500/25 text-amber-300 light:text-amber-700',
  service: 'bg-sky-500/10 border-sky-500/25 text-sky-300 light:text-sky-700',
  damaged: 'bg-red-500/10 border-red-500/25 text-red-300 light:text-red-700',
};

const emptyProduct: ProductInventoryPayload = {
  id: '',
  name: '',
  description: '',
  categoryId: 'pozostale',
  image: '/favicon.svg',
  images: [],
  pricePerDay: 0,
  priceNextDay: 0,
  priceWeekend: 0,
  totalQuantity: 1,
  serviceQuantity: 0,
  conditionStatus: 'good',
  inventoryNotes: '',
  features: [],
  includedAccessories: [],
  optionalAccessories: [],
  accessoryPrice: 0,
  isActive: true,
};

const toPayload = (product: AdminProduct): ProductInventoryPayload => {
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || '/favicon.svg'];
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    categoryId: product.category_id,
    image: images[0],
    images,
    pricePerDay: Number(product.price_per_day),
    priceNextDay: Number(product.price_next_day),
    priceWeekend: Number(product.price_weekend),
    totalQuantity: Number(product.total_quantity),
    serviceQuantity: Number(product.service_quantity),
    conditionStatus: product.condition_status,
    inventoryNotes: product.inventory_notes || '',
    features: Array.isArray(product.features) ? product.features : [],
    includedAccessories: Array.isArray(product.included_accessories) ? product.included_accessories : [],
    optionalAccessories: Array.isArray(product.optional_accessories) ? product.optional_accessories : [],
    accessoryPrice: Number(product.accessory_price || 0),
    isActive: Boolean(product.is_active),
  };
};

export function ProductInventoryPanel({
  products,
  loading,
  onSave,
  onDelete,
}: ProductInventoryPanelProps) {
  const [query, setQuery] = useState('');
  const [condition, setCondition] = useState('all');
  const [includeHidden, setIncludeHidden] = useState(true);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState<ProductInventoryPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [sessionUploads, setSessionUploads] = useState<string[]>([]);

  const totals = useMemo(() => products.reduce((result, product) => ({
    units: result.units + Number(product.total_quantity),
    available: result.available + Number(product.available_today),
    rented: result.rented + Number(product.reserved_today),
    service: result.service + Number(product.service_quantity),
  }), { units: 0, available: 0, rented: 0, service: 0 }), [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pl');
    return products.filter((product) => {
      if (!includeHidden && !product.is_active) return false;
      if (condition !== 'all' && product.condition_status !== condition) return false;
      if (!normalized) return true;
      return `${product.name} ${product.id} ${product.category_id}`
        .toLocaleLowerCase('pl')
        .includes(normalized);
    });
  }, [products, query, condition, includeHidden]);

  const openNew = () => {
    setEditingId(undefined);
    setOriginalImages([]);
    setSessionUploads([]);
    setImageUrl('');
    setForm({ ...emptyProduct, images: [] });
  };

  const openEdit = (product: AdminProduct) => {
    const payload = toPayload(product);
    setEditingId(product.id);
    setOriginalImages(payload.images);
    setSessionUploads([]);
    setImageUrl('');
    setForm(payload);
  };

  const updateImages = (images: string[]) => {
    setForm((current) => current ? { ...current, images, image: images[0] || '' } : current);
  };

  const closeForm = async () => {
    const uploads = [...sessionUploads];
    setSessionUploads([]);
    setForm(null);
    await Promise.all(uploads.map((url) => deleteUploadedProductImage(url)));
  };

  const addImageUrl = () => {
    if (!form) return;
    const url = imageUrl.trim();
    if (!url || form.images.includes(url) || form.images.length >= 12) return;
    updateImages([...form.images, url]);
    setImageUrl('');
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!form || !files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 12 - form.images.length));
    if (selected.length === 0) return;
    setUploadingImages(true);
    const uploaded: string[] = [];
    for (const file of selected) {
      const result = await uploadProductImage(file);
      if (result.success && result.data?.url) uploaded.push(result.data.url);
    }
    if (uploaded.length > 0) {
      updateImages([...form.images, ...uploaded]);
      setSessionUploads((current) => [...current, ...uploaded]);
    }
    setUploadingImages(false);
  };

  const removeImage = async (index: number) => {
    if (!form || form.images.length <= 1) return;
    const url = form.images[index];
    updateImages(form.images.filter((_, imageIndex) => imageIndex !== index));
    if (sessionUploads.includes(url)) {
      setSessionUploads((current) => current.filter((item) => item !== url));
      await deleteUploadedProductImage(url);
    }
  };

  const moveImage = (index: number, target: number) => {
    if (!form || target < 0 || target >= form.images.length || index === target) return;
    const images = [...form.images];
    const [image] = images.splice(index, 1);
    images.splice(target, 0, image);
    updateImages(images);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || form.images.length === 0) return;
    setSaving(true);
    const saved = await onSave({ ...form, image: form.images[0] }, editingId);
    setSaving(false);
    if (saved) {
      const removedUploads = originalImages.filter((url) =>
        url.startsWith('/api/product-images/') && !form.images.includes(url)
      );
      setSessionUploads([]);
      setForm(null);
      await Promise.all(removedUploads.map((url) => deleteUploadedProductImage(url)));
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[--radius-sm] border border-white/10 bg-[#101010] overflow-hidden">
        <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-y xl:divide-y-0 divide-white/10">
          <InventoryMetric icon={<Boxes className="w-5 h-5" />} label="Wszystkie sztuki" value={totals.units} />
          <InventoryMetric icon={<Package className="w-5 h-5" />} label="Dostępne dzisiaj" value={totals.available} tone="text-emerald-300 light:text-emerald-700" />
          <InventoryMetric icon={<Eye className="w-5 h-5" />} label="Wynajęte dzisiaj" value={totals.rented} tone="text-gold" />
          <InventoryMetric icon={<Wrench className="w-5 h-5" />} label="Wyłączone / serwis" value={totals.service} tone="text-sky-300 light:text-sky-700" />
        </div>
      </div>

      <div className="rounded-[--radius-sm] border border-white/10 bg-[#101010]">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold">Flota i stany magazynowe</h2>
            <p className="text-xs text-text-muted mt-1">Dostępność uwzględnia aktywne rezerwacje i sztuki oddane do serwisu.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <div className="sm:w-64">
              <Input
                size="sm"
                aria-label="Szukaj produktu"
                placeholder="Nazwa lub ID produktu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="sm:w-48">
              <Select
                size="sm"
                aria-label="Filtr stanu technicznego"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
                options={[{ value: 'all', label: 'Każdy stan' }, ...CONDITION_OPTIONS]}
              />
            </div>
            <Button variant="primary" size="sm" className="shrink-0" onClick={openNew}>
              <Plus className="w-4 h-4" /> Dodaj produkt
            </Button>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between gap-4 text-xs text-text-muted">
          <span>{filteredProducts.length} z {products.length} modeli</span>
          <label className="inline-flex items-center gap-2 cursor-pointer text-text-secondary">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(event) => setIncludeHidden(event.target.checked)}
              className="accent-[#d4a853]"
            />
            Pokaż ukryte
          </label>
        </div>

        <div className="hidden xl:grid grid-cols-[minmax(300px,1.8fr)_130px_210px_180px_150px] gap-4 px-5 py-3 border-b border-white/10 text-[11px] uppercase text-text-muted font-semibold">
          <span>Produkt</span>
          <span>Stan</span>
          <span>Bilans sztuk</span>
          <span>Cennik</span>
          <span className="text-right">Akcje</span>
        </div>

        <div className="divide-y divide-white/10">
          {filteredProducts.map((product) => {
            const total = Number(product.total_quantity);
            const available = Number(product.available_today);
            const rented = Number(product.reserved_today);
            const service = Number(product.service_quantity);
            const usedPercent = total > 0 ? Math.min(100, ((rented + service) / total) * 100) : 100;
            return (
              <div key={product.id} className={`grid xl:grid-cols-[minmax(300px,1.8fr)_130px_210px_180px_150px] gap-4 px-4 sm:px-5 py-4 items-center ${!product.is_active ? 'opacity-55' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg border border-white/10 bg-white overflow-hidden shrink-0">
                    <img src={product.image || '/favicon.svg'} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{product.name}</p>
                      {!product.is_active && <EyeOff className="w-3.5 h-3.5 text-text-muted shrink-0" aria-label="Ukryty" />}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 truncate">{product.id} · {product.category_id}</p>
                  </div>
                </div>

                <div>
                  <span className={`inline-flex px-2.5 py-1 rounded-md border text-xs font-medium ${CONDITION_STYLES[product.condition_status]}`}>
                    {CONDITION_OPTIONS.find((item) => item.value === product.condition_status)?.label}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <strong className="text-emerald-300 light:text-emerald-700">{available} dostępne</strong>
                    <span className="text-text-muted">{rented} wynajęte · {service} serwis</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${usedPercent}%` }} />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">Stan całkowity: {total}</p>
                </div>

                <div className="text-xs text-text-secondary leading-5">
                  <p><span className="text-text-muted">1 doba</span> {Number(product.price_per_day).toFixed(2)} zł</p>
                  <p><span className="text-text-muted">kolejna</span> {Number(product.price_next_day).toFixed(2)} zł</p>
                  <p><span className="text-text-muted">weekend</span> {Number(product.price_weekend).toFixed(2)} zł</p>
                </div>

                <div className="flex xl:justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(product)} aria-label={`Edytuj ${product.name}`} title="Edytuj produkt">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(product)} aria-label={`Usuń ${product.name}`} title="Usuń produkt">
                    <Trash2 className="w-4 h-4 text-red-300 light:text-red-700" />
                  </Button>
                </div>
              </div>
            );
          })}

          {!loading && filteredProducts.length === 0 && (
            <div className="px-5 py-14 text-center">
              <Package className="w-8 h-8 text-text-muted mx-auto" />
              <p className="text-sm font-medium mt-3">Brak produktów dla wybranych filtrów</p>
              <p className="text-xs text-text-muted mt-1">Zmień filtr albo dodaj nową pozycję do floty.</p>
            </div>
          )}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card variant="glass" padding="none" className="w-full max-w-4xl max-h-[94vh] overflow-y-auto">
            <form onSubmit={submit}>
              <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-white/10 bg-[#141414] flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase text-gold font-semibold">{editingId ? 'Edycja floty' : 'Nowa pozycja'}</p>
                  <h2 className="text-xl font-bold mt-1">{editingId ? 'Zmień produkt i stan' : 'Dodaj produkt do oferty'}</h2>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => void closeForm()} aria-label="Zamknij">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold mb-3">Dane produktu</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      label="ID produktu"
                      value={form.id}
                      disabled={Boolean(editingId)}
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      hint={editingId ? 'ID jest stałe po utworzeniu produktu.' : 'Małe litery, cyfry i myślniki, np. puzzi-10-1-b.'}
                      onChange={(event) => setForm({ ...form, id: event.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    />
                    <Input label="Nazwa" value={form.name} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
                    <Select
                      label="Kategoria"
                      value={form.categoryId}
                      options={CATEGORY_OPTIONS}
                      onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                    />
                  </div>
                  <Textarea className="mt-4" label="Opis w ofercie" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />

                  <div className="mt-5 pt-5 border-t border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2"><Images className="w-4 h-4 text-gold" /> Galeria produktu</h4>
                        <p className="text-xs text-text-muted mt-1">Pierwsze zdjęcie jest główne. Maksymalnie 12 plików JPG, PNG lub WebP.</p>
                      </div>
                      <span className="text-xs text-text-muted">{form.images.length}/12</span>
                    </div>

                    {form.images.length > 0 ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {form.images.map((url, index) => (
                          <div key={url} className={`rounded-lg border overflow-hidden ${index === 0 ? 'border-gold/60 bg-gold/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
                            <div className="relative aspect-[4/3] bg-white">
                              <img src={url} alt={`Zdjęcie ${index + 1}`} className="absolute inset-0 w-full h-full object-contain p-2" />
                              {index === 0 && (
                                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/80 text-gold text-[10px] font-semibold">
                                  <Star className="w-3 h-3" fill="currentColor" /> Główne
                                </span>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-[10px] text-text-muted truncate" title={url}>{url}</p>
                              <div className="flex items-center gap-1 mt-2">
                                {index !== 0 && (
                                  <button type="button" onClick={() => moveImage(index, 0)} className="p-2 rounded-md text-text-muted hover:text-gold hover:bg-white/5" title="Ustaw jako główne" aria-label={`Ustaw zdjęcie ${index + 1} jako główne`}>
                                    <Star className="w-4 h-4" />
                                  </button>
                                )}
                                <button type="button" disabled={index === 0} onClick={() => moveImage(index, index - 1)} className="p-2 rounded-md text-text-muted hover:text-white hover:bg-white/5 disabled:opacity-25" title="Przesuń wcześniej" aria-label={`Przesuń zdjęcie ${index + 1} wcześniej`}>
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button type="button" disabled={index === form.images.length - 1} onClick={() => moveImage(index, index + 1)} className="p-2 rounded-md text-text-muted hover:text-white hover:bg-white/5 disabled:opacity-25" title="Przesuń później" aria-label={`Przesuń zdjęcie ${index + 1} później`}>
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                                <button type="button" disabled={form.images.length <= 1} onClick={() => void removeImage(index)} className="ml-auto p-2 rounded-md text-red-300 light:text-red-700 hover:bg-red-500/10 disabled:opacity-25" title={form.images.length <= 1 ? 'Produkt musi zachować co najmniej jedno zdjęcie' : 'Usuń z galerii'} aria-label={`Usuń zdjęcie ${index + 1}`}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/[0.05] text-center">
                        <Images className="w-7 h-7 mx-auto text-amber-300 light:text-amber-700" />
                        <p className="text-sm text-amber-200 mt-2">Dodaj co najmniej jedno zdjęcie produktu</p>
                      </div>
                    )}

                    <div className="grid md:grid-cols-[1fr_auto] gap-2 mt-4">
                      <Input
                        aria-label="Adres zdjęcia"
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="/products/zdjecie.jpg lub https://..."
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addImageUrl();
                          }
                        }}
                      />
                      <Button type="button" variant="secondary" size="sm" onClick={addImageUrl} disabled={!imageUrl.trim() || form.images.length >= 12}>
                        <Plus className="w-4 h-4" /> Dodaj adres
                      </Button>
                    </div>

                    <label className={`mt-3 min-h-11 px-4 py-2.5 rounded-lg border border-gold/30 text-gold text-sm font-medium inline-flex items-center gap-2 cursor-pointer hover:bg-gold/10 ${uploadingImages || form.images.length >= 12 ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload className="w-4 h-4" />
                      {uploadingImages ? 'Wysyłanie zdjęć...' : 'Wybierz zdjęcia z urządzenia'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="sr-only"
                        disabled={uploadingImages || form.images.length >= 12}
                        onChange={(event) => {
                          void uploadFiles(event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </section>

                <section className="pt-5 border-t border-white/10">
                  <h3 className="text-sm font-semibold mb-3">Cennik</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <NumberInput label="Pierwsza doba (zł)" value={form.pricePerDay} onChange={(value) => setForm({ ...form, pricePerDay: value })} />
                    <NumberInput label="Kolejna doba (zł)" value={form.priceNextDay} onChange={(value) => setForm({ ...form, priceNextDay: value })} />
                    <NumberInput label="Pakiet weekendowy (zł)" value={form.priceWeekend} onChange={(value) => setForm({ ...form, priceWeekend: value })} />
                  </div>
                </section>

                <section className="pt-5 border-t border-white/10">
                  <h3 className="text-sm font-semibold mb-1">Opis oferty</h3>
                  <p className="text-xs text-text-muted mb-3">
                    Widoczne na stronie produktu. Każdą pozycję wpisz w nowej linii.
                  </p>
                  <ListEditor
                    label="Cechy / zalety"
                    placeholder={'Pranie tapicerki\nZbiornik 10L'}
                    values={form.features}
                    onChange={(values) => setForm({ ...form, features: values })}
                  />
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <ListEditor
                      label="Akcesoria w cenie"
                      placeholder={'2x 100g środek czyszczący'}
                      values={form.includedAccessories}
                      onChange={(values) => setForm({ ...form, includedAccessories: values })}
                    />
                    <ListEditor
                      label="Akcesoria dodatkowo płatne"
                      placeholder={'środek czyszczący RM 780'}
                      values={form.optionalAccessories}
                      onChange={(values) => setForm({ ...form, optionalAccessories: values })}
                    />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 mt-4">
                    <NumberInput
                      label="Cena akcesorium (zł)"
                      value={form.accessoryPrice}
                      onChange={(value) => setForm({ ...form, accessoryPrice: value })}
                    />
                  </div>
                </section>

                <section className="pt-5 border-t border-white/10">
                  <h3 className="text-sm font-semibold mb-3">Magazyn i stan techniczny</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <NumberInput label="Ilość całkowita" integer value={form.totalQuantity} onChange={(value) => setForm({ ...form, totalQuantity: value })} />
                    <NumberInput label="Sztuki w serwisie" integer value={form.serviceQuantity} onChange={(value) => setForm({ ...form, serviceQuantity: value })} />
                    <Select
                      label="Stan techniczny"
                      value={form.conditionStatus}
                      options={CONDITION_OPTIONS}
                      onChange={(event) => setForm({ ...form, conditionStatus: event.target.value as ProductCondition })}
                    />
                  </div>
                  {form.serviceQuantity > form.totalQuantity && (
                    <div className="mt-3 p-3 rounded-lg border border-red-500/25 bg-red-500/[0.08] text-sm text-red-300 light:text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Liczba sztuk w serwisie nie może przekraczać stanu całkowitego.
                    </div>
                  )}
                  <Textarea className="mt-4" label="Notatka magazynowa" value={form.inventoryNotes} onChange={(event) => setForm({ ...form, inventoryNotes: event.target.value })} />
                  <label className="mt-4 flex items-start gap-3 p-4 rounded-lg border border-white/10 bg-white/[0.025] cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="mt-1 accent-[#d4a853]" />
                    <span>
                      <span className="block text-sm font-medium">Widoczny i dostępny do nowych rezerwacji</span>
                      <span className="block text-xs text-text-muted mt-1">Wyłączenie ukrywa produkt w ofercie, ale zachowuje historię wynajmów i umów.</span>
                    </span>
                  </label>
                </section>
              </div>

              <div className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-white/10 bg-[#141414] flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => void closeForm()}>Anuluj</Button>
                <Button type="submit" disabled={saving || uploadingImages || form.images.length === 0 || form.serviceQuantity > form.totalQuantity} isLoading={saving}>
                  Zapisz produkt
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function InventoryMetric({ icon, label, value, tone = 'text-white' }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <div className="p-4 sm:p-5 flex items-center gap-3">
      <span className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-text-muted">{icon}</span>
      <span>
        <span className="block text-[11px] text-text-muted">{label}</span>
        <strong className={`block text-xl mt-0.5 ${tone}`}>{value}</strong>
      </span>
    </div>
  );
}

function NumberInput({ label, value, onChange, integer = false }: { label: string; value: number; onChange: (value: number) => void; integer?: boolean }) {
  return (
    <Input
      label={label}
      type="number"
      min={0}
      max={integer ? 10000 : 100000}
      step={integer ? 1 : 0.01}
      value={value}
      required
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

/** One item per line - simplest editor that keeps ordering obvious. */
function ListEditor({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <Textarea
      label={label}
      rows={4}
      placeholder={placeholder}
      value={values.join('\n')}
      onChange={(event) =>
        onChange(
          event.target.value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        )
      }
    />
  );
}
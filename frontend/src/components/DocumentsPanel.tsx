import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Download,
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import {
  deleteDocument,
  downloadDocument,
  getDocuments,
  setDocumentArchived,
  updateDocument,
  uploadDocument,
} from '@/services/adminApi';
import type { AdminDocument, DocumentCategory, DocumentMetadataPayload } from '@/services/adminApi';

interface DocumentsPanelProps {
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'contract', label: 'Umowa' },
  { value: 'invoice', label: 'Faktura' },
  { value: 'protocol', label: 'Protokół zdawczo-odbiorczy' },
  { value: 'identity', label: 'Dokument tożsamości' },
  { value: 'insurance', label: 'Ubezpieczenie' },
  { value: 'service', label: 'Serwis / przegląd' },
  { value: 'other', label: 'Inny' },
];

const CATEGORY_LABEL: Record<DocumentCategory, string> = CATEGORY_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<DocumentCategory, string>
);

const emptyForm: DocumentMetadataPayload = {
  title: '',
  category: 'contract',
  reservationId: null,
  customerEmail: '',
  documentDate: null,
  notes: '',
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;

const formatDate = (value: string | null) => (value ? String(value).slice(0, 10) : '—');

export default function DocumentsPanel({ onNotify }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDocument | null>(null);
  const [form, setForm] = useState<DocumentMetadataPayload>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async (overrides?: { archived?: boolean; category?: string; search?: string }) => {
    setLoading(true);
    const response = await getDocuments({
      archived: overrides?.archived ?? showArchived,
      category: overrides?.category ?? category,
      search: overrides?.search ?? search,
    });
    setLoading(false);
    if (response.success) setDocuments(response.data || []);
    else onNotify(response.message || 'Nie udało się pobrać dokumentów', 'error');
  };

  useEffect(() => {
    void load();
    // Initial fetch only - later refreshes are triggered by the filter controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = documents.length;
    const manual = documents.filter((doc) => doc.source === 'manual').length;
    const size = documents.reduce((sum, doc) => sum + Number(doc.size_bytes || 0), 0);
    return { total, manual, size };
  }, [documents]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFile(null);
    setModalOpen(true);
  };

  const openEdit = (doc: AdminDocument) => {
    setEditing(doc);
    setForm({
      title: doc.title,
      category: doc.category,
      reservationId: doc.reservation_id,
      customerEmail: doc.customer_email,
      documentDate: doc.document_date ? String(doc.document_date).slice(0, 10) : null,
      notes: doc.notes,
    });
    setFile(null);
    setModalOpen(true);
  };

  const submit = async () => {
    if (form.title.trim().length < 2) {
      onNotify('Podaj tytuł dokumentu (min. 2 znaki)', 'error');
      return;
    }
    if (!editing && !file) {
      onNotify('Wybierz plik do wysłania', 'error');
      return;
    }

    setSaving(true);
    const response = editing
      ? await updateDocument(editing.id, form)
      : await uploadDocument(file as File, form);
    setSaving(false);

    if (!response.success) {
      onNotify(response.message || 'Nie udało się zapisać dokumentu', 'error');
      return;
    }
    onNotify(response.message || 'Dokument zapisany');
    setModalOpen(false);
    void load();
  };

  const toggleArchive = async (doc: AdminDocument) => {
    const response = await setDocumentArchived(doc.id, !doc.archived_at);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się zmienić statusu', 'error');
      return;
    }
    onNotify(response.message || 'Zapisano');
    void load();
  };

  const remove = async (doc: AdminDocument) => {
    if (!window.confirm(`Trwale usunąć dokument "${doc.title}"? Tej operacji nie można cofnąć.`)) return;
    const response = await deleteDocument(doc.id);
    if (!response.success) {
      onNotify(response.message || 'Nie udało się usunąć dokumentu', 'error');
      return;
    }
    onNotify('Dokument został usunięty');
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 rounded-[--radius-sm] border border-white/10 bg-[#101010] overflow-hidden divide-x divide-y xl:divide-y-0 divide-white/10">
        <Metric icon={<FileText size={16} />} label="Dokumentów" value={String(stats.total)} />
        <Metric icon={<Upload size={16} />} label="Wgranych ręcznie" value={String(stats.manual)} />
        <Metric icon={<Archive size={16} />} label="Widok" value={showArchived ? 'Archiwum' : 'Aktywne'} />
        <Metric icon={<Download size={16} />} label="Rozmiar" value={formatSize(stats.size)} />
      </div>

      <div className="rounded-[--radius-sm] border border-white/10 bg-[#101010]">
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                size="sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void load(); }}
                placeholder="Szukaj: tytuł, e-mail, plik"
                aria-label="Szukaj dokumentów"
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-60 shrink-0">
              <Select
                size="sm"
                value={category}
                onChange={(event) => { setCategory(event.target.value); void load({ category: event.target.value }); }}
                options={[{ value: '', label: 'Wszystkie kategorie' }, ...CATEGORY_OPTIONS]}
                aria-label="Filtruj po kategorii"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => { const next = !showArchived; setShowArchived(next); void load({ archived: next }); }}
            >
              <Filter size={15} className="mr-1.5" />
              {showArchived ? 'Pokaż aktywne' : 'Pokaż archiwum'}
            </Button>
            <Button variant="primary" size="sm" className="shrink-0" onClick={openCreate}>
              <Plus size={15} className="mr-1.5" />
              Dodaj dokument
            </Button>
          </div>
        </div>

        {loading && <p className="p-6 text-sm text-text-muted">Ładowanie dokumentów…</p>}

        {!loading && documents.length === 0 && (
          <div className="p-10 text-center">
            <FileText size={30} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-secondary">
              {showArchived ? 'Archiwum jest puste.' : 'Brak dokumentów. Dodaj pierwszy plik.'}
            </p>
          </div>
        )}

        {!loading && documents.length > 0 && (
          <ul className="divide-y divide-white/10">
            {documents.map((doc) => (
              <li key={doc.id} className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-primary truncate">{doc.title}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gold/12 text-gold border border-gold/20">
                      {CATEGORY_LABEL[doc.category]}
                    </span>
                    {doc.source === 'manual' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.06] text-text-muted border border-white/10">
                        wgrany ręcznie
                      </span>
                    )}
                    {doc.archived_at && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                        archiwum
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted truncate">
                    {formatDate(doc.document_date)} · {formatSize(Number(doc.size_bytes))}
                    {doc.customer_email ? ` · ${doc.customer_email}` : ''}
                    {doc.reservation_id ? ` · rezerwacja #${doc.reservation_id}` : ''}
                  </p>
                  {doc.notes && <p className="mt-1 text-xs text-text-secondary line-clamp-2">{doc.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconButton label="Pobierz" onClick={() => void downloadDocument(doc)}>
                    <Download size={15} />
                  </IconButton>
                  <IconButton label="Edytuj opis" onClick={() => openEdit(doc)}>
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    label={doc.archived_at ? 'Przywróć z archiwum' : 'Przenieś do archiwum'}
                    onClick={() => void toggleArchive(doc)}
                  >
                    {doc.archived_at ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                  </IconButton>
                  <IconButton label="Usuń" danger onClick={() => void remove(doc)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card padding="none" className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#101010] border-white/10">
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-white/10 bg-[#141414] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {editing ? 'Edytuj dokument' : 'Dodaj dokument'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {editing
                    ? 'Zmieniasz wyłącznie opis. Sam plik pozostaje bez zmian.'
                    : 'PDF, JPG, PNG lub WebP, maksymalnie 15 MB. Plik jest szyfrowany.'}
                </p>
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
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Plik *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                    className="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold file:text-black file:font-medium hover:file:bg-gold-light cursor-pointer"
                  />
                  {file && (
                    <p className="mt-2 text-xs text-text-muted">
                      {file.name} · {formatSize(file.size)}
                    </p>
                  )}
                </div>
              )}

              <Input
                label="Tytuł *"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="np. Umowa najmu 2026/07/12 — Jan Kowalski"
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <Select
                  label="Kategoria"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as DocumentCategory })}
                  options={CATEGORY_OPTIONS}
                />
                <Input
                  label="Data dokumentu"
                  type="date"
                  value={form.documentDate || ''}
                  onChange={(event) => setForm({ ...form, documentDate: event.target.value || null })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="E-mail klienta"
                  type="email"
                  value={form.customerEmail || ''}
                  onChange={(event) => setForm({ ...form, customerEmail: event.target.value })}
                  placeholder="klient@example.com"
                />
                <Input
                  label="Numer rezerwacji"
                  type="number"
                  value={form.reservationId ? String(form.reservationId) : ''}
                  onChange={(event) =>
                    setForm({ ...form, reservationId: event.target.value ? Number(event.target.value) : null })
                  }
                  placeholder="np. 128"
                />
              </div>

              <Textarea
                label="Notatka"
                value={form.notes || ''}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={3}
                placeholder="Dodatkowe informacje, np. umowa podpisana papierowo w biurze"
              />
            </div>

            <div className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-white/10 bg-[#141414] flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Anuluj</Button>
              <Button variant="primary" onClick={() => void submit()} disabled={saving}>
                {saving ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Dodaj do archiwum'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-text-muted">
        {icon}
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
        <p className="text-base font-semibold text-text-primary">{value}</p>
      </div>
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
      className={`p-2 rounded-md text-text-muted hover:bg-white/5 ${danger ? 'hover:text-red-400' : 'hover:text-gold'}`}
    >
      {children}
    </button>
  );
}

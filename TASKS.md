# WB-Rent - Task Checklist

> **Projekt:** Strona wypożyczalni sprzętu czyszczącego i ozonatorów  
> **Stack:** React + TypeScript (Vite) | Node.js + Express | SQLite  
> **Styl:** Dark + Gold premium (Linear-like motion)

---

## 🚀 MVP Tasks

### 0. Inicjalizacja projektu
- [x] Utworzenie projektu React + Vite + TypeScript
- [x] Konfiguracja TailwindCSS
- [x] Instalacja zależności (framer-motion, react-hook-form, zod, lucide-react)
- [x] Struktura folderów (components, pages, services, hooks, lib, data)
- [ ] Utworzenie backendu Node.js + Express (folder /server)

### 1. Design System
- [x] Tokeny kolorów (dark grafit + złoty amber)
- [x] Tokeny typografii (font-family, sizes, weights)
- [x] Tokeny motion (easing, duration, spring configs)
- [x] Komponent Button (primary/secondary/ghost)
- [x] Komponent Card (glass/dark style)
- [x] Komponent Input + Label
- [x] Komponent Select
- [x] Komponent Badge (status: dostępny/wypożyczony)
- [x] Komponent Toggle/Switch

### 2. Layout sekcji (statyczne)
- [ ] Navbar (logo + linki + CTA)
- [ ] Hero (headline + widget "Sprawdź koszty")
- [ ] Sekcja Kategorie (Ozonatory, Sprzęt czyszczący + placeholdery)
- [ ] Sekcja Produkty (grid placeholder)
- [ ] Sekcja "Jak to działa" (4 kroki)
- [ ] Sekcja Rezerwacja (placeholder formularza)
- [ ] Sekcja FAQ + Kontakt
- [ ] Footer

### 3. Motion System
- [ ] Hook useScrollReveal (IntersectionObserver)
- [ ] Komponenty Reveal + Stagger (framer-motion)
- [ ] HoverCard effect (lift + glow)
- [ ] Navbar scroll effect (blur + shadow)
- [ ] Animated tabs/pills (layoutId)
- [ ] Prefers-reduced-motion support
- [ ] Parallax tła (opcjonalnie, lekki)

### 4. Produkty
- [ ] Dane demo (2 ozonatory + 4 sprzęty czyszczące)
- [ ] Karta produktu (ProductCard)
- [ ] Filtry kategorii (tabs z licznikami)
- [ ] Wyszukiwarka produktów
- [ ] Status dostępności (badge)
- [ ] Przycisk "Zobacz ceny" / "Rezerwuj"

### 5. Formularz Rezerwacji (Frontend)
- [ ] Schema Zod dla rezerwacji
- [ ] Select kategorii → Select urządzenia (zależny)
- [ ] Date picker (data rozpoczęcia, zakończenia)
- [ ] Input miasto + toggle dostawa + adres (warunkowo)
- [ ] Dane kontaktowe (imię, nazwisko, email, telefon, firma)
- [ ] Checkbox zgody (regulamin, RODO)
- [ ] Podsumowanie kosztów (kalkulacja: dni × stawka + dostawa)
- [ ] Stany: loading, success, error
- [ ] Integracja z react-hook-form

### 6. Formularz Kontaktowy (Frontend)
- [ ] Schema Zod dla kontaktu
- [ ] Pola: imię, email, temat (opcjonalnie), wiadomość
- [ ] Honeypot anti-spam
- [ ] Stany: loading, success, error

### 7. Backend API
- [ ] Setup Express + TypeScript
- [ ] Middleware: CORS, JSON parser, rate limiting
- [ ] POST /api/contact (walidacja + zapis)
- [ ] POST /api/reservations (walidacja + zapis)
- [ ] Konfiguracja SQLite (tabele: contacts, reservations)
- [ ] Nodemailer setup (SMTP)
- [ ] Wysyłka maila potwierdzającego (kontakt + rezerwacja)
- [ ] Obsługa błędów + kody odpowiedzi

### 8. Integracja FE ↔ BE
- [ ] Service layer (/services/api.ts)
- [ ] Hook useSubmitForm (generic)
- [ ] Obsługa błędów API na froncie
- [ ] Test flow: rezerwacja end-to-end
- [ ] Test flow: kontakt end-to-end

### 9. Polish & QA
- [ ] Responsywność (mobile-first audit)
- [ ] Dostępność (aria-labels, focus states, keyboard nav)
- [ ] Testy manualne wszystkich formularzy
- [ ] Optymalizacja performance (lazy load, code split)
- [ ] SEO basics (meta tags, OG, title)
- [ ] Favicon + manifest

### 10. Dokumentacja
- [ ] README.md z instrukcją uruchomienia
- [ ] .env.example dla backendu
- [ ] Opis endpointów API

---

## 📝 Log zmian

| Data | Task | Status | Notatki |
|------|------|--------|---------|
| 2026-01-19 | TASKS.md utworzony | ✅ | Checklist zgodna z planem |
| 2026-01-19 | Init projektu (task 0) | ✅ | Vite + React + TS, TailwindCSS v4, struktura folderów |
| 2026-01-19 | Design System (task 1) | ✅ | Button, Card, Input, Select, Badge, Toggle, Textarea + motion tokens |

---

## 🎨 Design Reference

- **Kolory:** `#0a0a0a` (bg), `#1a1a1a` (card), `#f59e0b` (gold), `#fbbf24` (gold-light)
- **Border radius:** 16-24px (cards), 8-12px (buttons/inputs)
- **Motion:** duration 0.3-0.5s, ease `[0.25, 0.1, 0.25, 1]`
- **Fonts:** Inter (body), + bold weight dla nagłówków


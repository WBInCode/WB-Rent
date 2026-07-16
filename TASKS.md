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
- [x] Utworzenie backendu Node.js + Express (folder /server)

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
- [x] Navbar (logo + linki + CTA)
- [x] Hero (headline + widget "Sprawdź koszty")
- [x] Sekcja Kategorie (Ozonatory, Sprzęt czyszczący + placeholdery)
- [x] Sekcja Produkty (grid placeholder)
- [x] Sekcja "Jak to działa" (4 kroki)
- [x] Sekcja Rezerwacja (placeholder formularza)
- [x] Sekcja FAQ + Kontakt
- [x] Footer

### 3. Motion System
- [x] Hook useScrollReveal (IntersectionObserver)
- [x] Komponenty Reveal + Stagger (framer-motion)
- [x] HoverCard effect (lift + glow)
- [x] Navbar scroll effect (blur + shadow)
- [x] Animated tabs/pills (layoutId)
- [x] Prefers-reduced-motion support
- [x] Parallax tła (opcjonalnie, lekki)

### 4. Produkty
- [x] Dane demo (2 ozonatory + 4 sprzęty czyszczące)
- [x] Karta produktu (ProductCard)
- [x] Filtry kategorii (tabs z licznikami)
- [x] Wyszukiwarka produktów
- [x] Status dostępności (badge)
- [x] Przycisk "Zobacz ceny" / "Rezerwuj"

### 5. Formularz Rezerwacji (Frontend)
- [x] Schema Zod dla rezerwacji
- [x] Select kategorii → Select urządzenia (zależny)
- [x] Date picker (data rozpoczęcia, zakończenia)
- [x] Input miasto + toggle dostawa + adres (warunkowo)
- [x] Dane kontaktowe (imię, nazwisko, email, telefon, firma)
- [x] Checkbox zgody (regulamin, RODO)
- [x] Podsumowanie kosztów (kalkulacja: dni × stawka + dostawa)
- [x] Stany: loading, success, error
- [x] Integracja z react-hook-form

### 6. Formularz Kontaktowy (Frontend)
- [x] Schema Zod dla kontaktu
- [x] Pola: imię, email, temat (opcjonalnie), wiadomość
- [x] Honeypot anti-spam
- [x] Stany: loading, success, error

### 7. Backend API
- [x] Setup Express + TypeScript
- [x] Middleware: CORS, JSON parser, rate limiting
- [x] POST /api/contact (walidacja + zapis)
- [x] POST /api/reservations (walidacja + zapis)
- [x] Konfiguracja SQLite (tabele: contacts, reservations)
- [x] Nodemailer setup (SMTP)
- [x] Wysyłka maila potwierdzającego (kontakt + rezerwacja)
- [x] Obsługa błędów + kody odpowiedzi

### 8. Integracja FE ↔ BE
- [x] Service layer (/services/api.ts)
- [x] Hook useSubmitForm (generic)
- [x] Obsługa błędów API na froncie
- [x] Test flow: rezerwacja end-to-end
- [x] Test flow: kontakt end-to-end

### 9. Polish & QA
- [x] Responsywność (mobile-first audit)
- [x] Dostępność (aria-labels, focus states, keyboard nav)
- [x] Testy manualne wszystkich formularzy
- [x] Optymalizacja performance (lazy load, code split)
- [x] SEO basics (meta tags, OG, title)
- [x] Favicon + manifest
- [x] Zdjęcia produktów (11 zdjęć)

### 10. Panel Admina
- [x] Backend: endpointy /api/admin/* (login, reservations, contacts, stats)
- [x] Frontend: strona /admin z logowaniem
- [x] Fix: CORS dla różnych portów dev
- [x] Dashboard ze statystykami
- [x] Lista rezerwacji z filtrowaniem
- [x] Zmiana statusu rezerwacji (pending → confirmed → completed)
- [x] Lista wiadomości kontaktowych
- [x] Zmiana hasła admina

### 11. System dostępności dat
- [x] API: GET /api/reservations/product/:productId (zwraca zajęte daty)
- [x] Frontend: blokada zajętych dat w date picker
- [x] Walidacja: sprawdzenie dostępności przed wysłaniem + atomowa blokada anty-double-booking
- [x] Kalendarz zajętości w panelu admina (widok miesięczny)

### 12. Email notifications
- [x] Konfiguracja SMTP w .env
- [x] Email do admina: nowa rezerwacja
- [x] Email do admina: nowa wiadomość kontaktowa
- [x] Email do klienta: potwierdzenie rezerwacji
- [x] Email do klienta: zmiana statusu (confirmed/rejected)
- [x] Szablony HTML dla maili

### 13. Strona produktu (opcjonalnie)
- [x] Osobna strona /produkt/:id z pełnymi szczegółami
- [x] Galeria zdjęć produktu
- [x] Szczegółowy cennik (dzień, weekend, tydzień)
- [x] Lista akcesoriów z cenami
- [x] Przycisk "Rezerwuj ten produkt"

### 14. Regulamin i polityka prywatności
- [x] Strona /regulamin
- [x] Strona /polityka-prywatnosci
- [x] Linki w formularzu rezerwacji
- [x] Linki w footerze

### 15. Dokumentacja
- [x] README.md z instrukcją uruchomienia
- [x] .env.example dla backendu
- [x] Opis endpointów API
- [x] Instrukcja deploy (produkcja / standalone VPS Docker Compose)

### 16. Elektroniczne umowy najmu
- [x] Tryb „klient z ulicy”: pełny formularz pracownika (rezerwacja + dane umowy)
- [x] Niezmienny, wersjonowany snapshot umowy
- [x] AES-256-GCM: dane dokumentu, podpis i PDF zaszyfrowane w bazie / na dysku
- [x] Jednorazowa sesja podpisu 256-bit (hash tokenu w DB, TTL 24h)
- [x] Pełnoekranowy ekran tabletowy (palec / rysik / mysz)
- [x] Wymuszenie przewinięcia pełnej umowy przed zgodą
- [x] Generator PDF z polskimi znakami, podpisem i metryką dowodową
- [x] E-mail do klienta z podpisaną umową PDF
- [x] Automatyczne uruchomienie płatności po podpisie
- [x] Backend blokuje płatność i wydanie sprzętu przed podpisaniem
- [x] Panel admina: status, polling, pobieranie PDF, ponowne uruchomienie sesji
- [x] Polityka prywatności i regulamin zaktualizowane pod e-umowy
- [x] Testy kryptografii/PDF + Playwright tablet/workflow pracownika

---

## 📝 Log zmian

| Data | Task | Status | Notatki |
|------|------|--------|---------|
| 2026-01-19 | TASKS.md utworzony | ✅ | Checklist zgodna z planem |
| 2026-01-19 | Init projektu (task 0) | ✅ | Vite + React + TS, TailwindCSS v4, struktura folderów |
| 2026-01-19 | Design System (task 1) | ✅ | Button, Card, Input, Select, Badge, Toggle, Textarea + motion tokens |
| 2026-01-19 | Backend API (task 7) | ✅ | Express + TS, SQLite, Zod, Nodemailer, endpoints contact + reservations |
| 2026-01-19 | Navbar + Hero | ✅ | Navbar z mobile menu, Hero z widget kalkulacji kosztów, dane demo produktów |
| 2026-01-19 | Sekcja Kategorie | ✅ | Karty kategorii z ikonami, preview produktów, statystyki dostępności |
| 2026-01-19 | Sekcja Produkty | ✅ | ProductCard, grid z filtrami kategorii, wyszukiwarka, toggle widoku |
| 2026-01-19 | Sekcja Jak to działa | ✅ | 4 kroki z ikonami, animacje stagger, CTA button |
| 2026-01-19 | Sekcja Rezerwacja | ✅ | Pełny formularz rezerwacji, kalkulacja kosztów, walidacja, stany |
| 2026-01-19 | Sekcja FAQ + Kontakt | ✅ | 8 pytań FAQ z akordeonem, formularz kontaktowy, dane kontaktowe |

---

## 🎨 Design Reference

- **Kolory:** `#0a0a0a` (bg), `#1a1a1a` (card), `#f59e0b` (gold), `#fbbf24` (gold-light)
- **Border radius:** 16-24px (cards), 8-12px (buttons/inputs)
- **Motion:** duration 0.3-0.5s, ease `[0.25, 0.1, 0.25, 1]`
- **Fonts:** Inter (body), + bold weight dla nagłówków


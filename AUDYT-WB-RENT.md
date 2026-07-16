# Audyt WB-Rent — analiza wizualna, backendu, bezpieczeństwa i systemu + plan rozwoju

> Data audytu: 2026-07-14
> Zakres: `frontend/` (React 19 + Vite + TS + Tailwind v4 + framer-motion) oraz `server/` (Express 5 + PostgreSQL + Zod + Nodemailer/Resend)
> Deploy: Vercel (frontend) + Render (backend + Postgres)

---

## 1. Podsumowanie zarządcze (TL;DR)

WB-Rent to solidnie zbudowany MVP wypożyczalni sprzętu czyszczącego z dopracowaną warstwą wizualną (dark + gold, motion) i kompletnym panelem admina. Kod jest czysty, walidacja Zod obecna, zapytania SQL parametryzowane. **Projekt nie jest jednak gotowy produkcyjnie** ze względu na kilka realnych błędów i luk bezpieczeństwa:

| Obszar | Ocena | Najważniejszy problem |
|--------|:----:|-----------------------|
| Wizualnie / UX | 🟢 8/10 | Spójny, premium, ale miejscami „templatowy" |
| Frontend (kod) | 🟢 7.5/10 | Niezgodność kontraktu API → niedziałające funkcje |
| Backend (kod) | 🟡 6.5/10 | Brak testów, defaulty sekretów w kodzie |
| Bezpieczeństwo | 🔴 4/10 | CORS otwarty na wszystkich, hasło admina plaintext |
| System / DevOps | 🟡 6/10 | Brak README/dokumentacji, brak migracji DB |

**3 rzeczy do naprawy natychmiast:** (1) CORS przepuszcza każdy origin, (2) autoryzacja admina na statycznym haśle w plaintext + token w localStorage, (3) frontend woła nieistniejące endpointy dostępności (funkcje „sprawdź dostępność" i „powiadom o dostępności" nie działają).

---

## 2. Analiza wizualna i UX

### Mocne strony
- **Spójny system designu** — tokeny w [frontend/src/index.css](frontend/src/index.css) (kolory, radius, cienie, motion). Paleta dark grafit + bronze/gold `#b8972a` daje premium klimat.
- **Hero z konwersyjnym widgetem** „Sprawdź koszty" ([frontend/src/sections/Hero.tsx](frontend/src/sections/Hero.tsx)) — dobry pomysł: kalkulacja + CTA „Przejdź do rezerwacji" prefill do formularza (przez `ReservationContext`).
- **Motion** — framer-motion, stagger, scroll-reveal, `layoutId` na tabach, poszanowanie `prefers-reduced-motion`.
- **Animowane tło 3D** ([frontend/src/components/AnimatedBackground.tsx](frontend/src/components/AnimatedBackground.tsx)) — subtelne warstwy z blur + złote krzywe SVG.
- **Dostępność** — skip-link, `aria-*`, focus-visible z konturem gold, keyboard nav.
- **Responsywność** — mobile (390px) renderuje się poprawnie, hamburger menu działa.

### Słabości i rekomendacje wizualne
1. **Efekt „templatowy" w sekcjach środkowych** — „Jak to działa" i karty kategorii wyglądają generycznie. Warto dodać ilustracje/ikonografię brandową zamiast samych ikon Lucide.
2. **Jeden krój pisma (Inter)** — brak kontrastu typograficznego. Rozważ display-font dla nagłówków (np. Clash Display / Sora / Space Grotesk) dla charakteru premium.
3. **Złoto jest dość przygaszone** (`#b8972a`) — na ciemnym tle miejscami ginie. Rozważ mocniejszy akcent CTA (gradient gold→amber) i wyraźniejszy hover-glow.
4. **Scroll-reveal** — część elementów w „Jak to działa" pozostaje przy niskiej opacity, jeśli sekcja wejdzie w viewport zbyt szybko (5/70 elementów z `opacity < 0.1` w teście). Warto dać `once: true` + fallback `whileInView` z marginesem.
5. **Brak stanów „empty/skeleton"** przy ładowaniu produktów oraz spójnego skeletona zamiast samego spinnera (`SectionLoader`).
6. **OG image / favicon** — `index.html` linkuje `/favicon-32x32.png` i `/apple-touch-icon.png`, których **nie ma** w `public/` (jest tylko `favicon.svg`, `og-image.png`). To 404-ki i brak ikony na iOS.

---

## 3. Analiza frontendu (kod)

### Mocne strony
- Lazy-loading sekcji i stron (`React.lazy` + `Suspense`) w [frontend/src/App.tsx](frontend/src/App.tsx).
- Warstwa serwisowa API wydzielona ([frontend/src/services/api.ts](frontend/src/services/api.ts)), generyczny hook `useSubmitForm`.
- Walidacja formularzy, kalkulacja kosztów po stronie klienta z uwzględnieniem godzin, weekendu, dostawy (haversine do limitu 30 km).

### 🔴 Problem krytyczny — niezgodność kontraktu API
Frontend wywołuje endpointy, których backend **nie posiada**:

| Frontend woła ([api.ts](frontend/src/services/api.ts)) | Backend udostępnia ([routes.ts](server/src/routes.ts)) | Efekt |
|---|---|---|
| `GET /availability/:id?startDate&endDate` | `GET /reservations/check-availability?productId=` | 404 → sprawdzanie terminu nie działa |
| `GET /products/availability` | `GET /products/reserved-today` | 404 → statusy dostępności na kartach nie działają |
| `POST /notify-availability` | `POST /notifications/product` | 404 → „Powiadom, gdy dostępny" nie działa |

To realny bug funkcjonalny — feature „System dostępności dat" (task 11 w [TASKS.md](TASKS.md)) jest w praktyce niesprawny mimo istnienia kodu po obu stronach.

### Inne uwagi
- `apiFetch` zwraca `data.error` jako string, a backend zwraca `message` — komunikaty błędów mogą się nie wyświetlać poprawnie.
- Brak `AbortController` przy debounce sprawdzania dostępności (wyścigi żądań).
- `10 podatności npm` (1 low / 4 moderate / 5 high) — wymaga `npm audit fix`.
- Brak strukturalnych danych SEO (JSON-LD `LocalBusiness` / `Product`), mimo dobrego OG i `sitemap.xml`.

---

## 4. Analiza backendu (kod)

### Architektura
Czysty podział: [index.ts](server/src/index.ts) (bootstrap + middleware), [routes.ts](server/src/routes.ts) (publiczne), [admin.ts](server/src/admin.ts) (panel), [db.ts](server/src/db.ts) (Postgres + zapytania), [email.ts](server/src/email.ts) (Resend→SMTP→console fallback), [scheduler.ts](server/src/scheduler.ts) (cron 9:00 przypomnienia), [schemas.ts](server/src/schemas.ts) (Zod).

### Mocne strony
- **SQL parametryzowany** (`pg` z `$1,$2...`) — brak podatności na SQL injection.
- **Cena liczona serwerowo** — klient nie może zmanipulować `totalPrice` w bazie.
- **Sprawdzanie konfliktów terminów** przy tworzeniu rezerwacji (`checkDateAvailability`, poprawna logika nakładania zakresów `start < end2 AND end > start`).
- **helmet** włączony, body limit 10kb, fallback e-mail (Resend/SMTP/console).
- Rozbudowany panel: rezerwacje, kontakty+odpowiedzi, newsletter, powiadomienia, przychody, przypomnienia.

### Słabości
1. **Mapa `productNames` zduplikowana** w `admin.ts`, `routes.ts`, `scheduler.ts` — powinna być jednym źródłem prawdy (SSOT), najlepiej w DB lub współdzielonym module.
2. **Brak migracji** — schema tworzona `CREATE TABLE IF NOT EXISTS` w kodzie + osobne skrypty `add-time-columns.cjs`. Potrzebny system migracji (np. `node-pg-migrate` / Drizzle).
3. **Brak testów** (`"test": "echo No tests yet"`).
4. **Endpoint zmiany hasła admina** — odhaczony w TASKS.md, ale **nie istnieje** w kodzie serwera (hasło i tak jest tylko w ENV, więc UI zmiany hasła nie miałby jak działać).
5. **`console.log` debug** w produkcji (endpointy `/debug-reminders`, `/test-reminder-email` dostępne dla admina — OK, ale warto wyłączyć w prod).

---

## 5. Analiza bezpieczeństwa 🔴 (priorytet)

| # | Podatność | Lokalizacja | Ryzyko | Rekomendacja |
|---|-----------|-------------|:------:|--------------|
| S1 | **CORS otwarty dla wszystkich** — allowlist jest budowany, ale `callback(null, true)` przepuszcza każdy origin | [index.ts](server/src/index.ts) `~34` | Wysokie | Zwracać `callback(new Error())` dla spoza allowlisty; usunąć „Allow all in dev" z prod |
| S2 | **Hasło admina w plaintext** + porównanie `password === config.adminPassword` (timing-unsafe) | [admin.ts](server/src/admin.ts) `~47`, [config.ts](server/src/config.ts) `~25` | Wysokie | bcrypt/argon2 hash w ENV, `crypto.timingSafeEqual` |
| S3 | **Domyślne sekrety w kodzie** (`'wbrent2026'`, `'wb-rent-admin-secret-token-2026'`) | [config.ts](server/src/config.ts) | Wysokie | Wymusić brak defaultów — `throw` przy braku ENV w prod |
| S4 | **Statyczny, niewygasający token** przechowywany w `localStorage` (podatny na XSS) | [adminApi.ts](frontend/src/services/adminApi.ts) `~4` | Wysokie | JWT z expiry + refresh, httpOnly cookie zamiast localStorage |
| S5 | **Brak dedykowanego rate-limitu na `/login`** + globalny limit 1000/min = brak ochrony przed brute-force | [index.ts](server/src/index.ts), [config.ts](server/src/config.ts) | Średnie | Osobny limiter 5–10/min na `/admin/login`, obniżyć globalny |
| S6 | **HTML injection w e-mailach** — `${data.name}`, `${data.message}`, `${data.notes}` wstawiane bez escapowania | [email.ts](server/src/email.ts) `105,110,146,307` | Średnie | Escapować HTML (encja `< > & "`) przed interpolacją |
| S7 | **Newsletter unsubscribe przez GET bez tokenu** — można wypisać dowolny e-mail / enumerować | [routes.ts](server/src/routes.ts) `~335`, link w [email.ts](server/src/email.ts) `~745` | Średnie | Podpisany token wypisu (HMAC) w linku |
| S8 | **Brak weryfikacji własności rezerwacji** przez klienta (brak endpointów klienckich, ale przy rozbudowie o „moje rezerwacje" — pamiętać) | — | Info | Autoryzacja per-zasób |

Pozytywy bezpieczeństwa: brak SQLi (parametryzacja), helmet, limit body, honeypot anti-spam, walidacja Zod, cena liczona serwerowo.

---

## 6. Analiza systemu / DevOps

- **Brak README** i `API docs` (task 15 w TASKS.md niezrobiony). Utrudnia onboarding i deploy.
- `.env.example` istnieje, ale **niekompletny** — brak `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `RESEND_API_KEY`, `SITE_URL`, `CORS_ORIGIN` (część jest w [render.yaml](render.yaml), ale nie w przykładzie).
- **Podwójny stack DB w repo** — kod używa Postgresa (`pg`), a `TASKS.md`/nazwy plików (`create-tables.cjs`, `@types/better-sqlite3` w deps) sugerują historyczne SQLite. `better-sqlite3` w `dependencies` jest zbędny.
- Deploy: [vercel.json](vercel.json) + [render.yaml](render.yaml) skonfigurowane sensownie (rewrites SPA, cache PNG, DB Render). Brakuje health-check w Render (endpoint `/api/health` istnieje — wystarczy podpiąć).
- Brak CI (lint/build/test na PR).

---

## 7. Plan dalszego rozwoju

### 🔴 Faza 0 — Krytyczne (przed produkcją, ~1–2 dni) ✅ WDROŻONE 2026-07-15
- [x] **S1** Naprawić CORS — realny allowlist, odrzucanie obcych origin.
- [x] **S2/S3** scrypt hash (`ADMIN_PASSWORD_HASH`) + `timingSafeEqual`; usunięto domyślne sekrety, `throw` przy braku ENV w prod.
- [x] **S4** Podpisany HMAC token z wygasaniem 8h (nowy moduł `server/src/auth.ts`); frontend auto-wylogowanie po 401/wygaśnięciu.
- [x] **API-FIX** Ujednolicony kontrakt dostępności FE↔BE — poprawione ścieżki w `api.ts` + nowy endpoint `GET /api/products/availability`; logika auth zweryfikowana testami runtime.
- [x] **S6** Escapowanie HTML (`esc`/`escFields`) we wszystkich szablonach e-mail.
- [x] `npm audit fix` — frontend 0 podatności, server 0 podatności (nodemailer podniesiony do 9.0.3).
- [x] **S5 (bonus)** Dedykowany rate-limit `/admin/login` (10 prób / 15 min); globalny limit obniżony do 300/min.

### 🟡 Faza 1 — Stabilizacja (~3–5 dni) ✅ WDROŻONE 2026-07-15
- [x] **S5** Dedykowany rate-limit na `/login`, obniżony globalny (wykonane w Fazie 0).
- [x] **S7** Podpisany (HMAC) link wypisu z newslettera — `GET/POST /api/newsletter/unsubscribe?email&token`, strona potwierdzenia, brak enumeracji adresów.
- [x] Endpoint **zmiany hasła admina** — `POST /api/admin/change-password` (scrypt hash w tabeli `app_settings`, nadpisuje ENV) + zakładka „Ustawienia" w panelu.
- [x] **README** z dokumentacją API i instrukcją deploy (lokalnie / Docker / VPS).
- [x] `.env.example` kompletny (DATABASE_URL, ADMIN_PASSWORD_HASH, ADMIN_TOKEN, RESEND, SITE_URL, API_URL).
- [x] SSOT dla danych produktów — nowy `server/src/products.ts`, usunięta duplikacja z `routes.ts`/`admin.ts`/`scheduler.ts`.
- [x] Lekki system migracji DB (`schema_migrations` + runner w `db.ts`; migracje: kolumny czasu, indeks rezerwacji) — zastępuje luźne skrypty `.cjs`.
- [x] Poprawić mapowanie błędów w `apiFetch` (`message` vs `error`).
- [x] Naprawić brakujące favicony/apple-touch-icon (wygenerowane: 16/32/180/192/512 px, `generate-icons.cjs`) + podpięty `manifest.json`.
- [x] Usunięta zbędna zależność `@types/better-sqlite3`.
- [x] **Deploy pod wb-platform (VPS)**: `server/Dockerfile`, `frontend/Dockerfile` + `nginx.conf` (SPA + proxy `/api/`), `docker-compose.yml` (web+api+postgres, healthcheck, wolumen).

### 🟢 Faza 2 — Ulepszenia funkcjonalne ✅ ZAKOŃCZONA 2026-07-15
- [x] **Kalendarz zajętości** — DatePicker przyjmuje `blockedRanges`; zajęte dni przekreślone/zablokowane + legenda; formularz pobiera zajęte terminy produktu (`GET /reservations/product/:id`).
- [x] `AbortController` dla availability check i pobierania zajętych dat (eliminacja wyścigów).
- [x] **Anty double-booking**: atomowa rezerwacja `createReservationIfAvailable` — transakcja + `pg_advisory_xact_lock` per produkt.
- [x] **`days` liczone serwerowo** (klient nie jest już źródłem wyceny; reguła rozpoczętej doby jak na froncie).
- [x] Fix serializacji dat: kolumny `DATE` zwracane jako stringi `YYYY-MM-DD` (bez przesunięć strefy w JSON/e-mailach).
- [x] Eksport rezerwacji i wiadomości do **CSV** w panelu (BOM + `;` — zgodne z Excel PL).
- [x] Testy: **Vitest** — 26 testów (wycena, nakładanie terminów, auth, tokeny) — wszystkie przechodzą.
- [x] **CI (GitHub Actions)**: server typecheck+testy, frontend lint+build.
- [x] Lint frontendu naprawiony: 22 błędy → 0 (puste interfejsy, refs-in-render w Select, setState-in-effect w hookach, nieużywane catch bindings, react-refresh w Context).
- [x] **Płatności online** — 3 gotowe moduły (PayU/Przelewy24/Stripe) za wspólnym interfejsem, wybór przez `PAYMENT_PROVIDER`; bazowo PayU sandbox; webhooki z weryfikacją podpisów; tabela `payments` (migracja v3); strona powrotu `/platnosc`; badge w panelu; 14 testów podpisów/rejestru.
- [x] Panel klienta **„Moje rezerwacje"** — magic-link 24h (HMAC, bez konta), lista statusów/płatności, ponów płatność, anulowanie przed terminem; autoryzacja per-zasób; limiter 5/15min i brak enumeracji e-maili.
- [x] **Playwright e2e** — 5 scenariuszy: strona główna, 404, produkt+JSON-LD, pełny flow formularza rezerwacji (mock API), magic-link/lista klienta. 5/5 przechodzi; CI instaluje Chromium i uruchamia suite.

### 🎨 Faza 3 — Ulepszenia designowe ✅ ZAKOŃCZONA 2026-07-15
- [x] Display-font dla nagłówków — **Sora** (h1–h3, letter-spacing -0.02em); przy okazji naprawione ładowanie fontów (Inter był zadeklarowany, ale nigdy nie ładowany!).
- [x] Mocniejszy akcent CTA — gradient gold→amber z animowanym przesunięciem tła + złoty glow na hover (primary/outline).
- [x] Skeletony zamiast spinnera — `SectionLoader` renderuje szkielet sekcji (nagłówek + siatka kart).
- [x] Dopracowanie scroll-reveal — `rootMargin: 200px` (pre-trigger przed wejściem w viewport, koniec „pustych sekcji" przy skoku kotwicą), krótsze duration/stagger.
- [x] JSON-LD — `LocalBusiness` (index.html) + dynamiczny `Product`/`Offer` (LeaseOut) i tytuł strony na /produkt/:id.
- [x] Ujednolicenie palety — fioletowy akcent cennika weekendowego na stronie produktu → gold.
- [x] Strona **404** (catch-all route) + catch-all rewrite w vercel.json.
- [x] Brandowa ikonografia — złote medaliony z gradientem/ring/glow w „Jak to działa" i Kategorie; watermark numeru kroku i animowany detal.
- [x] Nowy **og-image 1200×630** z fontem Sora, paletą dark+gold i ofertą; generator `generate-og.mjs` (Playwright) + `npm run generate:og`.

---

## 8. Elektroniczne umowy najmu — wdrożone 2026-07-15

System realizuje pełny proces operacyjny opisany przez zarząd:

1. Pracownik może utworzyć wynajem od zera w `/admin/nowy-wynajem` albo przygotować umowę dla istniejącej rezerwacji.
2. Uzupełnia dane klienta i dokumentu, kaucję, akcesoria, stan sprzętu oraz dane osoby wydającej.
3. Backend tworzy niezmienny snapshot treści umowy i zapisuje jego SHA-256.
4. Dane dokumentu i snapshot są szyfrowane AES-256-GCM. W DB przechowywany jest wyłącznie hash losowego tokenu podpisu (256 bitów).
5. Klient na ekranie tabletowym musi przejrzeć pełną umowę, złożyć podpis palcem/rysikiem/myszką i zaznaczyć oświadczenie.
6. Generator PDF osadza polski font Noto Sans, pełną treść, podpis oraz metrykę: czas, IP, user-agent, hash treści i podpisu.
7. PDF ma własny SHA-256 i jest szyfrowany AES-256-GCM na prywatnym wolumenie `wbrent-contracts` (nie znajduje się w publicznym katalogu ani Git).
8. Dokument PDF jest wysyłany klientowi jako załącznik i dostępny administratorowi do pobrania.
9. Backend blokuje `picked_up` i `/payments/create` bez umowy w stanie `signed`; płatność jest tworzona automatycznie po podpisie.
10. Panel pracownika polluje status co 3 sekundy i informuje o podpisie w drugiej karcie.

**Charakter podpisu:** rozwiązanie tworzy zwykły podpis elektroniczny i rozbudowany materiał dowodowy. Nie jest podpisem kwalifikowanym w rozumieniu eIDAS.

**Ochrona danych:** zaktualizowano politykę prywatności i regulamin. System nie wykonuje zdjęcia dokumentu, a numer dokumentu, opcjonalny PESEL, podpis i PDF są zaszyfrowane. Token publicznego pobrania wygasa po 24h.

**Testy:** szyfrowanie, wykrywanie manipulacji GCM, tokeny, walidacja danych i realny generator PDF są pokryte Vitest. Playwright pokrywa podpis na canvasie oraz pełny scenariusz pracownika „klient z ulicy”.

## 9. Bramy przed produkcją (operacyjne / prawne)

- [ ] Prawnik zatwierdza paragrafy wzoru `server/src/contracts/template.ts`, zakres odpowiedzialności, kaucji i retencji.
- [ ] IOD / osoba odpowiedzialna za RODO zatwierdza zakres numeru dokumentu i opcjonalnego PESEL.
- [ ] Wygenerować i bezpiecznie zbackupować `CONTRACT_ENCRYPTION_KEY`; nie wolno go rotować bez migracji historycznych dokumentów.
- [ ] Backup VPS obejmuje jednocześnie PostgreSQL, wolumen `wbrent-contracts` i osobny sejf z kluczem szyfrowania.
- [ ] Wykonać próbny podpis i e-mail na środowisku VPS z realnym SMTP/Resend oraz sandboxem PayU.

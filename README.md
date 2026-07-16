# WB-Rent

Strona wypożyczalni sprzętu czyszczącego i ozonatorów (Rzeszów) — rezerwacje online, panel admina, newsletter, powiadomienia o dostępności.

| Warstwa | Stack |
|---|---|
| Frontend | React 19 + TypeScript + Vite (rolldown) + Tailwind CSS v4 + framer-motion |
| Backend | Node.js 22 + Express 5 + Zod + PostgreSQL (`pg`) |
| E-mail | Resend API (priorytet) → SMTP/Nodemailer (fallback) → console (dev) |
| Deploy | Docker Compose — samodzielny stack na VPS (migracja z Vercel/Render) |

## Struktura

```
frontend/   SPA (sekcje: Hero, Kategorie, Produkty, Jak to działa, Rezerwacja, FAQ) + /admin
server/     REST API + scheduler przypomnień (cron 9:00 Europe/Warsaw)
data/       zasoby
```

## Uruchomienie lokalne

### Backend (wymaga PostgreSQL)

```powershell
cd server
copy .env.example .env   # uzupełnij DATABASE_URL, ADMIN_PASSWORD, ADMIN_TOKEN
npm install
npm run dev              # http://localhost:3001
```

### Frontend

```powershell
cd frontend
npm install
npm run dev              # http://localhost:5173 (VITE_API_URL domyślnie http://localhost:3001/api)
```

### Docker (całość: web + api + db)

```powershell
# .env obok docker-compose.yml: POSTGRES_PASSWORD, ADMIN_TOKEN, ADMIN_PASSWORD...
docker compose up -d --build   # web na http://localhost:5340
```

## Zmienne środowiskowe (server)

Pełna lista z opisami: [server/.env.example](server/.env.example). Najważniejsze:

| Zmienna | Wymagana | Opis |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` | ✅ (prod) | hasło panelu; hash scrypt ma pierwszeństwo. Serwer **nie wystartuje** w prod bez jednej z nich |
| `ADMIN_TOKEN` | ✅ (prod) | sekret HMAC do podpisywania tokenów sesji (8h TTL) i linków wypisu |
| `CORS_ORIGIN` | – | dodatkowe originy (CSV) doklejane do wbudowanego allowlisty |
| `RESEND_API_KEY` lub `SMTP_*` | – | wysyłka e-mail (bez nich: log do konsoli) |
| `SITE_URL` / `API_URL` | – | linki w e-mailach (strona / endpoint wypisu) |
| `PAYMENT_PROVIDER` | – | aktywny moduł płatności: `payu` \| `przelewy24` \| `stripe` \| `none` |
| `PAYU_*` / `P24_*` / `STRIPE_*` | – | dane aktywnej bramki (sandbox PayU ma publiczne dane w `.env.example`) |
| `CONTRACT_ENCRYPTION_KEY` | ✅ (prod) | niezmienny sekret AES-256-GCM do danych dokumentu, podpisów i PDF; wykonaj jego bezpieczny backup |
| `CONTRACT_STORAGE_DIR` | – | prywatny katalog zaszyfrowanych PDF (Docker: wolumen `wbrent-contracts`) |

Hasło admina można też zmienić z panelu (zakładka **Ustawienia**) — hash trafia do tabeli `app_settings` i ma pierwszeństwo przed ENV.

## API

### Publiczne

| Metoda | Ścieżka | Opis |
|---|---|---|
| `GET` | `/api/health` | health check |
| `POST` | `/api/contact` | formularz kontaktowy (honeypot `website`) |
| `POST` | `/api/reservations` | nowa rezerwacja (walidacja Zod, cena liczona serwerowo, kontrola konfliktu terminów) |
| `GET` | `/api/reservations/check-availability?productId&startDate&endDate` | sprawdzenie dostępności terminu |
| `GET` | `/api/reservations/product/:productId` | zajęte terminy produktu |
| `GET` | `/api/products/availability` | mapa dostępności wszystkich produktów (dziś) |
| `GET` | `/api/products/reserved-today` | lista id produktów zajętych dziś |
| `POST` | `/api/my-reservations/request-link` | wyślij magic-link do rezerwacji (limit 5/15 min, zawsze 200) |
| `GET` | `/api/my-reservations?token=` | lista rezerwacji klienta (token HMAC 24h) |
| `POST` | `/api/my-reservations/:id/cancel` | anulowanie własnej przyszłej rezerwacji (token w body) |
| `POST` | `/api/newsletter/subscribe` | zapis do newslettera |
| `GET/POST` | `/api/newsletter/unsubscribe?email&token` | wypis (link z e-maila, token HMAC) |
| `POST` | `/api/notifications/product` | „powiadom, gdy dostępny" |
| `GET` | `/api/payments/config` | czy płatności aktywne + który moduł |
| `POST` | `/api/payments/create` | utworzenie/ponowienie płatności (reservationId + email) |
| `GET` | `/api/payments/status/:sessionId` | status płatności (polling ze strony powrotu) |
| `POST` | `/api/payments/webhook/:provider` | notyfikacje bramek (podpis weryfikowany) |

### Admin (nagłówek `Authorization: Bearer <token>`)

| Metoda | Ścieżka | Opis |
|---|---|---|
| `POST` | `/api/admin/login` | logowanie (limit 10 prób/15 min) → `{ token, expiresAt }` |
| `POST` | `/api/admin/change-password` | zmiana hasła (hash w DB) |
| `GET` | `/api/admin/stats` · `/revenue` | statystyki, przychody |
| `GET/PATCH` | `/api/admin/reservations[/:id]` | lista/zmiana statusu (pending→confirmed→picked_up→returned→completed / rejected / cancelled) — statusy wysyłają e-maile |
| `GET/PATCH/DELETE` | `/api/admin/contacts[/:id]` | wiadomości + `/reply`, `/delete-many` |
| `GET/POST/PATCH/DELETE` | `/api/admin/newsletter/*` | subskrybenci, posty, wysyłka |
| `GET/DELETE/POST` | `/api/admin/notifications*` | powiadomienia o dostępności |
| `POST` | `/api/admin/send-reminders` | ręczne przypomnienia (odbiór/zwrot) |

## Bezpieczeństwo (zaimplementowane)

- CORS: twardy allowlist (lokalne porty dev + domeny prod + `CORS_ORIGIN`)
- Sesje admina: token HMAC-SHA256 z wygasaniem 8h; hasło scrypt lub timing-safe compare; brak sekretów domyślnych w produkcji
- Rate limiting: global 300 req/min + `/admin/login` 10/15 min
- Wszystkie szablony e-mail escapują dane użytkownika (anty HTML-injection)
- Linki wypisu z newslettera podpisane HMAC (nie można wypisać cudzego adresu)
- SQL wyłącznie parametryzowany; body limit 10 kB; helmet

## Płatności online (moduły)

Trzy gotowe moduły w [server/src/payments/](server/src/payments/) za wspólnym interfejsem `PaymentProvider`
(`createPayment` + `handleWebhook` z weryfikacją podpisu). Wybór modułu = `PAYMENT_PROVIDER` w env — zero zmian w kodzie:

| Moduł | Plik | Podpis webhooka | Sandbox |
|---|---|---|---|
| **PayU** (bazowy) | `payu.ts` | `OpenPayU-Signature` (MD5/SHA-256 z second key) | `secure.snd.payu.com` — publiczne dane testowe w `.env.example` |
| Przelewy24 | `przelewy24.ts` | `sign` sha384 + potwierdzenie `transaction/verify` | `sandbox.przelewy24.pl` |
| Stripe | `stripe.ts` | `Stripe-Signature` HMAC-SHA256 + ochrona przed replay | klucze testowe `sk_test_...` |

Przepływ: `POST /api/reservations` → (gdy moduł aktywny) tworzy płatność i zwraca `payment.redirectUrl` → frontend przekierowuje do bramki → klient wraca na `/platnosc?sesja=...` (polling statusu) → webhook bramki ustawia `paid` w tabeli `payments` i na rezerwacji (badge w panelu admina). Błąd bramki nie blokuje rezerwacji (fallback: płatność przy odbiorze).

Webhook URL do skonfigurowania u operatora: `https://<API>/api/payments/webhook/payu` (analogicznie `/przelewy24`, `/stripe`).

## Elektroniczne umowy najmu (tryb pracownik + tablet)

Proces operacyjny:

1. Pracownik tworzy lub otwiera rezerwację w panelu `/admin`.
2. Na karcie rezerwacji wybiera **Umowa**, uzupełnia adres, dane dokumentu, kaucję, akcesoria, stan sprzętu i swoje imię/nazwisko.
3. System tworzy niezmienny, zaszyfrowany snapshot umowy i jednorazową sesję (domyślnie 24h).
4. Pracownik uruchamia **Ekran podpisu** na tablecie. Klient musi przewinąć pełną treść, podpisać palcem/rysikiem/myszką i zaakceptować oświadczenie.
5. System generuje PDF z pełną umową, podpisem i metryką dowodową (czas, IP, user-agent, SHA-256 treści i podpisu), szyfruje go AES-256-GCM, zapisuje w prywatnym wolumenie i wysyła klientowi jako załącznik.
6. Dopiero stan `signed` odblokowuje wydanie sprzętu oraz utworzenie płatności online. Panel wykrywa podpis automatycznie co 3 sekundy.

Bezpieczeństwo i integralność:

- numer dokumentu, PESEL, snapshot i podpis nigdy nie są przechowywane jawnie w bazie;
- finalny PDF jest również zaszyfrowany na dysku, a endpointy pobrania mają `private, no-store`;
- w bazie pozostają niezależne SHA-256 treści, podpisu i PDF;
- token sesji ma 256 bitów entropii, w bazie jest wyłącznie jego hash, a publiczny dostęp wygasa;
- ponowne wygenerowanie sesji unieważnia poprzedni link; podpisanej umowy nie można nadpisać;
- backend blokuje `picked_up` i `/payments/create`, jeśli umowa nie ma statusu `signed`.

> Podpis rysowany na ekranie stanowi zwykły podpis elektroniczny i materiał dowodowy, a nie kwalifikowany podpis elektroniczny. Wzór umowy, zakres danych dokumentu oraz okres retencji powinny zostać zatwierdzone przez prawnika/inspektora ochrony danych przed produkcją.

Najważniejsze endpointy:

| Metoda | Ścieżka | Dostęp | Opis |
|---|---|---|---|
| `POST` | `/api/admin/contracts` | admin | utworzenie snapshotu i sesji podpisu |
| `GET` | `/api/admin/contracts/reservation/:id` | admin | status umowy dla rezerwacji |
| `GET` | `/api/admin/contracts/:id/pdf` | admin | pobranie odszyfrowanego PDF |
| `GET` | `/api/contracts/sign/:token` | token 256-bit | pełny podgląd umowy |
| `POST` | `/api/contracts/sign/:token` | token 256-bit | zapis podpisu, PDF, e-mail i opcjonalna płatność |
| `GET` | `/api/contracts/sign/:token/pdf` | token do wygaśnięcia | pobranie własnego podpisanego PDF |

**Backup:** razem z bazą PostgreSQL archiwizuj wolumen `wbrent-contracts` oraz sekret `CONTRACT_ENCRYPTION_KEY`. Utrata klucza uniemożliwi odszyfrowanie historycznych dokumentów; zmiana klucza bez migracji danych jest zabroniona.

## Deploy na VPS

WB-Rent działa jako **niezależny stack Docker Compose** (na tym samym VPS co inne projekty, ale bez powiązań z nimi — własny Postgres, własna domena).

1. Skopiuj repo na serwer, utwórz `.env` obok `docker-compose.yml`.
2. `docker compose up -d --build` — frontend wystawia się na porcie `WEB_PORT` (domyślnie 5340), nginx w kontenerze proxuje `/api/` do kontenera `api`.
3. W reverse proxy hosta (Caddy/nginx) skieruj domenę `wb-rent.pl` na `127.0.0.1:5340` + TLS (Let's Encrypt).
4. Scheduler przypomnień działa w kontenerze `api` (cron w procesie — kontener musi działać ciągle).

## Testy / QA

```powershell
cd server;   npx tsc --noEmit    # typecheck backendu
cd server;   npm test            # Vitest: 44 testy
cd frontend; npm run build       # typecheck + build frontu
cd frontend; npm run test:e2e    # Playwright: 5 scenariuszy (mock API)
cd frontend; npm run generate:og # regeneracja public/og-image.png
```

Dalszy plan rozwoju i historia audytu: [AUDYT-WB-RENT.md](AUDYT-WB-RENT.md).

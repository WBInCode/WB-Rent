# WB-Rent Server - Deployment Guide

## Wdrożenie na Render.com (Zalecane)

Dzięki plikowi `render.yaml` w głównym katalogu, możesz automatycznie wdrożyć serwer API wraz z bazą PostgreSQL na Render.com za pomocą funkcji Blueprints.

### Krok po kroku:
1. Zaloguj się na [Render.com](https://render.com) i przejdź do panelu.
2. Kliknij **New** -> **Blueprint**.
3. Połącz swoje repozytorium GitHub `WB-Rent`.
4. Render automatycznie wczyta konfigurację z pliku `render.yaml`:
   - Utworzy bazę danych PostgreSQL (`wb-rent-db`).
   - Utworzy aplikację webową (`wb-rent-api`) w folderze `server/`.
5. W trakcie konfiguracji zostaniesz poproszony o wpisanie wartości dla pustych zmiennych środowiskowych (np. `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `SMTP_HOST` itd.).
6. Kliknij **Apply**. Render automatycznie zbuduje i uruchomi serwer API pod adresem typu `https://wb-rent-api.onrender.com`.

Po wdrożeniu skopiuj ten adres i wstaw go w panelu Vercel jako zmienną środowiskową `VITE_API_URL` (np. `https://wb-rent-api.onrender.com/api`).

---

## Wdrożenie na Railway.app (Alternatywne)

### 1. Utwórz konto na Railway
Przejdź na [railway.app](https://railway.app) i zaloguj się przez GitHub.

### 2. Utwórz nowy projekt
1. Kliknij "New Project".
2. Wybierz "Deploy from GitHub repo".
3. Wybierz repozytorium WB-Rent.
4. W konfiguracji wybierz folder `server` jako Root Directory.

### 3. Ustaw zmienne środowiskowe
W ustawieniach projektu dodaj:
```env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://wb-rent.pl,https://www.wb-rent.pl
DATABASE_URL=twoj-adres-bazy-postgresql
ADMIN_PASSWORD=twoje-bezpieczne-haslo
ADMIN_TOKEN=twoj-tajny-token
```

### 4. Deploy
Railway automatycznie zbuduje i uruchomi serwer.

---

## Lokalne uruchamianie

```bash
cd server
npm install
npm run dev
```

Serwer uruchomi się na http://localhost:3001

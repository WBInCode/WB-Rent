# WB-Rent Server - Deployment Guide

## Wdrożenie na Railway.app (zalecane)

### 1. Utwórz konto na Railway
Przejdź na [railway.app](https://railway.app) i zaloguj się przez GitHub.

### 2. Utwórz nowy projekt
1. Kliknij "New Project"
2. Wybierz "Deploy from GitHub repo"
3. Wybierz repozytorium WB-Rent
4. W konfiguracji wybierz folder `server` jako Root Directory

### 3. Ustaw zmienne środowiskowe
W ustawieniach projektu dodaj:

```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://wb-rent.pl,https://www.wb-rent.pl
ADMIN_PASSWORD=twoje-bezpieczne-haslo
ADMIN_TOKEN=twoj-tajny-token
```

### 4. Deploy
Railway automatycznie zbuduje i uruchomi serwer.

### 5. Skopiuj URL
Po wdrożeniu Railway poda URL np. `https://wb-rent-server.up.railway.app`

### 6. Ustaw zmienną w Vercel
W projekcie Vercel/hostingu (frontend) dodaj zmienną środowiskową:
```
VITE_API_URL=https://api.wb-rent.pl/api
```
lub URL z Railway.

## Lokalne uruchamianie

```bash
cd server
npm install
npm run dev
```

Serwer uruchomi się na http://localhost:3001

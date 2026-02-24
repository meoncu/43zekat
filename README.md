# 43Zekat

Modern full-stack PWA for Zakat calculation built with Next.js 15, React 19, TypeScript, Tailwind, Zustand, Firebase Auth + Firestore.

## Features
- Google Login with Firebase Auth
- Firestore user-isolated financial assets
- TL, FX, and precious metal assets
- 354-day (lunar year) eligibility checks
- Nisab calculation (85g gold) + 2.5% zakat
- Dark/light mode
- Installable PWA + offline static caching
- Admin role support (`meoncu@gmail.com`)

## Local setup
1. `cp .env.example .env.local`
2. `npm install`
3. `npm run dev:safe`
4. Open `http://localhost:4013`

### Desktop shortcut
Run:
```bash
npm run desktop:shortcut
```
This creates a desktop launcher that starts the app on port `4013` and kills any existing process on that port first.

## Firebase
- Firestore rules are in `firestore.rules`.
- Data model:
  - `users/{uid}/profile/main`
  - `users/{uid}/assets/main`

## Deployment (Vercel)
1. Push to GitHub repository.
2. Import project in Vercel.
3. Set all env vars from `.env.example`.
4. Build command: `npm run build`
5. Start command: `npm run start`

## Production checks
```bash
npm run typecheck
npm run lint
npm run build
```

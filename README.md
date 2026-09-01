# Optech Admin

Production admin console for Optech Computer Institute. Dark HUD, gold `#d4a22f`, real API only.

## Stack

React + TypeScript + Vite, Tailwind, Redux Toolkit + RTK Query, React Router, Zod, React Hook Form, Lucide, Recharts.

## Run

From repo root, start Mongo/Redis and the API first:

```bash
cd backend
cp .env.example .env
docker compose up -d
npx tsx src/scripts/seed.ts
npm run dev
```

Then:

```bash
cd admin
npm install
npm run dev
```

Vite serves `http://localhost:3001` and proxies `/api` to `http://localhost:4000`.

Seed login is `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in `backend/.env` (default `admin@optech-deori.edu.in` / `ChangeThisPassword123!`).

## Auth

- Staff login: `POST /api/v1/auth/admin/login`
- Refresh cookie rotation on 401
- Permissions are read from the access JWT (UX only — the API remains authoritative)
- Super Admin cannot have its permission matrix reduced from the console

## Notes

Do not put Cloudinary, Razorpay, or JWT secrets in this app. Uploads and PDFs go through the API.

# CampusMart

CampusMart is a polished frontend concept for a student-first marketplace experience built with Next.js and Tailwind CSS.

## Features
- Modern landing experience
- Marketplace, vendor, admin, wallet, and checkout UI flows
- Responsive layout and polished shared design system

## Local development
```bash
npm install
npm run dev
```

Run the commands from the repository root. The root script installs and starts the Next.js app in `frontend` on port 3000. If PowerShell blocks `npm.ps1`, use `npm.cmd run dev` instead.

Open http://localhost:3000 to view the app.

### Enable live listings and backend features

The frontend needs the CampusMart backend on port 5000 to load live listings. Before starting it, create `backend/.env` from `backend/.env.example` and fill in the real CampusMart PostgreSQL connection strings, JWT secrets, and Supabase project settings. Keep those credentials in the ignored `.env` file; do not commit or paste them into chat.

Start the backend in a second terminal:

```powershell
Set-Location backend
npm.cmd run dev
```

`DATABASE_URL` is used by the running API. `DIRECT_URL` is used by Prisma commands such as client generation and migrations. The local backend cannot start without the required Supabase URL and secret key.

## Deployment
This project is ready for deployment on Vercel.

Recommended Vercel setup:
- Framework: Next.js
- Root directory: frontend

If you want to deploy from the repository root, the included vercel.json file is set up for the frontend app.

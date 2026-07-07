# 🎬 WatchParty

Watch videos together in sync with live chat, reactions, voice & video calls.

![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Database-darkgreen?logo=supabase)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)

---

## Features

- **Synced playback** — play, pause, and seek together in real time
- **YouTube & HLS** — paste any YouTube link or video stream URL
- **Live chat** — messages with emoji reactions
- **Voice & video calls** — peer-to-peer, no media server needed
- **Watch queue** — add videos, upvote, and play in order
- **Polls** — vote on what to watch next
- **Screen share** — share your screen with everyone in the room
- **Guest access** — join without creating an account
- **Google OAuth & email** — full account support with persistent history

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Zustand |
| Backend | Node.js, Express, Socket.io |
| Database | Supabase (PostgreSQL) |
| Real-time | WebSockets (Socket.io) |
| Video calls | WebRTC (peer-to-peer mesh) |
| Deployment | Docker, Coolify |

---

## Getting Started (Local)

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/watchparty.git
cd watchparty
```

### 2. Set up the database

Run all three migration files in the Supabase SQL editor in order:

```
backend/supabase_migration.sql
backend/supabase_migration_v2.sql
backend/supabase_migration_v3.sql
```

### 3. Configure the backend

```bash
cd backend
cp .env.example .env   # then fill in your values
```

Required variables:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=your_long_random_secret
```

### 4. Configure the frontend

```bash
cd frontend
```

Edit `frontend/.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### 5. Run both servers

Backend:
```bash
cd backend
npm install
npm run dev
```

Frontend (in a new terminal):
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment (Docker + Coolify)

The project is Docker-ready with a single `docker-compose.yml` at the root.

See [.env.example](.env.example) for all required environment variables.

### Quick deploy with Coolify

1. Push this repo to GitHub
2. Set up a free server on [Oracle Cloud Free Tier](https://cloud.oracle.com) (4 vCPUs, 24 GB RAM — always free)
3. Install [Coolify](https://coolify.io) on your server
4. Create a new **Docker Compose** resource in Coolify pointing to this repo
5. Add your environment variables
6. Deploy

Coolify handles SSL certificates and domain routing automatically.

---

## Project Structure

```
watchparty/
├── backend/                  # Node.js / Express API + Socket.io
│   ├── src/
│   │   ├── controllers/      # Route handlers
│   │   ├── services/         # Business logic
│   │   ├── socket/           # Real-time event handlers
│   │   ├── middleware/        # Auth, rate limiting
│   │   └── routes/           # API routes
│   ├── server.js
│   └── Dockerfile
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # Zustand state
│   │   ├── contexts/         # React contexts
│   │   └── api/              # API client
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml        # Production deployment
└── .env.example              # Environment variable template
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server only) |
| `JWT_SECRET` | Secret for signing auth tokens |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins |

---

## License

MIT

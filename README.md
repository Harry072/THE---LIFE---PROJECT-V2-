# The Life Project

An immersive "Life Operating System" designed for young adults to find purpose and manage their life loops.

## Project Structure

- **frontend/**: React + Vite application with GSAP animations.
- **backend/**: FastAPI backend for core logic.
- **supabase/**: Database migrations and configuration.

## Setup

The app runs as two local services:

- Frontend: React/Vite on `http://localhost:5173`
- Backend: FastAPI/Uvicorn on `http://localhost:8000`
- Supabase: external hosted project

### Environment Files

Create local env files from the examples:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Frontend variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

Backend variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Never commit real `.env` files or Supabase service role keys.

### Supabase Storage: Profile Avatars

Profile photos use Supabase Storage and Auth metadata. Create this manually in
your Supabase project:

- Bucket name: `avatars`
- Bucket visibility: public for the MVP
- Upload path used by the app: `{user.id}/profile-avatar.{extension}`
- Storage policy: authenticated users can insert/update objects only inside
  their own `{user.id}/` folder
- Read policy: public read is allowed for MVP avatar URLs

Do not create a `public.profiles` table for avatars. The app stores the final
avatar URL in `user.user_metadata.avatar_url`.

### Local Startup Without Docker

Backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

### Local Startup With Docker

Docker uses `frontend/.env` and `backend/.env` through `env_file`. Supabase remains external; no local database container is started.

```bash
docker compose up --build
```

Or run detached:

```bash
docker compose up --build -d
docker compose logs -f
```

Stop the stack:

```bash
docker compose down
```

### Validation Commands

```bash
cd frontend
npm run build
```

```bash
cd backend
python -m py_compile main.py
```

```bash
docker compose config
docker compose build
docker compose up
```

### Known Local Docker Limitations

- The frontend container uses the Vite dev server for local/dev Docker only.
- Production static hosting, CDN, and Nginx-style serving are intentionally out of scope for this phase.
- Supabase migrations are not applied by Docker; apply them to the external Supabase project separately.
- If `GEMINI_API_KEY` is blank, the backend starts and task generation uses deterministic fallback tasks.

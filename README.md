# unclaimed

AI Powered Claim & Benefits Recommender

This project is a Next.js + Tailwind frontend for an AI-driven benefits discovery engine. It helps users identify eligibility for assistance programs, tax credits, and benefits based on household income, employment, location, and other personal context.

The UI is designed as a split-screen dashboard with:
- a left-side chat and profile panel for user input and eligibility insights
- a right-side live program dependency graph visualization
- ranked discovery cards showing likely benefits and claim guidance

## Screenshot

![Unclaimed Benefits Agent](./app-screenshot.png)

## Quick Start

### Backend

**With Docker (recommended):**

```bash
cd backend
cp .env.example .env   # fill in your API keys
docker compose up --build
```

**Without Docker:**

```bash
cd backend
cp .env.example .env   # fill in your API keys
make sync              # install dependencies (requires uv)
make run               # starts server on port 8000
```

API available at `http://localhost:8000`. See `docs/API_SPEC.md` for endpoints.

**Run tests:**

```bash
make test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

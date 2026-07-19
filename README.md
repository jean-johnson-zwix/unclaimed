# unclaimed

AI Powered Claim & Benefits Recommender

This project is a Next.js + Tailwind frontend for an AI-driven benefits discovery engine. It helps users identify eligibility for assistance programs, tax credits, and benefits based on household income, employment, location, and other personal context.

## Project Pitch

Millions of families miss out on life-changing support because the safety net is hard to navigate, fragmented, and full of hidden dependencies.

Unclaimed is an AI-powered benefits copilot that turns a complex eligibility maze into clear, actionable next steps.

In one flow, users can:
- share their household context through a guided intake
- see ranked likely-eligible programs with transparent "why" explanations and citations
- understand estimated annual value of unclaimed benefits
- visualize how enrolling in one program can unlock others through a live dependency graph and cascade view

Unclaimed helps people move from confusion to confidence and from missed support to claimed support.

## 2-Minute Demo Script

### 0:00-0:20
Today I’m showing Unclaimed, an AI-powered benefits copilot.
The problem is simple: millions of people qualify for support but never claim it because the system is fragmented and hard to navigate.
Unclaimed turns that complexity into clear, actionable next steps.
Currently, this demo focuses on US-based programs but could be expanded worldwide.

### 0:20-0:45
On the left, I enter household details in a guided intake form.
This is intentionally lightweight so people can start quickly.
When I submit, Unclaimed screens programs and ranks likely matches based on the household profile.

### 0:45-1:10
Now we see the results panel.
Each card shows estimated monthly and annual value, plus verdict status like likely eligible or needs review.
The key trust feature is Why you qualify, where each recommendation includes rule-based reasoning and source citations.

### 1:10-1:30
On the right is the live program graph.
This visual shows that benefits are connected, not isolated.
If I filter by category, both the graph and results stay in sync, so users can focus on exactly what matters.

### 1:30-1:50
Here’s the money shot: Unlocks N more.
Clicking it opens a cascade view from that program and reveals downstream opportunities hop-by-hop.
Edges are styled by relationship type, so you can immediately distinguish direct categorical qualification from streamline pathways.

### 1:50-2:00
So instead of asking people to decode policy complexity, Unclaimed gives them a prioritized path: what they likely qualify for now, why, and what to do next to unlock more support.

The UI is designed as a split-screen dashboard with:
- a left-side chat and profile panel for user input and eligibility insights
- a right-side live program dependency graph visualization
- ranked discovery cards showing likely benefits and claim guidance

## Screenshots

### Empty Intake State

The initial dashboard state before any household details are entered.

![Unclaimed Benefits Agent - Empty Intake](./docs/screenshots/dashboard-empty.png)

### Submitted Intake State

The filled intake state after submitting core household and income details.

![Unclaimed Benefits Agent - Submitted Intake](./docs/screenshots/dashboard-submitted.png)

### Cascade Discovery State

The cascade view opened from a selected program, showing downstream opportunities unlocked hop-by-hop.

![Unclaimed Benefits Agent - Cascade Discovery](./docs/screenshots/dashboard-cascade.png)

### Offline Fallback State

The offline-mode dashboard showing fallback recommendations when the backend is unavailable.

![Unclaimed Benefits Agent - Offline Fallback](./docs/screenshots/dashboard-offline.png)

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

# Appalachian Trail Mile Sponsorship

Full-stack starter for an interactive map where each mile marker can be sponsored.

## Features

- Interactive map with mile markers.
- Click a specific marker to sponsor that mile.
- Or use the header form to sponsor the **lowest-numbered available mile** automatically.
- Sponsored miles turn green on the map.
- Data is in-memory for now (good for prototyping); swap to a real database later.

## Structure

- `backend/` – Node + Express API
  - `GET /api/milemarkers` – list all mile markers
  - `POST /api/milemarkers/:id/donate` – sponsor a specific mile
  - `POST /api/donate-unassigned` – sponsor the lowest-numbered available mile
- `frontend/` – React + Vite + Leaflet UI

## Getting Started

### Backend

```bash
cd backend
npm install
npm start
```

Backend runs on http://localhost:4000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173 (or whatever Vite prints).

Click a marker to open the donation form for that mile.

Use the "Sponsor Next Available Mile" form in the header to let the backend
automatically assign the lowest-numbered available mile.

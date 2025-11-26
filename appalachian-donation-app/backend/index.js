// backend/index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory mile data for now.
// Later you can move this to Postgres / Firebase.
let mileMarkers = Array.from({ length: 2200 }).map((_, i) => ({
  id: i + 1,           // unique ID
  mile: i + 1,         // mile number
  lat: 35.0 + i * 0.01,  // fake coordinates for demo
  lng: -83.0 + i * 0.01,
  status: 'available', // 'available' | 'donated'
  donorName: null,
  amount: null,
  message: null,
}));

// Get all mile markers
app.get('/api/milemarkers', (req, res) => {
  res.json(mileMarkers);
});

// Donate to a specific mile (by ID)
app.post('/api/milemarkers/:id/donate', (req, res) => {
  const id = Number(req.params.id);
  const { donorName, amount, message } = req.body;

  const markerIndex = mileMarkers.findIndex(m => m.id === id);
  if (markerIndex === -1) {
    return res.status(404).json({ error: 'Mile marker not found' });
  }

  // In a real app, you would:
  // 1) Process payment / DonorDrive API here
  // 2) Only mark as donated after success

  mileMarkers[markerIndex] = {
    ...mileMarkers[markerIndex],
    status: 'donated',
    donorName: donorName || null,
    amount: amount || null,
    message: message || null,
  };

  res.json(mileMarkers[markerIndex]);
});

// Donate to the lowest-numbered available mile
app.post('/api/donate-unassigned', (req, res) => {
  const { donorName, amount, message } = req.body;

  // Find the lowest-mile "available" marker
  const availableMarkers = mileMarkers
    .filter(m => m.status === 'available')
    .sort((a, b) => a.mile - b.mile);

  if (availableMarkers.length === 0) {
    return res.status(400).json({ error: 'No available mile markers remain' });
  }

  const chosen = availableMarkers[0];
  const markerIndex = mileMarkers.findIndex(m => m.id === chosen.id);

  mileMarkers[markerIndex] = {
    ...mileMarkers[markerIndex],
    status: 'donated',
    donorName: donorName || null,
    amount: amount || null,
    message: message || null,
  };

  // Respond with the mile that was assigned
  res.json(mileMarkers[markerIndex]);
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});

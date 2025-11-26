// backend/index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// ===== DonorDrive config =====
// Your IW DonorDrive instance and event
const DONORDRIVE_BASE = 'https://irreverentwarriors.donordrive.com';
const EVENT_ID = 644;

// How many miles you want on the map.
// 2,200 miles roughly matches the AT, and
// with your scheme (mile N = $N donation), the max raise is ~2.42M.
const TOTAL_MILES = 2200;

// ===== In-memory mile data =====
// This is what the frontend reads from /api/milemarkers
let mileMarkers = Array.from({ length: TOTAL_MILES }).map((_, i) => ({
  id: i + 1,
  mile: i + 1,
  // TEMP: fake coordinates forming a diagonal line.
  // Later we can replace these with real AT coordinates along a GPX line.
  lat: 35.0 + i * 0.001,
  lng: -83.0 + i * 0.001,
  status: 'available', // 'available' | 'donated'
  donorName: null,
  amount: null,
  message: null,
}));

app.use(cors());
app.use(express.json());

// ===== DonorDrive sync logic =====
//
// For this event, each donation's DOLLAR AMOUNT maps directly to a mile:
//   $1    -> mile 1
//   $10   -> mile 10
//   $2200 -> mile 2200
//
// If two different donations have the same amount, the first one in time
// wins that mile; later ones for that exact amount are skipped.

async function syncFromDonorDrive() {
  try {
    console.log('Syncing from DonorDrive...');
    const url = `${DONORDRIVE_BASE}/api/events/${EVENT_ID}/donations`;

    // Node 18+ supports global fetch. Make sure your Render service
    // is using Node 18 or 20 in the settings.
    const res = await fetch(url);
    if (!res.ok) {
      console.error('DonorDrive API error:', res.status, res.statusText);
      return;
    }

    const donations = await res.json();

    // Reset all miles to available before re-assigning from scratch
    mileMarkers = mileMarkers.map(m => ({
      ...m,
      status: 'available',
      donorName: null,
      amount: null,
      message: null,
    }));

    // Sort donations by createdDate so earlier donations claim miles first
    donations.sort((a, b) => {
      const da = new Date(a.createdDateUTC || a.createdDate || 0);
      const db = new Date(b.createdDateUTC || b.createdDate || 0);
      return da - db;
    });

    for (const d of donations) {
      const amountNum = Number(d.amount);
      if (!amountNum || !Number.isFinite(amountNum)) continue;

      // Map donation $ amount to a mile number.
      // You can switch to Math.floor or Math.ceil if you prefer.
      const mileNumber = Math.round(amountNum);

      // Ignore weird amounts outside our mile range
      if (mileNumber < 1 || mileNumber > TOTAL_MILES) {
        console.log(
          `Skipping donation $${amountNum} (outside 1..${TOTAL_MILES})`
        );
        continue;
      }

      const idx = mileNumber - 1;

      if (mileMarkers[idx].status === 'donated') {
        // Mile already claimed by an earlier donation of the same amount.
        console.log(
          `Mile ${mileNumber} already taken, skipping donation $${amountNum}`
        );
        continue;
      }

      mileMarkers[idx] = {
        ...mileMarkers[idx],
        status: 'donated',
        donorName: d.displayName || d.donorName || null,
        amount: amountNum,
        message: d.message || null,
      };
    }

    console.log('DonorDrive sync complete.');
  } catch (err) {
    console.error('Error syncing from DonorDrive:', err);
  }
}

// ===== API endpoints =====

// Frontend calls this to render the map
app.get('/api/milemarkers', (req, res) => {
  res.json(mileMarkers);
});

// Simple healthcheck for debugging / Render
app.get('/api/healthz', (req, res) => {
  res.json({
    status: 'ok',
    totalMiles: TOTAL_MILES,
    donatedMiles: mileMarkers.filter(m => m.status === 'donated').length,
  });
});

// ===== Startup =====
app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
  // Initial sync on startup
  syncFromDonorDrive();
  // Refresh every 60 seconds. DonorDrive recommends not hitting them
  // more often than about once every 15 seconds; this is very conservative.
  setInterval(syncFromDonorDrive, 60 * 1000);
});

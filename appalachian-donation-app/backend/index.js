// backend/index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// ===== DonorDrive config =====
const DONORDRIVE_BASE = 'https://irreverentwarriors.donordrive.com';
const EVENT_ID = 644;

// How many miles / markers to display
const TOTAL_MILES = 2200;

// ===== Approximate Appalachian Trail polyline =====
// Key control points from south (Springer) to north (Katahdin).
// These are approximate but follow the real AT corridor.
const AT_CONTROL_POINTS = [
  // Springer Mountain, GA (southern terminus)
  { lat: 34.6266, lng: -84.1937 }, // Springer Mountain summit :contentReference[oaicite:6]{index=6}

  // Great Smoky Mountains / Clingmans Dome region
  { lat: 35.5639, lng: -83.4640 }, // near Clingmans Dome area :contentReference[oaicite:7]{index=7}

  // Central Virginia (Blue Ridge area)
  { lat: 37.3959, lng: -79.8583 }, // Roanoke-ish / Blue Ridge region :contentReference[oaicite:8]{index=8}

  // Pennsylvania AT "halfway" sign (Michaux State Forest)
  { lat: 40.0366, lng: -77.3573 }, // AT halfway marker coordinates :contentReference[oaicite:9]{index=9}

  // New Jersey / New York border area
  { lat: 41.1860, lng: -74.9177 }, // Delaware Water Gap / NJ–NY region :contentReference[oaicite:10]{index=10}

  // New Hampshire / White Mountains (approx)
  { lat: 43.8, lng: -71.5 }, // rough Whites / NH interior

  // Katahdin / Baxter Peak, ME (northern terminus)
  { lat: 45.9043, lng: -68.9214 }, // Baxter Peak coordinates :contentReference[oaicite:11]{index=11}
];

// Helper: interpolate along the AT_CONTROL_POINTS polyline
function getLatLngForMile(mile) {
  // Normalize mile (1..TOTAL_MILES) to t in [0, 1]
  const t = (mile - 1) / (TOTAL_MILES - 1);
  const segmentCount = AT_CONTROL_POINTS.length - 1;
  const segFrac = 1 / segmentCount;

  // Which segment are we on?
  let segIndex = Math.floor(t / segFrac);
  if (segIndex >= segmentCount) segIndex = segmentCount - 1;

  // Local t within that segment
  const t0 = segFrac * segIndex;
  const localT = (t - t0) / segFrac;

  const p0 = AT_CONTROL_POINTS[segIndex];
  const p1 = AT_CONTROL_POINTS[segIndex + 1];

  const lat = p0.lat + (p1.lat - p0.lat) * localT;
  const lng = p0.lng + (p1.lng - p0.lng) * localT;

  return { lat, lng };
}

// ===== In-memory mile data =====
let mileMarkers = Array.from({ length: TOTAL_MILES }).map((_, i) => {
  const mile = i + 1;
  const { lat, lng } = getLatLngForMile(mile);
  return {
    id: mile,
    mile,
    lat,
    lng,
    status: 'available', // 'available' | 'donated'
    donorName: null,
    amount: null,
    message: null,
  };
});

app.use(cors());
app.use(express.json());

// ===== DonorDrive sync logic =====
//
// Each donation's dollar AMOUNT maps directly to a mile number:
//   $1    -> mile 1
//   $10   -> mile 10
//   $2200 -> mile 2200
//
// If multiple donations have the same amount, the earliest one
// gets that mile and later ones for that amount are skipped.

async function syncFromDonorDrive() {
  try {
    console.log('Syncing from DonorDrive...');
    const url = `${DONORDRIVE_BASE}/api/events/${EVENT_ID}/donations`;

    // Make sure your Render Node runtime is >= 18 so global fetch exists.
    const res = await fetch(url);
    if (!res.ok) {
      console.error('DonorDrive API error:', res.status, res.statusText);
      return;
    }

    const donations = await res.json();

    // Reset all miles to available
    mileMarkers = mileMarkers.map(m => ({
      ...m,
      status: 'available',
      donorName: null,
      amount: null,
      message: null,
    }));

    // Oldest donations claim miles first
    donations.sort((a, b) => {
      const da = new Date(a.createdDateUTC || a.createdDate || 0);
      const db = new Date(b.createdDateUTC || b.createdDate || 0);
      return da - db;
    });

    for (const d of donations) {
      const amountNum = Number(d.amount);
      if (!amountNum || !Number.isFinite(amountNum)) continue;

      // $ amount -> mile number (rounded)
      const mileNumber = Math.round(amountNum);

      if (mileNumber < 1 || mileNumber > TOTAL_MILES) {
        console.log(
          `Skipping donation $${amountNum} (outside 1..${TOTAL_MILES})`
        );
        continue;
      }

      const idx = mileNumber - 1;

      if (mileMarkers[idx].status === 'donated') {
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

// Frontend uses this to render markers on the map
app.get('/api/milemarkers', (req, res) => {
  res.json(mileMarkers);
});

// Simple healthcheck
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
  // Initial sync
  syncFromDonorDrive();
  // Refresh every 60 seconds
  setInterval(syncFromDonorDrive, 60 * 1000);
});

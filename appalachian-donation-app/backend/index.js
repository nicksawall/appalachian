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
    coverageType: null,       // 'direct' | 'pooled' | null
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

    const res = await fetch(url);
    if (!res.ok) {
      console.error('DonorDrive API error:', res.status, res.statusText);
      return;
    }

    const donations = await res.json();

    // 1) Compute total raised (pooling all donations)
    const totalRaised = donations.reduce((sum, d) => {
      const amt = Number(d.amount);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);

    console.log(`Total raised: $${totalRaised.toFixed(2)}`);

    // 2) How many miles can the pool fully fund?
    // Find largest N such that 1 + 2 + ... + N <= totalRaised
    let fundedMiles = 0;
    let neededForNext = 1; // cost of mile 1, then 2, etc.
    let remaining = totalRaised;

    while (fundedMiles < TOTAL_MILES && remaining >= neededForNext) {
      remaining -= neededForNext;
      fundedMiles++;
      neededForNext = fundedMiles + 1; // cost of the next mile
    }

    console.log(`Pooled coverage: miles 1..${fundedMiles}`);

    // 3) Find first exact-amount donation for each rounded amount
    // amount -> donation
    const directByAmount = new Map();

    // Sort all donations by date so earliest gets priority
    const sorted = [...donations].sort((a, b) => {
      const da = new Date(a.createdDateUTC || a.createdDate || 0);
      const db = new Date(b.createdDateUTC || b.createdDate || 0);
      return da - db;
    });

    for (const d of sorted) {
      const amt = Math.round(Number(d.amount));
      if (!Number.isFinite(amt)) continue;
      if (amt < 1 || amt > TOTAL_MILES) continue;
      if (!directByAmount.has(amt)) {
        directByAmount.set(amt, d);
      }
    }

    // 4) Reset and rebuild mileMarkers with coverageType
    mileMarkers = mileMarkers.map((m, idx) => {
      const mile = idx + 1;
      const directDonation = directByAmount.get(mile);

      if (directDonation) {
        const amountNum = Math.round(Number(directDonation.amount) || mile);
        return {
          ...m,
          status: 'donated',
          coverageType: 'direct',
          donorName: directDonation.displayName || directDonation.donorName || null,
          amount: amountNum,
          message: directDonation.message || null,
        };
      }

      if (mile <= fundedMiles) {
        // covered by pooled donations only
        return {
          ...m,
          status: 'donated',
          coverageType: 'pooled',
          donorName: null,
          amount: null,
          message: null,
        };
      }

      // not yet funded at all
      return {
        ...m,
        status: 'available',
        coverageType: null,
        donorName: null,
        amount: null,
        message: null,
      };
    });

    console.log('DonorDrive hybrid (direct + pooled) sync complete.');
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

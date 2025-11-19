// frontend/src/App.jsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const API_BASE = 'http://localhost:4000';

// Simple icons for available vs donated
const availableIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const donatedIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function App() {
  const [mileMarkers, setMileMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Modal donation state
  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Unassigned donation state
  const [uDonorName, setUDonorName] = useState('');
  const [uAmount, setUAmount] = useState('');
  const [uMessage, setUMessage] = useState('');
  const [uSubmitting, setUSubmitting] = useState(false);
  const [uError, setUError] = useState('');
  const [uSuccess, setUSuccess] = useState('');

  // Load markers from backend
  useEffect(() => {
    fetch(`${API_BASE}/api/milemarkers`)
      .then(res => res.json())
      .then(data => setMileMarkers(data))
      .catch(err => {
        console.error(err);
        setError('Failed to load mile markers');
      });
  }, []);

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
    setDonorName('');
    setAmount('');
    setMessage('');
    setError('');
  };

  const handleDonate = async (e) => {
    e.preventDefault();
    if (!selectedMarker) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(
        `${API_BASE}/api/milemarkers/${selectedMarker.id}/donate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donorName,
            amount: Number(amount),
            message,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Donation failed');
      }

      const updatedMarker = await res.json();

      // Update markers in state so the pin turns green
      setMileMarkers(prev =>
        prev.map(m => (m.id === updatedMarker.id ? updatedMarker : m))
      );

      // Close modal
      setSelectedMarker(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignedDonate = async (e) => {
    e.preventDefault();
    setUSubmitting(true);
    setUError('');
    setUSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/donate-unassigned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: uDonorName,
          amount: Number(uAmount),
          message: uMessage,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Unassigned donation failed');
      }

      const updatedMarker = await res.json();

      // Update state
      setMileMarkers(prev =>
        prev.map(m => (m.id === updatedMarker.id ? updatedMarker : m))
      );

      setUSuccess(`Thank you! You sponsored mile ${updatedMarker.mile}.`);
      setUDonorName('');
      setUAmount('');
      setUMessage('');
    } catch (err) {
      console.error(err);
      setUError(err.message || 'Something went wrong');
    } finally {
      setUSubmitting(false);
    }
  };

  const center = [35.0, -83.0]; // starting view

  const donatedCount = mileMarkers.filter(m => m.status === 'donated').length;
  const totalCount = mileMarkers.length;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #ddd' }}>
        <h1 style={{ margin: '0 0 0.25rem 0' }}>Appalachian Trail Mile Sponsorship</h1>
        <p style={{ margin: '0 0 0.75rem 0' }}>
          Click a mile marker to sponsor it, or use the form below to sponsor the
          lowest-numbered available mile automatically. Green = already sponsored.
        </p>

        <div
          style={{
            marginBottom: '0.75rem',
            fontSize: '0.9rem',
          }}
        >
          Progress: {donatedCount} / {totalCount} miles sponsored
        </div>

        {/* Unassigned donation form */}
        <form
          onSubmit={handleUnassignedDonate}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'flex-end',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '0.85rem' }}>
              Name (optional)
              <input
                type="text"
                value={uDonorName}
                onChange={e => setUDonorName(e.target.value)}
                style={{ width: '100%', padding: '0.25rem' }}
              />
            </label>
          </div>
          <div style={{ minWidth: '120px' }}>
            <label style={{ fontSize: '0.85rem' }}>
              Amount (USD)
              <input
                type="number"
                min="1"
                step="1"
                required
                value={uAmount}
                onChange={e => setUAmount(e.target.value)}
                style={{ width: '100%', padding: '0.25rem' }}
              />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.85rem' }}>
              Message (optional)
              <input
                type="text"
                value={uMessage}
                onChange={e => setUMessage(e.target.value)}
                style={{ width: '100%', padding: '0.25rem' }}
              />
            </label>
          </div>
          <div>
            <button type="submit" disabled={uSubmitting}>
              {uSubmitting ? 'Sponsoring…' : 'Sponsor Next Available Mile'}
            </button>
          </div>
        </form>
        {uError && (
          <div style={{ color: 'red', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            {uError}
          </div>
        )}
        {uSuccess && (
          <div style={{ color: 'green', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            {uSuccess}
          </div>
        )}
      </header>

      <div style={{ flex: 1 }}>
        <MapContainer
          center={center}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mileMarkers.map(marker => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={marker.status === 'donated' ? donatedIcon : availableIcon}
              eventHandlers={{
                click: () => handleMarkerClick(marker),
              }}
            >
              <Popup>
                <div>
                  <strong>Mile {marker.mile}</strong>
                  <br />
                  Status:{' '}
                  {marker.status === 'donated'
                    ? `Donated by ${marker.donorName || 'Anonymous'}`
                    : 'Available'}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Donation Modal for specific mile */}
      {selectedMarker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSelectedMarker(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2>Sponsor Mile {selectedMarker.mile}</h2>
            <form onSubmit={handleDonate}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label>
                  Name (optional)
                  <input
                    type="text"
                    value={donorName}
                    onChange={e => setDonorName(e.target.value)}
                    style={{ width: '100%', padding: '0.25rem' }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label>
                  Amount (USD)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.25rem' }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label>
                  Message (optional)
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '0.25rem' }}
                  />
                </label>
              </div>
              {error && (
                <div style={{ color: 'red', marginBottom: '0.75rem' }}>
                  {error}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedMarker(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Processing…' : 'Donate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

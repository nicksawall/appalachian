// frontend/src/App.jsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css';
import { GestureHandling } from 'leaflet-gesture-handling';

L.Map.addInitHook('addHandler', 'gestureHandling', GestureHandling);

const API_BASE = 'https://appalachian.onrender.com';

// IW-ish palette
const IW_RED = '#b22222';
const IW_RED_DARK = '#8e1a1a';
const IW_CHARCOAL = '#111827';
const IW_SAND = '#f5f1e7';
const IW_BORDER = '#1f2933';

// Marker icons
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load markers from backend
  useEffect(() => {
    async function loadMarkers() {
      try {
        const res = await fetch(`${API_BASE}/api/milemarkers`);
        if (!res.ok) {
          throw new Error(`Failed to load mile markers: ${res.status}`);
        }
        const data = await res.json();
        setMileMarkers(data);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Failed to load mile markers');
      } finally {
        setLoading(false);
      }
    }

    loadMarkers();
  }, []);

  const donatedCount = mileMarkers.filter(m => m.status === 'donated').length;
  const totalCount = mileMarkers.length;

  // Rough center of the AT corridor
  const center = [39.0, -77.5];

  const totalPotential = totalCount * (totalCount + 1) / 2; // sum 1..N

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: IW_CHARCOAL,
        color: '#f9fafb',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: '0.75rem 1rem 0.5rem',
          borderBottom: `1px solid ${IW_BORDER}`,
          background: IW_CHARCOAL,
          position: 'relative',
          zIndex: 1000,
        }}
      >
        <div
          style={{
            borderLeft: `4px solid ${IW_RED}`,
            paddingLeft: '0.75rem',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Irreverent Warriors Appalachian Trail Fundraiser
          </h1>
          <p
            style={{
              margin: '0.35rem 0 0.15rem',
              fontSize: '0.85rem',
              color: '#e5e7eb',
              maxWidth: '60rem',
            }}
          >
            Each mile has a target donation equal to its mile number
            (mile 37 → $37). Donations are pulled live from the
            Irreverent Warriors DonorDrive event and plotted along
            the Appalachian Trail.
          </p>
        </div>

        {/* Stats / progress strip */}
        <div
          style={{
            marginTop: '0.6rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            fontSize: '0.82rem',
          }}
        >
          <div
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              background: '#1f2937',
              border: `1px solid ${IW_BORDER}`,
            }}
          >
            Miles sponsored:{' '}
            <strong style={{ color: IW_SAND }}>{donatedCount}</strong> /{' '}
            {totalCount || '…'}
          </div>

          <div
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              background: '#111827',
              border: `1px solid ${IW_BORDER}`,
              color: '#d1d5db',
            }}
          >
            Potential if every mile is filled:{' '}
            <strong style={{ color: IW_SAND }}>
              ${totalPotential.toLocaleString()}
            </strong>
          </div>

          <div
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '999px',
              background: '#111827',
              border: `1px solid ${IW_BORDER}`,
              color: '#9ca3af',
            }}
          >
            To sponsor a mile, donate that dollar amount on DonorDrive
            (for example, $10 for mile 10, $2200 for mile 2200).
          </div>
        </div>
      </header>

      {/* Content / map area */}
      <div style={{ flex: 1, padding: '0.75rem' }}>
        {loading && (
          <div
            style={{
              padding: '1rem',
              background: '#111827',
              borderRadius: '0.5rem',
              border: `1px solid ${IW_BORDER}`,
              fontSize: '0.9rem',
            }}
          >
            Loading mile markers…
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              padding: '1rem',
              background: '#7f1d1d',
              borderRadius: '0.5rem',
              border: `1px solid ${IW_RED_DARK}`,
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <div
            style={{
              height: '100%',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              border: `1px solid ${IW_BORDER}`,
              background: IW_SAND,
            }}
          >
            <MapContainer
              center={center}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
              gestureHandling={true}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mileMarkers.map(marker => {
                const isDonated = marker.status === 'donated';
                const targetAmount = marker.mile;
                const expressDonateLink = `https://irreverentwarriors.donordrive.com/index.cfm?fuseaction=donate.event&eventID=644&donationAmount=${marker.mile}#donate`;

                return (
                  <Marker
                    key={marker.id}
                    position={[marker.lat, marker.lng]}
                    icon={isDonated ? donatedIcon : availableIcon}
                  >
                    <Popup>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          minWidth: '190px',
                          maxWidth: '260px',
                          color: '#111827',
                        }}
                      >
                        <div
                          style={{
                            borderLeft: `3px solid ${IW_RED}`,
                            paddingLeft: '0.5rem',
                            marginBottom: '0.35rem',
                          }}
                        >
                            <div
                              style={{
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontSize: '0.78rem',
                                color: IW_RED_DARK,
                              }}
                            >
                              Mile {marker.mile}
                            </div>
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: '#4b5563',
                              }}
                            >
                              Target amount: $
                              {targetAmount.toLocaleString()}
                            </div>
                        </div>

                        <div
                          style={{
                            marginTop: '0.15rem',
                            fontSize: '0.82rem',
                          }}
                        >
                          Status:{' '}
                          {isDonated ? (
                            <span>
                              <strong>Sponsored</strong>
                              {marker.amount && (
                                <>
                                  {' '}
                                  (${marker.amount.toLocaleString()})
                                </>
                              )}
                              {marker.donorName && (
                                <> by {marker.donorName}</>
                              )}
                            </span>
                          ) : (
                            <span>Available</span>
                          )}
                        </div>

                        {marker.message && (
                          <div
                            style={{
                              marginTop: '0.45rem',
                              fontStyle: 'italic',
                              fontSize: '0.8rem',
                              color: '#4b5563',
                            }}
                          >
                            “{marker.message}”
                          </div>
                        )}

                        <div style={{ marginTop: '0.7rem' }}>
                          <a
                            href={expressDonateLink}
                            target="_top"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '999px',
                              border: `1px solid ${IW_RED_DARK}`,
                              background: IW_RED,
                              color: '#f9fafb',
                              textDecoration: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                            }}
                          >
                            Donate for Mile {marker.mile}
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

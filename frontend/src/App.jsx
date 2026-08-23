import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, Filler);

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

const TILE_LAYERS = {
  standard: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  standard_attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  satellite_attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  terrain_attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
};

const Routing = ({ from, to }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !from || !to) return;
    const routingControl = L.Routing.control({
      waypoints: [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)],
      routeWhileDragging: true,
      showAlternatives: true,
      lineOptions: { styles: [{ color: '#00d4ff', weight: 5 }] },
      createMarker: function(i, wp, nWps) {
        if (i === 0) return L.marker(wp.latLng, { icon: L.divIcon({ className: 'custom-marker', html: '📍', iconSize: [30, 30] }) });
        else if (i === nWps - 1) return L.marker(wp.latLng, { icon: L.divIcon({ className: 'custom-marker', html: '🏁', iconSize: [30, 30] }) });
        return false;
      }
    }).addTo(map);
    return () => { map.removeControl(routingControl); };
  }, [map, from, to]);
  return null;
};

const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && map) map.flyTo(center, zoom || 14, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
};

const TrafficOverlay = ({ locations, showTraffic }) => {
  const map = useMap();
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    if (!map) return;
    layers.forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
    if (!showTraffic || !locations || locations.length === 0) return;

    const newLayers = [];
    locations.forEach(loc => {
      if (!loc || !loc.lat || !loc.lng) return;
      const color = loc.traffic?.traffic_color || '#22c55e';
      const circle = L.circleMarker([loc.lat, loc.lng], {
        radius: 22, color: color, weight: 4, opacity: 0.9,
        fillColor: color, fillOpacity: 0.5
      });
      circle.bindPopup('<b>' + loc.name + '</b><br>Traffic: <span style="color:' + color + ';font-weight:bold;">' + (loc.traffic?.congestion || 'N/A') + '</span><br>Speed: ' + (loc.traffic?.speed || 0) + ' km/h');
      circle.addTo(map);
      newLayers.push(circle);
    });
    setLayers(newLayers);
    return () => { newLayers.forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); }); };
  }, [map, locations, showTraffic]);

  return null;
};

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedPage, setSelectedPage] = useState('Live Map');
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState('Detecting...');
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [mapType, setMapType] = useState('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [searching, setSearching] = useState(false);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [showTraffic, setShowTraffic] = useState(true);
  const [locationError, setLocationError] = useState(false);
  
  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('Family');

  const loadContacts = () => {
    fetch('http://127.0.0.1:8000/api/contacts')
      .then(res => res.json())
      .then(data => {
        setContacts(data.contacts || []);
      })
      .catch(e => console.error(e));
  };

  const addContact = () => {
    if (!newName || !newPhone) {
      alert('Please enter name and phone number');
      return;
    }
    fetch('http://127.0.0.1:8000/api/add-contact?name=' + encodeURIComponent(newName) + '&phone=' + encodeURIComponent(newPhone) + '&relation=' + encodeURIComponent(newRelation), {
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      alert('Contact added successfully!');
      setNewName('');
      setNewPhone('');
      loadContacts();
    })
    .catch(e => console.error(e));
  };

  const removeContact = (id) => {
    if (window.confirm('Remove this contact?')) {
      fetch('http://127.0.0.1:8000/api/remove-contact?contact_id=' + id, {
        method: 'DELETE'
      })
      .then(() => loadContacts())
      .catch(e => console.error(e));
    }
  };

  const sendTestAlert = () => {
    fetch('http://127.0.0.1:8000/api/send-test-alert', {
      method: 'POST'
    })
    .then(() => {
      alert('Test alert sent to all contacts!');
    })
    .catch(e => console.error(e));
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(position) {
          var latitude = position.coords.latitude;
          var longitude = position.coords.longitude;
          console.log('User location detected:', latitude, longitude);
          setUserLocation({ lat: latitude, lng: longitude });
          setMapCenter([latitude, longitude]);
          setMapZoom(14);
          setLocationError(false);
          
          fetch('http://127.0.0.1:8000/api/update-location?lat=' + latitude + '&lng=' + longitude, { 
            method: 'POST' 
          })
          .then(function(response) { return response.json(); })
          .then(function(result) {
            console.log('Location sent:', result);
            if (result.name) {
              setLocationName(result.name);
              setSelectedCity(result.name);
            }
          })
          .catch(function(e) { 
            console.error('Error sending location:', e);
          });
        },
        function(error) {
          console.warn('Geolocation error:', error.message);
          setLocationError(true);
          setLocationName('Location unavailable');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError(true);
      setLocationName('Location not supported');
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8000/api/ws');
    ws.onopen = function() { setWsConnected(true); console.log('WebSocket connected'); };
    ws.onmessage = function(event) {
      try {
        var newData = JSON.parse(event.data);
        console.log('Data received:', newData);
        if (newData.location_name) {
          setLocationName(newData.location_name);
          setSelectedCity(newData.location_name);
        }
        setData(newData);
        setLoading(false);
      } catch(e) { console.error('Error parsing WebSocket data:', e); }
    };
    ws.onclose = function() { setWsConnected(false); console.log('WebSocket disconnected'); };
    ws.onerror = function(error) { console.error('WebSocket error:', error); };
    return function() { ws.close(); };
  }, []);

  var searchLocation = function(query) {
    if (!query.trim()) return;
    setSearching(true);
    setShowResults(false);
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=10&addressdetails=1')
      .then(function(response) { return response.json(); })
      .then(function(results) {
        if (results && results.length > 0) {
          setSearchResults(results);
          setShowResults(true);
        } else {
          alert('Location not found!');
          setSearchResults([]);
        }
        setSearching(false);
      })
      .catch(function(e) {
        console.error('Search error:', e);
        alert('Error searching location');
        setSearching(false);
      });
  };

  var selectLocation = function(result) {
    var lat = parseFloat(result.lat);
    var lng = parseFloat(result.lon);
    var displayName = result.display_name;
    var parts = displayName.split(',');
    var cityName = parts[0].trim();
    
    setMapCenter([lat, lng]);
    setMapZoom(14);
    setDestinationCoords({ lat: lat, lng: lng });
    setSelectedCity(cityName);
    setLocationName(cityName);
    setShowResults(false);
    setSearchQuery('');
    setSearchResults([]);
    
    fetch('http://127.0.0.1:8000/api/update-location?lat=' + lat + '&lng=' + lng, { method: 'POST' })
      .catch(function(e) { console.error(e); });
  };

  var goToMyLocation = function() {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(14);
      setDestinationCoords(null);
      setSearchQuery('');
      setSelectedCity(locationName);
      fetch('http://127.0.0.1:8000/api/update-location?lat=' + userLocation.lat + '&lng=' + userLocation.lng, { method: 'POST' })
        .catch(function(e) { console.error(e); });
    } else {
      alert('Please enable location services');
    }
  };

  var getTileUrl = function() {
    if (mapType === 'satellite') return TILE_LAYERS.satellite;
    if (mapType === 'terrain') return TILE_LAYERS.terrain;
    return TILE_LAYERS.standard;
  };

  var getTileAttribution = function() {
    if (mapType === 'satellite') return TILE_LAYERS.satellite_attribution;
    if (mapType === 'terrain') return TILE_LAYERS.terrain_attribution;
    return TILE_LAYERS.standard_attribution;
  };

  var downloadPDF = function(type, days) {
    if (!data) { alert('No data available'); return; }
    try {
      var doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('RT-TIARP Traffic Report', 20, 20);
      doc.setFontSize(12);
      doc.text('Generated: ' + new Date().toLocaleString(), 20, 30);
      doc.text('Report Type: ' + type.toUpperCase(), 20, 40);
      doc.text('Location: ' + selectedCity, 20, 50);
      
      var tableData = locations.map(function(loc) {
        return [
          loc.name,
          loc.risk.risk_percentage + '%',
          loc.traffic.speed + ' km/h',
          loc.traffic.congestion,
          loc.weather.condition,
          loc.weather.temperature + '°C',
          loc.vehicles ? loc.vehicles.total : 'N/A'
        ];
      });
      
      autoTable(doc, {
        startY: 60,
        head: [['Location', 'Risk', 'Speed', 'Traffic', 'Weather', 'Temp', 'Vehicles']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 212, 255] }
      });
      
      doc.save('traffic_report_' + type + '_' + new Date().toISOString().slice(0,10) + '.pdf');
    } catch(e) {
      alert('Error generating PDF: ' + e.message);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0f', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #00d4ff', borderTop: '3px solid transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Getting your live location...</p>
        </div>
      </div>
    );
  }

  var { overall, locations, risk_distribution, alerts, accident_history } = data;

  var navItems = [
    { id: 'Dashboard', icon: '📊' },
    { id: 'Live Map', icon: '🗺️' },
    { id: 'Traffic Overview', icon: '🚦' },
    { id: 'Accident Risk', icon: '⚠️' },
    { id: 'Weather', icon: '🌤️' },
    { id: 'Analytics', icon: '📈' },
    { id: 'Alerts', icon: '🔔' },
    { id: 'Reports', icon: '📄' },
    { id: 'Contacts', icon: '📱' },
    { id: 'Settings', icon: '⚙️' }
  ];

  var getRiskColor = function(level) {
    if (level === 'HIGH') return '#ef4444';
    if (level === 'MEDIUM') return '#fbbf24';
    return '#22c55e';
  };

  var getWeatherIcon = function(condition) {
    var icons = { 'Clear': '☀️', 'Partly Cloudy': '⛅', 'Cloudy': '☁️', 'Light Rain': '🌦️', 'Heavy Rain': '🌧️', 'Foggy': '🌫️', 'Windy': '💨' };
    return icons[condition] || '🌤️';
  };

  // Render Contacts Page
  var renderContactsPage = function() {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>📱 Emergency Contacts</h2>
        
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>Add New Contact</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={function(e) { setNewName(e.target.value); }}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}
            />
            <input
              type="tel"
              placeholder="Phone Number (with country code)"
              value={newPhone}
              onChange={function(e) { setNewPhone(e.target.value); }}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}
            />
            <select
              value={newRelation}
              onChange={function(e) { setNewRelation(e.target.value); }}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}
            >
              <option>Family</option>
              <option>Friend</option>
              <option>Colleague</option>
              <option>Emergency</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              onClick={addContact}
              style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#00d4ff', color: '#111827', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ➕ Add Contact
            </button>
            <button
              onClick={sendTestAlert}
              style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}
            >
              📤 Send Test Alert
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#4b5563' }}>
            ⚡ When risk is above 75%, alerts will be auto-sent to all contacts
          </div>
        </div>

        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px' }}>
          <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>
            📇 Your Contacts ({contacts.length})
          </h3>
          {contacts.length > 0 ? (
            contacts.map(function(contact) {
              return (
                <div key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #1f2937' }}>
                  <div>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>{contact.name}</span>
                    <span style={{ color: '#6b7280', fontSize: '13px', marginLeft: '12px' }}>{contact.relation}</span>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>📱 {contact.phone}</div>
                  </div>
                  <button
                    onClick={function() { removeContact(contact.id); }}
                    style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
              No contacts added yet. Add family/friends to receive alerts.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Live Map
  var renderMapPage = function() {
    var center = mapCenter;
    var displayLocations = locations && locations.length > 0 ? locations : [];

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Search any place..."
              value={searchQuery}
              onChange={function(e) {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 2) {
                  searchLocation(e.target.value);
                } else {
                  setShowResults(false);
                  setSearchResults([]);
                }
              }}
              onKeyPress={function(e) { if (e.key === 'Enter') searchLocation(searchQuery); }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #374151',
                background: '#1f2937',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            {showResults && searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                maxHeight: '250px',
                overflowY: 'auto',
                zIndex: 1000,
                marginTop: '4px'
              }}>
                {searchResults.map(function(result, index) {
                  return (
                    <div
                      key={index}
                      onClick={function() { selectLocation(result); }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: index < searchResults.length - 1 ? '1px solid #374151' : 'none',
                        color: '#d1d5db',
                        fontSize: '13px'
                      }}
                      onMouseEnter={function(e) { e.target.style.background = '#374151'; }}
                      onMouseLeave={function(e) { e.target.style.background = 'transparent'; }}
                    >
                      <div style={{ fontWeight: 'bold', color: 'white' }}>{result.display_name.split(',')[0]}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{result.display_name.split(',').slice(1, 4).join(', ')}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {searching && (
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>
                Searching...
              </div>
            )}
          </div>
          
          <button
            onClick={goToMyLocation}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #3b82f6',
              background: 'rgba(59,130,246,0.1)',
              color: '#3b82f6',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            📍 My Location
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ color: '#6b7280', fontSize: '13px' }}>Map Type:</span>
          {['standard', 'satellite', 'terrain'].map(function(type) {
            return (
              <button
                key={type}
                onClick={function() { setMapType(type); }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  border: mapType === type ? '1px solid #00d4ff' : '1px solid #374151',
                  background: mapType === type ? 'rgba(0,212,255,0.1)' : '#1f2937',
                  color: mapType === type ? '#00d4ff' : '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'capitalize'
                }}
              >
                {type}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px', marginBottom: '12px', padding: '10px', background: '#111827', borderRadius: '8px', border: '1px solid #1f2937' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showTraffic} onChange={function(e) { setShowTraffic(e.target.checked); }} style={{ accentColor: '#00d4ff' }} />
            🚦 Traffic
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#00d4ff' }} />
            🚌 Public Transport
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#00d4ff' }} />
            🚲 Bicycling
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#00d4ff' }} />
            🏢 Raised Buildings
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#00d4ff' }} />
            🔥 Wildfires
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#00d4ff' }} />
            💨 Air Quality
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" style={{ accentColor: '#00d4ff' }} />
            🌐 Street View
          </label>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          padding: '8px 12px',
          background: 'rgba(0,212,255,0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(0,212,255,0.1)'
        }}>
          <span style={{ color: '#00d4ff' }}>📍</span>
          <span style={{ color: '#d1d5db', fontSize: '13px' }}>
            Your Location: <strong style={{ color: 'white' }}>{selectedCity || locationName}</strong>
          </span>
          {userLocation && (
            <span style={{ color: '#22c55e', fontSize: '12px' }}>● Live</span>
          )}
          {locationError && (
            <span style={{ color: '#ef4444', fontSize: '12px' }}>⚠️ Location not available</span>
          )}
        </div>

        <div style={{
          background: '#111827',
          borderRadius: '12px',
          border: '1px solid #1f2937',
          overflow: 'hidden',
          height: '500px',
          width: '100%'
        }}>
          <MapContainer
            key={JSON.stringify(center) + mapType}
            center={center}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <MapController center={center} zoom={mapZoom} />
            <TileLayer attribution={getTileAttribution()} url={getTileUrl()} maxZoom={20} />
            <TrafficOverlay locations={displayLocations} showTraffic={showTraffic} />

            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]}>
                <Popup>📍 Your Location</Popup>
              </Marker>
            )}

            {destinationCoords && (
              <Marker position={[destinationCoords.lat, destinationCoords.lng]}>
                <Popup>🏁 {selectedCity}</Popup>
              </Marker>
            )}

            {userLocation && destinationCoords && (
              <Routing from={userLocation} to={destinationCoords} />
            )}

            {displayLocations.map(function(loc) {
              var color = getRiskColor(loc.risk.risk_level);
              var trafficColor = loc.traffic?.traffic_color || '#22c55e';
              return (
                <Marker
                  key={loc.id}
                  position={[loc.lat, loc.lng]}
                  icon={L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="width:20px;height:20px;background:' + color + ';border-radius:50%;border:3px solid ' + trafficColor + ';box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;">' + loc.risk.risk_percentage + '%</div>',
                    iconSize: [24, 24]
                  })}
                >
                  <Popup>
                    <div style={{ padding: '8px', minWidth: '200px' }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>{loc.name}</h4>
                      <div style={{ fontSize: '13px' }}>
                        <div><strong>Risk:</strong> {loc.risk.risk_percentage}%</div>
                        <div><strong>Speed:</strong> {loc.traffic.speed} km/h</div>
                        <div><strong>Traffic:</strong> <span style={{ color: trafficColor, fontWeight: 'bold' }}>{loc.traffic.congestion}</span></div>
                        <div><strong>Weather:</strong> {loc.weather.condition}</div>
                        <div><strong>Temp:</strong> {loc.weather.temperature}°C</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', padding: '8px', background: '#111827', borderRadius: '8px', border: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '20px', height: '4px', background: '#ef4444', borderRadius: '2px' }}></span>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Heavy Traffic</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '20px', height: '4px', background: '#f97316', borderRadius: '2px' }}></span>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>High Traffic</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '20px', height: '4px', background: '#eab308', borderRadius: '2px' }}></span>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Medium Traffic</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '20px', height: '4px', background: '#22c55e', borderRadius: '2px' }}></span>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Light Traffic</span>
          </div>
        </div>
      </div>
    );
  };

  // Dashboard
  var renderDashboard = function() {
    var displayLocations = locations && locations.length > 0 ? locations : [];
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ color: '#00d4ff', fontSize: '14px' }}>📍 Your Location:</span>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>{selectedCity || locationName}</span>
          <span style={{ color: '#22c55e', fontSize: '12px', background: 'rgba(34,197,94,0.1)', padding: '2px 10px', borderRadius: '12px' }}>● Live</span>
          <span style={{ color: '#6b7280', fontSize: '13px' }}>({displayLocations.length} nearby locations)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>Traffic Status</p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{overall.traffic_status}</p>
            <p style={{ fontSize: '11px', color: overall.traffic_change > 0 ? '#22c55e' : '#ef4444' }}>{overall.traffic_change > 0 ? '↑' : '↓'} {Math.abs(overall.traffic_change)}%</p>
          </div>
          <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>Accident Risk</p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: overall.risk_percentage >= 60 ? '#ef4444' : overall.risk_percentage >= 30 ? '#fbbf24' : '#22c55e' }}>{overall.risk_percentage}%</p>
          </div>
          <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>Average Speed</p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{overall.average_speed} km/h</p>
          </div>
          <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>Active Alerts</p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: alerts && alerts.length > 0 ? '#ef4444' : '#22c55e' }}>{alerts && alerts.length || 0}</p>
            <p style={{ fontSize: '11px', color: '#6b7280' }}>Last 10 minutes</p>
          </div>
          <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>Roads Monitored</p>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{overall.roads_monitored}</p>
          </div>
          <div style={{ background: '#111827', padding: '16px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <p style={{ color: '#6b7280', fontSize: '12px' }}>Data Updated</p>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{overall.updated_at}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
            <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>📍 Nearby Locations</h3>
            {displayLocations.length > 0 ? (
              displayLocations.slice(0, 5).map(function(loc, index) {
                return (
                  <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: index < 4 ? '1px solid #1f2937' : 'none' }}>
                    <span style={{ fontSize: '13px', color: '#d1d5db' }}>{index + 1}. {loc.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: getRiskColor(loc.risk.risk_level) }}>
                      {loc.risk.risk_percentage}%
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No locations found</div>
            )}
          </div>

          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
            <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>🌤️ Weather</h3>
            {displayLocations.length > 0 ? (
              <div>
                <div style={{ textAlign: 'center', fontSize: '40px' }}>{getWeatherIcon(displayLocations[0].weather.condition)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><p style={{ fontSize: '11px', color: '#6b7280' }}>Humidity</p><p style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{displayLocations[0].weather.humidity}%</p></div>
                  <div><p style={{ fontSize: '11px', color: '#6b7280' }}>Wind Speed</p><p style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{displayLocations[0].weather.wind_speed} km/h</p></div>
                  <div><p style={{ fontSize: '11px', color: '#6b7280' }}>Visibility</p><p style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{displayLocations[0].weather.visibility} km</p></div>
                  <div><p style={{ fontSize: '11px', color: '#6b7280' }}>Pressure</p><p style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>{displayLocations[0].weather.pressure} hPa</p></div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px', color: '#d1d5db' }}>{displayLocations[0].weather.condition}</div>
              </div>
            ) : (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No weather data</div>
            )}
          </div>

          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
            <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>📊 Risk Distribution</h3>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d1d5db' }}>
                <span>High</span>
                <span style={{ color: '#ef4444' }}>{risk_distribution.high || 0}</span>
              </div>
              <div style={{ height: '6px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: displayLocations.length > 0 ? ((risk_distribution.high || 0) / displayLocations.length * 100) + '%' : '0%', background: '#ef4444' }}></div>
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d1d5db' }}>
                <span>Medium</span>
                <span style={{ color: '#fbbf24' }}>{risk_distribution.medium || 0}</span>
              </div>
              <div style={{ height: '6px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: displayLocations.length > 0 ? ((risk_distribution.medium || 0) / displayLocations.length * 100) + '%' : '0%', background: '#fbbf24' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#d1d5db' }}>
                <span>Low</span>
                <span style={{ color: '#22c55e' }}>{risk_distribution.low || 0}</span>
              </div>
              <div style={{ height: '6px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: displayLocations.length > 0 ? ((risk_distribution.low || 0) / displayLocations.length * 100) + '%' : '0%', background: '#22c55e' }}></div>
              </div>
            </div>
          </div>
        </div>

        {alerts && alerts.length > 0 && (
          <div style={{ marginTop: '16px', background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
            <h3 style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px' }}>⚠️ Active Alerts (Last 10 min - {alerts.length})</h3>
            {alerts.slice(0, 5).map(function(alert) {
              return (
                <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: 'white' }}>{alert.location}</p>
                    <p style={{ fontSize: '11px', color: '#6b7280' }}>{alert.weather || 'Clear'} • {alert.time_ago || 'Just now'}</p>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444' }}>{alert.risk_percentage}%</span>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  // Traffic Overview
  var renderTrafficPage = function() {
    var displayLocations = locations && locations.length > 0 ? locations : [];
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>🚦 Traffic Overview - {selectedCity}</h2>
        {displayLocations.length > 0 ? (
          displayLocations.map(function(loc) {
            var v = loc.vehicles || { cars: 0, buses: 0, bikes: 0, trucks: 0, total: 0 };
            var trafficColor = loc.traffic?.traffic_color || '#22c55e';
            return (
              <div key={loc.id} style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{loc.name}</span>
                  <span style={{ color: getRiskColor(loc.risk.risk_level), fontWeight: 'bold' }}>{loc.risk.risk_percentage}% Risk</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <span style={{ width: '40px', height: '4px', background: trafficColor, borderRadius: '2px' }}></span>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>{loc.traffic.congestion}</span>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>• {loc.traffic.speed} km/h</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <div><span style={{ color: '#6b7280' }}>🚗 Cars</span><br /><span style={{ color: 'white', fontWeight: 'bold' }}>{v.cars.toLocaleString()}</span></div>
                  <div><span style={{ color: '#6b7280' }}>🚌 Buses</span><br /><span style={{ color: 'white', fontWeight: 'bold' }}>{v.buses.toLocaleString()}</span></div>
                  <div><span style={{ color: '#6b7280' }}>🏍️ Bikes</span><br /><span style={{ color: 'white', fontWeight: 'bold' }}>{v.bikes.toLocaleString()}</span></div>
                  <div><span style={{ color: '#6b7280' }}>🚛 Trucks</span><br /><span style={{ color: 'white', fontWeight: 'bold' }}>{v.trucks.toLocaleString()}</span></div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#4b5563' }}>Total Vehicles: <span style={{ color: '#00d4ff', fontWeight: 'bold' }}>{v.total.toLocaleString()}</span> per day</div>
              </div>
            );
          })
        ) : (
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '40px', textAlign: 'center' }}>
            <div style={{ color: '#6b7280' }}>No traffic data available</div>
          </div>
        )}
      </div>
    );
  };

  // Risk Page
  var renderRiskPage = function() {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>⚠️ Accident Risk - {selectedCity}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Overall Risk</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: overall.risk_percentage >= 60 ? '#ef4444' : overall.risk_percentage >= 30 ? '#fbbf24' : '#22c55e' }}>{overall.risk_percentage}%</div>
          </div>
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Risk Level</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: overall.risk_percentage >= 60 ? '#ef4444' : overall.risk_percentage >= 30 ? '#fbbf24' : '#22c55e' }}>{overall.risk_percentage >= 60 ? 'High' : overall.risk_percentage >= 30 ? 'Medium' : 'Low'}</div>
          </div>
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Active Alerts</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: alerts && alerts.length > 0 ? '#ef4444' : '#22c55e' }}>{alerts && alerts.length || 0}</div>
          </div>
        </div>
      </div>
    );
  };

  // Weather Page
  var renderWeatherPage = function() {
    var displayLocations = locations && locations.length > 0 ? locations : [];
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>🌤️ Weather - {selectedCity}</h2>
        {displayLocations.length > 0 ? (
          displayLocations.map(function(loc) {
            return (
              <div key={loc.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '32px' }}>{getWeatherIcon(loc.weather.condition)}</span>
                  <div><h4 style={{ color: 'white', margin: 0 }}>{loc.name}</h4><div style={{ fontSize: '13px', color: '#6b7280' }}>{loc.weather.condition}</div></div>
                  <span style={{ marginLeft: 'auto', fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{loc.weather.temperature}°C</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                  <div>💧 {loc.weather.humidity}%</div><div>💨 {loc.weather.wind_speed} km/h</div>
                  <div>👁️ {loc.weather.visibility} km</div><div>📊 {loc.weather.pressure} hPa</div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '40px', textAlign: 'center' }}>
            <div style={{ color: '#6b7280' }}>No weather data available</div>
          </div>
        )}
      </div>
    );
  };

  // Analytics Page
  var renderAnalyticsPage = function() {
    var displayLocations = locations && locations.length > 0 ? locations : [];
    
    var getSpeedChartData = function() {
      return {
        labels: ['6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'],
        datasets: [{
          label: 'Speed (km/h)',
          data: [45, 22, 35, 48, 42, 38, 25, 40, 50],
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0,212,255,0.1)',
          fill: true,
          tension: 0.4
        }]
      };
    };

    var getRiskChartData = function() {
      return {
        labels: ['High Risk', 'Medium Risk', 'Low Risk'],
        datasets: [{
          data: [risk_distribution.high || 0, risk_distribution.medium || 0, risk_distribution.low || 0],
          backgroundColor: ['#ef4444', '#fbbf24', '#22c55e'],
          borderColor: ['#ef4444', '#fbbf24', '#22c55e'],
          borderWidth: 2
        }]
      };
    };

    var getTrafficChartData = function() {
      var trafficData = displayLocations.map(function(l) {
        return { name: l.name, speed: l.traffic.speed };
      });
      return {
        labels: trafficData.map(function(d) { return d.name; }),
        datasets: [{
          label: 'Speed (km/h)',
          data: trafficData.map(function(d) { return d.speed; }),
          backgroundColor: 'rgba(0,212,255,0.6)',
          borderColor: '#00d4ff',
          borderWidth: 1
        }]
      };
    };

    var chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9ca3af' } } },
      scales: { x: { ticks: { color: '#6b7280' } }, y: { ticks: { color: '#6b7280' } } }
    };

    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>📈 Analytics - {selectedCity}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
            <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>Speed Trend</h3>
            <div style={{ height: '250px' }}><Line data={getSpeedChartData()} options={chartOptions} /></div>
          </div>
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
            <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>Risk Distribution</h3>
            <div style={{ height: '250px', display: 'flex', justifyContent: 'center' }}><Doughnut data={getRiskChartData()} options={chartOptions} /></div>
          </div>
        </div>
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '16px' }}>
          <h3 style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '12px' }}>Traffic Speed by Location</h3>
          <div style={{ height: '250px' }}><Bar data={getTrafficChartData()} options={chartOptions} /></div>
        </div>
      </div>
    );
  };

  // Alerts Page
  var renderAlertsPage = function() {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>🔔 Alerts (Last 10 Minutes) - {selectedCity}</h2>
        {alerts && alerts.length > 0 ? (
          alerts.map(function(alert) {
            return (
              <div key={alert.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid ' + (alert.risk_level === 'HIGH' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'), padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>{getWeatherIcon(alert.weather || 'Clear')}</span>
                    <div>
                      <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{alert.location}</span>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{alert.weather || 'Clear'} • {alert.time_ago || 'Just now'}</div>
                    </div>
                  </div>
                  <span style={{ color: alert.risk_level === 'HIGH' ? '#ef4444' : '#fbbf24', fontWeight: 'bold', fontSize: '18px' }}>{alert.risk_percentage}%</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#d1d5db' }}>
                  {alert.factors ? alert.factors.slice(0, 3).join(' • ') : 'No factors'}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px' }}>✅</div>
            <div style={{ color: '#6b7280' }}>No active alerts in last 10 minutes</div>
          </div>
        )}
        
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ color: '#9ca3af', fontSize: '16px', marginBottom: '12px' }}>📋 Accident History</h3>
          {accident_history && accident_history.length > 0 ? (
            accident_history.slice(-10).reverse().map(function(acc, idx) {
              return (
                <div key={idx} style={{ background: '#111827', borderRadius: '8px', border: '1px solid #1f2937', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'white' }}>{acc.location}</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{acc.risk || 0}%</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{acc.date || 'Unknown date'} • {acc.weather || 'N/A'}</div>
                </div>
              );
            })
          ) : <div style={{ color: '#6b7280' }}>No accident history available</div>}
        </div>
      </div>
    );
  };

  // Reports Page
  var renderReportsPage = function() {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>📄 Reports - {selectedCity}</h2>
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div style={{ color: '#6b7280', fontSize: '16px' }}>Download Traffic Reports</div>
            <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '8px' }}>
              {locations && locations.length > 0 ? locations.length + ' locations' : '0 locations'} • {overall.roads_monitored} roads monitored
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
              <button onClick={function() { downloadPDF('daily', 1); }} style={{
                padding: '12px 24px', borderRadius: '8px', border: 'none',
                background: '#00d4ff', color: '#111827',
                fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
              }}>
                📥 Daily Report (PDF)
              </button>
              <button onClick={function() { downloadPDF('monthly', 30); }} style={{
                padding: '12px 24px', borderRadius: '8px', border: '1px solid #374151',
                background: '#1f2937', color: '#d1d5db',
                fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
              }}>
                📥 Monthly Report (PDF)
              </button>
              <button onClick={function() { downloadPDF('yearly', 365); }} style={{
                padding: '12px 24px', borderRadius: '8px', border: '1px solid #374151',
                background: '#1f2937', color: '#d1d5db',
                fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
              }}>
                📥 Yearly Report (PDF)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Settings Page
  var renderSettingsPage = function() {
    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>⚙️ Settings</h2>
        <div style={{ background: '#111827', borderRadius: '12px', border: '1px solid #1f2937', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Update Interval</label>
            <select style={{ background: '#1f2937', color: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #374151', width: '100%' }}>
              <option>3 seconds</option><option>5 seconds</option><option>10 seconds</option>
            </select>
          </div>
          <div>
            <label style={{ color: '#9ca3af', display: 'block', marginBottom: '4px' }}>About</label>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>
              RT-TIARP v1.0.0<br />
              Real-Time Traffic Intelligence & Accident Risk Prediction Platform<br /><br />
              Developed by Chakrapani &amp; Sasi
            </div>
          </div>
        </div>
      </div>
    );
  };

  var renderPage = function() {
    switch(selectedPage) {
      case 'Dashboard': return renderDashboard();
      case 'Live Map': return renderMapPage();
      case 'Traffic Overview': return renderTrafficPage();
      case 'Accident Risk': return renderRiskPage();
      case 'Weather': return renderWeatherPage();
      case 'Analytics': return renderAnalyticsPage();
      case 'Alerts': return renderAlertsPage();
      case 'Reports': return renderReportsPage();
      case 'Contacts': return renderContactsPage();
      case 'Settings': return renderSettingsPage();
      default: return renderDashboard();
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f', color: 'white' }}>
      <div style={{ width: '220px', background: '#111827', borderRight: '1px solid #1f2937', padding: '20px 0', flexShrink: 0, height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>
        <div style={{ padding: '0 20px 20px 20px', borderBottom: '1px solid #1f2937' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#00d4ff' }}>RT-TIARP</h1>
        </div>
        <nav style={{ padding: '12px 0' }}>
          {navItems.map(function(item) {
            return (
              <div
                key={item.id}
                onClick={function() { setSelectedPage(item.id); }}
                style={{
                  padding: '10px 20px',
                  margin: '2px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: selectedPage === item.id ? '#00d4ff' : '#9ca3af',
                  background: selectedPage === item.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>{item.icon}</span>
                <span>{item.id}</span>
              </div>
            );
          })}
        </nav>
        <div style={{ padding: '20px', borderTop: '1px solid #1f2937', marginTop: 'auto' }}>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
              <span>All Systems Operational</span>
            </div>
            <div style={{ fontSize: '11px', color: '#4b5563' }}>v1.0.0</div>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1f2937' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
                <span style={{ color: '#00d4ff' }}>Developed by</span>
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', fontWeight: 'bold' }}>
                Chakrapani &amp; Sasi
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', maxHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{selectedPage}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontSize: '13px', color: '#6b7280' }}>
              <span>Live</span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6b7280' }}></span>
              <span>Updated: {overall.updated_at}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected ? '#22c55e' : '#ef4444' }}></span>
                <span style={{ color: wsConnected ? '#22c55e' : '#ef4444' }}>{wsConnected ? 'Connected' : 'Disconnected'}</span>
              </span>
              {selectedCity && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00d4ff' }}>
                  <span>📍</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedCity}</span>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f2937', padding: '6px 14px', borderRadius: '20px', border: '1px solid #374151' }}>
            <span style={{ color: '#fbbf24', fontSize: '14px' }}>⚡</span>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Simulation</span>
          </div>
        </div>

        {renderPage()}
      </div>
    </div>
  );
};

export default App;

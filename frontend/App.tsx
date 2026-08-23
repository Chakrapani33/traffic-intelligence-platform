@"
import React, { useState, useEffect } from 'react';
import './styles/globals.css';

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  traffic: {
    speed: number;
    volume: number;
    congestion: string;
    occupancy: number;
  };
  weather: {
    temperature: number;
    humidity: number;
    rainfall: number;
    wind_speed: number;
    visibility: number;
    pressure: number;
    condition: string;
  };
  risk: {
    risk_score: number;
    risk_percentage: number;
    risk_level: string;
    factors: string[];
  };
  updated_at: string;
}

interface DashboardData {
  locations: Location[];
  overall: {
    traffic_status: string;
    traffic_change: number;
    risk_percentage: number;
    average_speed: number;
    speed_change: number;
    active_alerts: number;
    roads_monitored: number;
    updated_at: string;
  };
  risk_distribution: {
    high: number;
    medium: number;
    low: number;
  };
  top_risk_locations: Location[];
  alerts: any[];
}

const App: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8000/api/ws');

    ws.onopen = () => {
      setWsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        setData(newData);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing WebSocket data:', error);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => ws.close();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Connecting to real-time data...</p>
          <p className="text-gray-600 text-sm mt-2">Make sure the backend is running</p>
        </div>
      </div>
    );
  }

  const { overall, locations, risk_distribution, top_risk_locations, alerts } = data;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'text-red-500';
      case 'MEDIUM': return 'text-yellow-500';
      case 'LOW': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-500/10 border-red-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'LOW': return 'bg-green-500/10 border-green-500/20';
      default: return 'bg-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-blue-400">RT-TIARP</span>
            <span className="text-gray-500 text-lg font-normal">Dashboard</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span>Last updated: {overall.updated_at}</span>
            <span className={\`flex items-center gap-1 ml-2 \${wsConnected ? 'text-green-500' : 'text-red-500'}\`}>
              <span className={\`w-2 h-2 rounded-full \${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}\`}></span>
              <span>{wsConnected ? 'Live' : 'Disconnected'}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
          <span className="text-yellow-500 animate-pulse">⚡</span>
          <span className="text-gray-400">Simulation Mode</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className={\`bg-gray-800 rounded-xl p-4 border \${getRiskBg(overall.traffic_status)}\`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Traffic Status</p>
              <p className="text-2xl font-bold text-white">{overall.traffic_status}</p>
              <p className={\`text-xs \${overall.traffic_change > 0 ? 'text-green-500' : 'text-red-500'}\`}>
                {overall.traffic_change > 0 ? '↑' : '↓'} {Math.abs(overall.traffic_change)}% vs last hour
              </p>
            </div>
            <div className="text-2xl">🚗</div>
          </div>
        </div>

        <div className={\`bg-gray-800 rounded-xl p-4 border \${getRiskBg(overall.risk_percentage >= 60 ? 'HIGH' : overall.risk_percentage >= 30 ? 'MEDIUM' : 'LOW')}\`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Accident Risk</p>
              <p className="text-2xl font-bold text-white">{overall.risk_percentage}%</p>
              <p className={\`text-sm font-medium \${getRiskColor(overall.risk_percentage >= 60 ? 'HIGH' : overall.risk_percentage >= 30 ? 'MEDIUM' : 'LOW')}\`}>
                {overall.risk_percentage >= 60 ? '🔴 High Risk' : overall.risk_percentage >= 30 ? '🟡 Medium Risk' : '🟢 Low Risk'}
              </p>
            </div>
            <div className="text-2xl">⚠️</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Average Speed</p>
              <p className="text-2xl font-bold text-white">{overall.average_speed} <span className="text-sm font-normal text-gray-400">km/h</span></p>
              <p className={\`text-xs \${overall.speed_change > 0 ? 'text-green-500' : 'text-red-500'}\`}>
                {overall.speed_change > 0 ? '↑' : '↓'} {Math.abs(overall.speed_change)}% vs last hour
              </p>
            </div>
            <div className="text-2xl">📊</div>
          </div>
        </div>

        <div className={\`bg-gray-800 rounded-xl p-4 border \${alerts.length > 0 ? 'border-red-500/20' : 'border-green-500/20'}\`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Active Alerts</p>
              <p className="text-2xl font-bold text-white">{alerts.length}</p>
              <p className="text-xs text-gray-400">
                {alerts.length > 0 ? \`\${alerts.length} alerts active\` : '✅ All clear'}
              </p>
            </div>
            <div className="text-2xl">{alerts.length > 0 ? '🔔' : '✅'}</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Roads Monitored</p>
              <p className="text-2xl font-bold text-white">{overall.roads_monitored}</p>
              <p className="text-xs text-green-500">● Live</p>
            </div>
            <div className="text-2xl">📍</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">Data Updated</p>
              <p className="text-lg font-bold text-white">{overall.updated_at}</p>
              <p className="text-xs text-green-500">🔄 Real-time</p>
            </div>
            <div className="text-2xl">⏰</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
              <span>📍</span> Top Accident Prone Locations
            </h3>
            <div className="space-y-2">
              {top_risk_locations.slice(0, 5).map((loc, index) => (
                <div key={loc.id} className="flex items-center justify-between p-3 hover:bg-gray-700/50 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <span className={\`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full \${index === 0 ? 'bg-red-500/20 text-red-500' : index === 1 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-600/30 text-gray-400'}\`}>
                      {index + 1}
                    </span>
                    <div>
                      <span className="text-white text-sm font-medium">{loc.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={\`w-1.5 h-1.5 rounded-full \${loc.risk.risk_level === 'HIGH' ? 'bg-red-500' : loc.risk.risk_level === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}\`}></span>
                        <span className="text-xs text-gray-400">{loc.risk.risk_level}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-400">{loc.traffic.congestion}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={\`text-sm font-bold \${getRiskColor(loc.risk.risk_level)}\`}>
                      {loc.risk.risk_percentage}%
                    </span>
                    <p className="text-xs text-gray-500">{loc.traffic.speed} km/h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {locations.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <span>🌤️</span> Weather Overview
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-700/30 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Humidity</p>
                    <p className="text-white font-semibold">{locations[0].weather.humidity}%</p>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Wind Speed</p>
                    <p className="text-white font-semibold">{locations[0].weather.wind_speed} km/h</p>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Visibility</p>
                    <p className="text-white font-semibold">{locations[0].weather.visibility} km</p>
                  </div>
                  <div className="bg-gray-700/30 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Pressure</p>
                    <p className="text-white font-semibold">{locations[0].weather.pressure} hPa</p>
                  </div>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Current Condition</p>
                  <p className="text-white font-semibold">{locations[0].weather.condition}</p>
                  <p className="text-xs text-gray-400 mt-1">{locations[0].weather.temperature}°C</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <span>📊</span> Risk Distribution
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-16">High</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: \`\${(risk_distribution.high / overall.roads_monitored) * 100}%\` }}></div>
                </div>
                <span className="text-sm font-bold text-red-500">{risk_distribution.high}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-16">Medium</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: \`\${(risk_distribution.medium / overall.roads_monitored) * 100}%\` }}></div>
                </div>
                <span className="text-sm font-bold text-yellow-500">{risk_distribution.medium}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-16">Low</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: \`\${(risk_distribution.low / overall.roads_monitored) * 100}%\` }}></div>
                </div>
                <span className="text-sm font-bold text-green-500">{risk_distribution.low}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 border border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <span>🔔</span> Active Alerts ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <div>
                    <p className="text-sm text-white font-medium">{alert.location}</p>
                    <p className="text-xs text-gray-400">{alert.factors.slice(0, 3).join(' • ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-red-500">{alert.risk_percentage}%</span>
                  <p className="text-xs text-gray-500">{alert.severity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-gray-500 border-t border-gray-800 pt-4">
        <p>RT-TIARP v1.0.0 — Real-Time Traffic Intelligence & Accident Risk Prediction Platform</p>
        <p className="mt-1">Simulation Mode • Data updates every 3 seconds</p>
      </div>
    </div>
  );
};

export default App;
"@ | Out-File -FilePath "src\App.tsx" -Encoding utf8
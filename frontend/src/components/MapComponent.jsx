import React, { useEffect, useRef, useState } from 'react';

export default function MapComponent({
  hospitals = [],
  userLocation,
  selectedHospital,
  onSelectHospital
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLineRef = useRef(null);
  const routeRequestRef = useRef(0);
  const [routeStatus, setRouteStatus] = useState('');

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const initialLat = userLocation?.lat || 20.2961;
      const initialLon = userLocation?.lon || 85.8245;

      const map = window.L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([initialLat, initialLon], 13);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (userLocation?.lat && userLocation?.lon) {
      map.flyTo([userLocation.lat, userLocation.lon], 13, { duration: 1.0 });
    }

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (userLocation) {
      const userHtml = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
          <div style="position:absolute;width:32px;height:32px;background:rgba(37,99,235,0.3);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:16px;height:16px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(37,99,235,0.8);z-index:10;"></div>
        </div>
      `;
      const userIcon = window.L.divIcon({
        className: 'user-loc-pin',
        html: userHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const userMarker = window.L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;">
            <b style="color:#2563eb;">Your Emergency Origin</b><br/>
            <span>${userLocation.name || 'Current GPS Location'}</span><br/>
            <span style="color:#64748b;font-size:10px;">${userLocation.lat.toFixed(4)} N, ${userLocation.lon.toFixed(4)} E</span>
          </div>
        `);
      markersRef.current.push(userMarker);
    }

    hospitals.forEach((h) => {
      const isInTopN = h.is_in_top_n;
      const isSelected = selectedHospital?.hospital_id === h.hospital_id;

      const bgColor = isSelected ? '#1d4ed8' : isInTopN ? '#2563eb' : '#64748b';
      const border = isSelected ? '3px solid #facc15' : '2px solid white';
      const scale = isSelected ? 'scale(1.15)' : 'scale(1)';

      const markerHtml = `
        <div style="transform:${scale};transition:all 0.2s;display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:${bgColor};color:white;font-weight:800;font-size:12px;border-radius:50%;border:${border};box-shadow:0 4px 10px rgba(0,0,0,0.25);">
          ${isInTopN ? h.selection_rank : h.rank}
        </div>
      `;

      const markerIcon = window.L.divIcon({
        className: 'hosp-pin',
        html: markerHtml,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = window.L.marker([h.latitude, h.longitude], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:12px;min-width:200px;">
            <div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:2px;">
              ${isInTopN ? `Top N pick #${h.selection_rank} · ` : ''}#${h.rank} ${h.hospital_name}
            </div>
            <div style="color:#2563eb;font-weight:700;margin-bottom:4px;">
              ${h.is_real_road ? '' : '~'}${h.road_distance_km || h.distance_km} km (${h.is_real_road ? '' : '~'}${h.eta_minutes || Math.round(h.distance_km * 2.2)} mins ETA${h.is_real_road ? '' : ', estimate'})
            </div>
            <div style="display:flex;gap:4px;margin-bottom:8px;">
              <span style="background:#eff6ff;color:#1e40af;padding:2px 6px;border-radius:4px;font-weight:700;">INR ${h.admission_fee_inr}</span>
              <span style="background:#ecfdf5;color:#065f46;padding:2px 6px;border-radius:4px;font-weight:700;">Rating: ${h.rating_5}</span>
            </div>
            <a href="${h.directions_url}" target="_blank" rel="noreferrer" style="display:inline-block;background:#2563eb;color:white;padding:4px 8px;border-radius:6px;font-weight:700;text-decoration:none;font-size:11px;">
              Open Google Maps Driving Route &rarr;
            </a>
          </div>
        `);

      marker.on('click', () => {
        onSelectHospital(h);
      });

      if (isSelected) {
        marker.openPopup();
      }

      markersRef.current.push(marker);
    });
  }, [hospitals, userLocation, selectedHospital, onSelectHospital]);

  useEffect(() => {
    const container = mapContainerRef.current;
    const map = mapInstanceRef.current;
    if (!container || !map || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const requestId = ++routeRequestRef.current;
    let cancelled = false;
    if (map && routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (!map || !window.L || !selectedHospital || !userLocation) {
      setRouteStatus('');
      return undefined;
    }
    setRouteStatus('Loading route…');

    const fetchRoute = async () => {
      try {
        const params = new URLSearchParams({
          origin_lat: String(userLocation.lat),
          origin_lon: String(userLocation.lon),
          dest_lat: String(selectedHospital.latitude),
          dest_lon: String(selectedHospital.longitude)
        });
        const res = await fetch(`/api/route?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Route request failed with HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled || requestId !== routeRequestRef.current) return;
        if (Array.isArray(data.coordinates) && data.coordinates.length > 0) {
          const polyline = window.L.polyline(data.coordinates, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(map);

          routeLineRef.current = polyline;
          map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
          setRouteStatus(
            data.is_real_road
              ? `Road route · ${data.distance_km} km · ${data.eta_minutes} min`
              : `Approximate route · ~${data.distance_km} km · ~${data.eta_minutes} min`
          );
        } else if (data.status !== 'success') {
          throw new Error(data.message || 'The route service did not return a route.');
        }
      } catch (err) {
        if (!cancelled && requestId === routeRequestRef.current) {
          console.error('Route error:', err);
          setRouteStatus('Route unavailable; use the map directions link.');
        }
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [selectedHospital, userLocation]);

  return (
    <div className="w-full h-full min-h-[340px] sm:min-h-[480px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative">
      {routeStatus && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-3 left-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow"
        >
          {routeStatus}
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full min-h-[340px] sm:min-h-[480px]" />
    </div>
  );
}

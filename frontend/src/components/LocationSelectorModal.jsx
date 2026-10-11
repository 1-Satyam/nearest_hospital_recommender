import React, { useState } from 'react';
import { IconMapPin, IconCross, IconRefresh, IconSearch } from './Icons';

const BBSR_LOCATION_HUBS = [
  { id: 'iter', name: 'ITER Main Gate', area: 'Jagamara / Khandagiri', zone: 'Colleges & Tech Hubs', lat: 20.2505, lon: 85.7974 },
  { id: 'kiit', name: 'KIIT Square / Campus', area: 'Patia Corridor', zone: 'Colleges & Tech Hubs', lat: 20.3547, lon: 85.8190 },
  { id: 'soa', name: 'SOA University (Campus 2)', area: 'Kalinga Nagar / Ghatikia', zone: 'Colleges & Tech Hubs', lat: 20.2790, lon: 85.7680 },
  { id: 'aiims', name: 'AIIMS Bhubaneswar Campus', area: 'Sijua / Patrapada Highway', zone: 'West & Highway', lat: 20.2317, lon: 85.7788 },
  { id: 'baramunda', name: 'Baramunda ISBT Terminal', area: 'NH-16 Highway Junction', zone: 'West & Highway', lat: 20.2780, lon: 85.7876 },
  { id: 'khandagiri', name: 'Khandagiri Square', area: 'Udayagiri / Main Junction', zone: 'West & Highway', lat: 20.2588, lon: 85.7876 },
  { id: 'oldtown', name: 'Old Town / Lingaraj Temple', area: 'Heritage & Southern Zone', zone: 'Old Town & South', lat: 20.2420, lon: 85.8340 },
  { id: 'sundarpada', name: 'Sundarpada Main Road', area: 'Kapilaprasad Corridor', zone: 'Old Town & South', lat: 20.2280, lon: 85.8240 },
  { id: 'master_canteen', name: 'Master Canteen Square', area: 'Bhubaneswar Railway Station', zone: 'Central & Station', lat: 20.2668, lon: 85.8436 },
  { id: 'saheed_nagar', name: 'Saheed Nagar / Janpath', area: 'Commercial Corridor', zone: 'Central & Station', lat: 20.2882, lon: 85.8447 },
  { id: 'nayapalli', name: 'Nayapalli / CRP Square', area: 'IRC Village & Flyover', zone: 'Central & Station', lat: 20.2915, lon: 85.8080 },
  { id: 'jayadev_vihar', name: 'Jayadev Vihar Square', area: 'Fortune Tower Corridor', zone: 'Central & Station', lat: 20.3003, lon: 85.8235 },
  { id: 'patia', name: 'Patia / Infocity', area: 'Tech Corridor North', zone: 'North & Patia', lat: 20.3588, lon: 85.8160 },
  { id: 'sailashree', name: 'Sailashree Vihar', area: 'Chandrasekharpur North', zone: 'North & Patia', lat: 20.3340, lon: 85.8115 },
  { id: 'niladri', name: 'Niladri Vihar', area: 'District Centre Extension', zone: 'North & Patia', lat: 20.3395, lon: 85.8185 },
  { id: 'rasulgarh', name: 'Rasulgarh Square', area: 'Cuttack-Puri Highway Bypass', zone: 'Central & Station', lat: 20.2970, lon: 85.8640 }
];

export default function LocationSelectorModal({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  isDarkMode
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [activeZone, setActiveZone] = useState('All');

  if (!isOpen) return null;

  const zones = ['All', 'Colleges & Tech Hubs', 'West & Highway', 'Central & Station', 'Old Town & South', 'North & Patia'];

  const filteredHubs = BBSR_LOCATION_HUBS.filter(hub => {
    const matchesZone = (activeZone === 'All') || (hub.zone === activeZone);
    const matchesSearch = !searchQuery.trim() ||
      hub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hub.area.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  const handleSelectHub = (hub) => {
    onSelectLocation({
      name: `${hub.name}, Bhubaneswar`,
      lat: hub.lat,
      lon: hub.lon,
      isLiveGPS: false,
      isManual: true
    });
    onClose();
  };

  const handleSearchAddress = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?query=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (data && data.location) {
        onSelectLocation({
          name: data.location.name,
          lat: data.location.lat,
          lon: data.location.lon,
          isLiveGPS: false,
          isManual: true
        });
        onClose();
      }
    } catch {
      onSelectLocation({
        name: `${searchQuery.trim()}, Bhubaneswar`,
        lat: 20.2505,
        lon: 85.7974,
        isLiveGPS: false,
        isManual: true
      });
      onClose();
    } finally {
      setSearching(false);
    }
  };

  const handleDetectGPS = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        onSelectLocation({
          name: 'Live GPS Location',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          isLiveGPS: true
        });
        onClose();
      },
      () => {
        setGpsLoading(false);
        setGpsError('Could not access device GPS. Please pick a landmark below.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`rounded-3xl max-w-xl w-full max-h-[88vh] shadow-2xl overflow-hidden border flex flex-col transition-colors ${
          isDarkMode ? 'bg-[#18181B] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${
          isDarkMode ? 'bg-[#131315] border-[#2D2D34]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <IconMapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-black text-base leading-snug ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                Set Location
              </h3>
              <p className={`text-xs font-bold mt-0.5 ${isDarkMode ? 'text-stone-400' : 'text-slate-500'}`}>
                Estimated distance and ETA update from here; map routes may be approximate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${
              isDarkMode ? 'text-stone-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Search bar */}
          <form onSubmit={handleSearchAddress} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address or colony (e.g. ITER, Patia, Sailashree)..."
                className={`w-full text-xs sm:text-sm pl-9 pr-3 py-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  isDarkMode
                    ? 'bg-[#131315] border-[#2D2D34] text-white placeholder-stone-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <IconSearch className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-sm shrink-0 cursor-pointer"
            >
              {searching ? 'Finding...' : 'Find'}
            </button>
          </form>

          {/* GPS Quick Action Button */}
          <button
            onClick={handleDetectGPS}
            disabled={gpsLoading}
            className={`w-full font-black text-xs sm:text-sm py-3 rounded-xl border transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
              isDarkMode
                ? 'bg-[#222226] hover:bg-[#2A2A30] border-[#2D2D34] text-white'
                : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
            }`}
          >
            {gpsLoading ? (
              <>
                <IconRefresh className="w-4 h-4 animate-spin text-blue-500" />
                <span>Locating Your Device...</span>
              </>
            ) : (
              <>
                <IconMapPin className="w-4 h-4 text-blue-500" />
                <span>Live Location (GPS)</span>
              </>
            )}
          </button>

          {gpsError && (
            <div className="p-2.5 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-500 text-center font-bold">
              {gpsError}
            </div>
          )}

          {/* Category Pills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black">
              <span className={`uppercase text-[10px] tracking-wider ${isDarkMode ? 'text-stone-400' : 'text-slate-500'}`}>
                Quick Landmarks & Sectors
              </span>
              <span className={`text-[10px] ${isDarkMode ? 'text-stone-500' : 'text-slate-400'}`}>
                {filteredHubs.length} available
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {zones.map((zone) => (
                <button
                  key={zone}
                  onClick={() => setActiveZone(zone)}
                  className={`text-[11px] font-black px-3 py-1 rounded-xl transition cursor-pointer ${
                    activeZone === zone
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDarkMode
                      ? 'bg-[#222226] text-stone-300 hover:bg-[#2D2D34]'
                      : 'bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>

          {/* High-Contrast Landmarks List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filteredHubs.map((hub) => {
              const isCurrent =
                Math.abs((currentLocation?.lat || 0) - hub.lat) < 0.005 &&
                Math.abs((currentLocation?.lon || 0) - hub.lon) < 0.005;

              return (
                <div
                  key={hub.id}
                  onClick={() => handleSelectHub(hub)}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-center justify-between group shadow-sm ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40'
                      : isDarkMode
                      ? 'border-[#2D2D34] bg-[#141416] hover:border-blue-500 hover:bg-[#1E1E22]'
                      : 'border-slate-200 bg-white hover:border-blue-500 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-black text-sm tracking-tight ${
                        isDarkMode ? 'text-white' : 'text-[#0F172A]'
                      }`}>
                        {hub.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-md font-black">
                          Current
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-bold block mt-1 ${
                      isDarkMode ? 'text-stone-400' : 'text-[#475569]'
                    }`}>
                      {hub.area}
                    </span>
                  </div>

                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Select ➔
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import TopNSlider from './components/TopNSlider';
import TopNSortControls from './components/TopNSortControls';
import HospitalCard from './components/HospitalCard';
import MapComponent from './components/MapComponent';
import ComparisonTable from './components/ComparisonTable';
import EmergencyFlowModal from './components/EmergencyFlowModal';
import GeneralAdmissionFlow from './components/GeneralAdmissionFlow';
import ProfileModal from './components/ProfileModal';
import HoldPassView from './components/HoldPassView';
import DeskPortalModal from './components/DeskPortalModal';
import LocationSelectorModal from './components/LocationSelectorModal';
import AuthModal from './components/AuthModal';
import ChatbotDrawer from './components/ChatbotDrawer';
import { IconAlert, IconBed, IconShield, IconSearch, IconCheck, IconArrowRight, IconMapPin } from './components/Icons';
import { HOSPITAL_SORT_DEFAULTS, sortHospitals } from './utils/hospitalSorting';

const latestActiveHold = (ledger) => [...ledger].reverse().find((hold) => hold.status === 'HELD') || null;

export default function App() {
  const requestedHoldId = new URLSearchParams(window.location.search).get('hold_id');
  useEffect(() => {
    const handleReset = () => {
      setActiveTab("explore");
      const portalUrl = new URL(window.location.href);
      portalUrl.searchParams.delete('hold_id');
      window.history.replaceState({}, '', `${portalUrl.pathname}${portalUrl.search}${portalUrl.hash}`);
    };
    window.addEventListener("arogya:reset-hold-pass", handleReset);
    return () => window.removeEventListener("arogya:reset-hold-pass", handleReset);
  }, []);
  const [user, setUser] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('bbsr_theme');
    if (savedTheme) return savedTheme === 'dark';
    const currentHour = new Date().getHours();
    return currentHour < 6 || currentHour >= 18;
  });

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('bbsr_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localities, setLocalities] = useState([]);
  const [userLocation, setUserLocation] = useState({
    name: 'Bhubaneswar Central',
    lat: 20.2961,
    lon: 85.8245,
    isLiveGPS: false
  });

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            name: 'Live GPS Location',
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            isLiveGPS: true,
            accuracy: Math.round(pos.coords.accuracy)
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  const [hospitals, setHospitals] = useState([]);
  const [registryStats, setRegistryStats] = useState(null);
  const [specialtiesList, setSpecialtiesList] = useState([]);
  const [topN, setTopN] = useState(10);
  const [topNSortKey, setTopNSortKey] = useState('recommended');
  const [topNSortDirection, setTopNSortDirection] = useState('asc');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [pmjayOnly, setPmjayOnly] = useState(false);
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => requestedHoldId ? 'hold_pass' : 'gateway');
  const [selectedHospital, setSelectedHospital] = useState(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeskPortal, setShowDeskPortal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [emergencyModalHospital, setEmergencyModalHospital] = useState(null);
  const [holdLedger, setHoldLedger] = useState([]);
  const [activeHoldPass, setActiveHoldPass] = useState(null);
  const [accountReady, setAccountReady] = useState(false);
  const [holdPassLoading, setHoldPassLoading] = useState(Boolean(requestedHoldId));
  const [holdPassError, setHoldPassError] = useState('');
  const [loading, setLoading] = useState(true);

  const recordHoldUpdate = (holdInfo) => {
    if (!holdInfo?.request_id) return;
    setHoldLedger((current) => {
      return [...current.filter((hold) => hold.request_id !== holdInfo.request_id), holdInfo];
    });
    setActiveHoldPass(holdInfo);
  };

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem('bbsr_hospital_user');
    localStorage.removeItem('bbsr_hold_ledger');
    const loadAccount = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const account = await response.json();
        if (!response.ok) throw new Error(account.detail || 'Could not validate your sign-in session.');
        if (!cancelled) setAccountReady(true);
        if (!account.user) {
          if (!cancelled) {
            setUser(null);
            setHoldLedger([]);
          }
          return;
        }
        if (cancelled) return;
        setUser(account.user);

        const ledgerResponse = await fetch('/api/requests/mine');
        const ledgerData = await ledgerResponse.json();
        if (!ledgerResponse.ok) throw new Error(ledgerData.detail || 'Could not load your reservations.');
        if (cancelled) return;
        const nextLedger = (ledgerData.requests || []).map((hold) => ({
          ...hold,
          hospital_name: hospitals.find((hospital) => hospital.hospital_id === hold.hospital_id)?.hospital_name || hold.hospital_id
        }));
        setHoldLedger(nextLedger);
      } catch (error) {
        if (!cancelled) {
          setAccountReady(true);
          console.error('Could not load signed-in account data:', error);
        }
      }
    };
    loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!requestedHoldId || !accountReady) return undefined;
    if (!user) {
      setHoldPassLoading(false);
      setHoldPassError('Sign in to view this bed-hold pass.');
      return undefined;
    }

    let cancelled = false;
    setHoldPassLoading(true);
    setHoldPassError('');
    fetch(`/api/requests/${encodeURIComponent(requestedHoldId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Could not load this bed-hold pass.');
        if (cancelled) return;
        setActiveHoldPass(data);
        setHoldLedger((current) => [
          ...current.filter((hold) => hold.request_id !== data.request_id),
          data
        ]);
      })
      .catch((error) => {
        if (!cancelled) setHoldPassError(error.message || 'Could not load this bed-hold pass.');
      })
      .finally(() => {
        if (!cancelled) setHoldPassLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedHoldId, accountReady, user]);

  useEffect(() => {
    if (!hospitals.length) return;
    setHoldLedger((current) => {
      let changed = false;
      const next = current.map((hold) => {
        const hospitalName = hospitals.find((hospital) => hospital.hospital_id === hold.hospital_id)?.hospital_name || hold.hospital_id;
        if (hold.hospital_name === hospitalName) return hold;
        changed = true;
        return { ...hold, hospital_name: hospitalName };
      });
      return changed ? next : current;
    });
  }, [hospitals, holdLedger]);

  useEffect(() => {
    setActiveHoldPass((current) => {
      const refreshedCurrent = current && holdLedger.find((hold) => hold.request_id === current.request_id);
      return refreshedCurrent || latestActiveHold(holdLedger);
    });
  }, [holdLedger]);

  const [filterCardsToTopN, setFilterCardsToTopN] = useState(true);
  const handleTopNSortKeyChange = (key) => {
    setTopNSortKey(key);
    setTopNSortDirection(HOSPITAL_SORT_DEFAULTS[key] || 'asc');
  };
  const handleTopNChange = (value) => {
    setTopN(value);
    setFilterCardsToTopN(true);
  };
  const handleGeneralWardRequest = (hospital) => {
    if (hospital) setSelectedHospital(hospital);
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setActiveTab('general_flow');
  };
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Server did not confirm sign out.');
    } catch (error) {
      console.error('Could not invalidate server session:', error);
    } finally {
      setUser(null);
      setHoldLedger([]);
      setActiveHoldPass(null);
      setIsProfileOpen(false);
    }
  };
  const handleAuthSuccess = (userData) => {
    setUser(userData);
    fetch('/api/requests/mine')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Could not load your reservations.');
        const nextLedger = (data.requests || []).map((hold) => ({
          ...hold,
          hospital_name: hospitals.find((hospital) => hospital.hospital_id === hold.hospital_id)?.hospital_name || hold.hospital_id
        }));
        setHoldLedger(nextLedger);
      })
      .catch((error) => console.error('Could not load account reservations:', error));
  };
  const handleUpdateUser = async (userData) => {
    const response = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: userData.name,
        has_pmjay: userData.has_pmjay,
        pmjay_card_number: userData.pmjay_card_number
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Could not save your account profile.');
    const updatedUser = { ...userData, ...data.user };
    setUser(updatedUser);
    return updatedUser;
  };

  const fetchRegistryStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not refresh bed registry totals.');
      setRegistryStats(data);
      return data;
    } catch (error) {
      console.error('Could not load bed registry totals:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchRegistryStats().then((data) => {
      const localitiesList = Array.isArray(data?.localities) ? data.localities : [];
      if (localitiesList.length) setLocalities(localitiesList);
    });

    fetch('/api/specialties')
      .then(res => res.json())
      .then(data => {
        const specialties = Array.isArray(data) ? data : Array.isArray(data?.specialties) ? data.specialties : [];
        if (specialties.length) setSpecialtiesList(specialties);
      })
      .catch(err => console.error(err));
  }, []);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: userLocation.lat,
        lon: userLocation.lon,
        top_n: topN,
        pmjay_only: String(pmjayOnly),
        emergency_only: String(emergencyOnly)
      });
      if (selectedSpecialty && selectedSpecialty.toLowerCase() !== 'all') params.append('specialty', selectedSpecialty);

      const res = await fetch(`/api/hospitals?${params.toString()}`);
      const data = await res.json();
      const hospitalList = Array.isArray(data?.hospitals) ? data.hospitals : Array.isArray(data) ? data : [];
      if (hospitalList.length) {
        setHospitals(hospitalList);
        if (!selectedHospital && hospitalList.length > 0) {
          setSelectedHospital(hospitalList[0]);
        }
      } else {
        setHospitals([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshBedInventory = () => {
    fetchHospitals();
    fetchRegistryStats();
  };

  useEffect(() => {
    fetchHospitals();
  }, [userLocation, topN, selectedSpecialty, pmjayOnly, emergencyOnly]);

  const normalizeBooleanValue = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const cleaned = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 't'].includes(cleaned);
    }
    return false;
  };

  const normalizedSpecialty = selectedSpecialty ? selectedSpecialty.trim() : '';

  const displayedHospitals = useMemo(() => {
    const hospitalList = Array.isArray(hospitals) ? hospitals : [];
    if (!hospitalList.length) return [];

    const textSearch = searchQuery.trim().toLowerCase();

    let filtered = hospitalList;
    if (textSearch) {
      filtered = filtered.filter((hospital) => {
        const hospitalName = String(hospital?.hospital_name || '');
        const address = String(hospital?.address || hospital?.location || '');
        const specialties = String(hospital?.specialties || '');

        return [hospitalName, address, specialties].some((value) => value.toLowerCase().includes(textSearch));
      });
    }

    if (normalizedSpecialty && normalizedSpecialty.toLowerCase() !== 'all') {
      filtered = filtered.filter((hospital) => {
        const specialties = String(hospital?.specialties || '');
        return specialties.toLowerCase().includes(normalizedSpecialty.toLowerCase());
      });
    }

    if (emergencyOnly) {
      filtered = filtered.filter((hospital) => {
        const emergencyReady = normalizeBooleanValue(hospital?.emergency_ready);
        const emergencyFlag = normalizeBooleanValue(hospital?.emergency_24x7);
        const emergencyBeds = Number(hospital?.emergency_available_beds || 0);
        return emergencyReady || emergencyFlag || emergencyBeds > 0;
      });
    }

    if (pmjayOnly) {
      filtered = filtered.filter((hospital) => {
        const active = normalizeBooleanValue(hospital?.pmjay_active);
        const empanelled = normalizeBooleanValue(hospital?.pmjay_gjay_empanelled);
        return active || empanelled;
      });
    }

    const hasTextSearch = Boolean(textSearch);
    const hasLiveFilter = Boolean(normalizedSpecialty && normalizedSpecialty.toLowerCase() !== 'all') || emergencyOnly || pmjayOnly;
    if (!hasTextSearch && hasLiveFilter && filtered.length === 0 && hospitalList.length > 0) {
      return hospitalList;
    }

    return filtered;
  }, [hospitals, searchQuery, normalizedSpecialty, emergencyOnly, pmjayOnly]);

  const topNSortedHospitals = useMemo(
    () => sortHospitals(displayedHospitals, topNSortKey, topNSortDirection),
    [displayedHospitals, topNSortKey, topNSortDirection]
  );
  const topNCount = Number(topN) || 10;
  const topNHospitalIds = useMemo(
    () => new Set(topNSortedHospitals.slice(0, topNCount).map((hospital) => hospital.hospital_id)),
    [topNSortedHospitals, topNCount]
  );
  const orderedHospitals = useMemo(
    () => topNSortedHospitals.map((hospital, index) => ({
      ...hospital,
      selection_rank: index + 1,
      is_in_top_n: topNHospitalIds.has(hospital.hospital_id)
    })),
    [topNSortedHospitals, topNHospitalIds]
  );
  const visibleHospitals = filterCardsToTopN
    ? orderedHospitals.slice(0, topNCount)
    : orderedHospitals;
  const mapHospitals = visibleHospitals.length
    ? visibleHospitals
    : displayedHospitals.length
      ? orderedHospitals
      : hospitals;

  useEffect(() => {
    setSelectedHospital(orderedHospitals[0] || null);
  }, [topNSortKey, topNSortDirection, orderedHospitals]);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDarkMode ? 'bg-[#0B1220] text-[#F4F1EC]' : 'bg-[#F4EDE5] text-[#292929]'
    }`}>
      {/* Top Header Navbar */}
      <Navbar
        user={user}
        registryStats={registryStats}
        onRequireAuth={() => setShowAuthModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
        userLocation={userLocation}
        onOpenLocationModal={() => setShowLocationModal(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onToggleSidebar={() => setSidebarOpen(true)}
        activeHoldPass={activeHoldPass}
        onViewActiveHold={() => setActiveTab('hold_pass')}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Collapsible Left Navigation Dashboard */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userLocation={userLocation}
        onOpenLocationModal={() => setShowLocationModal(true)}
        onOpenDeskPortal={() => setShowDeskPortal(true)}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
        {/* VIEW 1: THE TWO-URGENCY GATEWAY */}
        {activeTab === 'gateway' && (
          <div className="space-y-6 sm:space-y-8 py-2 sm:py-4 animate-fadeIn">
            {/* Live Triage Origin Bar */}
            <div className={`rounded-3xl p-4 sm:p-5 border flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto shadow-sm transition ${
              userLocation.isLiveGPS 
                ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-[#EDF8F2] border-emerald-300')
                : (isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]')
            }`}>
              <div className="flex items-center space-x-3.5 w-full sm:w-auto">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  userLocation.isLiveGPS ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  <IconMapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                    <span className={isDarkMode ? 'text-stone-400' : 'text-stone-500'}>Finding hospitals near:</span>
                    <span className={`font-black ${userLocation.isLiveGPS ? 'text-emerald-500' : 'text-blue-600'}`}>
                      {userLocation.isLiveGPS ? 'Your current location' : userLocation.name}
                    </span>
                    {userLocation.isLiveGPS && (
                      <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Using GPS
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Hospital distances are estimated from this location
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowLocationModal(true)}
                className={`text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border transition shadow-sm shrink-0 w-full sm:w-auto text-center ${
                  isDarkMode 
                    ? 'bg-[#1E2B40] border-[#334155] text-blue-300 hover:bg-[#293950]' 
                    : 'bg-slate-50 border-[#CBD5E1] text-blue-800 hover:bg-slate-100'
                }`}
              >
                Change Location / GPS &rarr;
              </button>
            </div>

            {/* Clear, High-Contrast Section Title */}
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight ${
                isDarkMode ? 'text-white' : 'text-[#1C1917]'
              }`}>
                WHICH TYPE OF BED DO YOU NEED?
              </h1>
              <p className={`text-sm sm:text-base font-semibold ${
                isDarkMode ? 'text-[#A1A1AA]' : 'text-stone-600'
              }`}>
                Select the appropriate urgency level to navigate the allocation workflow
              </p>
            </div>

            {/* Senior-Friendly Readable Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto items-stretch">
              {/* Card A: Emergency Care */}
              <div className={`rounded-3xl border-2 p-6 sm:p-8 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all border-t-8 border-t-red-600 ${
                isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
              }`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-red-600 bg-red-500/10 px-3 py-1 rounded-full uppercase">
                      IMMEDIATE CARE
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-red-500 font-mono">30-Min Lock</span>
                  </div>

                  <div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${
                      isDarkMode ? 'text-white' : 'text-[#1C1917]'
                    }`}>
                      EMERGENCY
                    </h2>
                    {/* Senior-Friendly Readable Paragraph */}
                    <p className={`text-sm sm:text-base font-medium mt-2 leading-relaxed ${
                      isDarkMode ? 'text-[#D1D5DB]' : 'text-stone-700'
                    }`}>
                      For acute trauma, heart attacks, stroke, accidents, severe bleeding, or critical ICU care. Real-time proximity matching from your exact coordinates.
                    </p>
                  </div>

                  {/* Accessible Checklist */}
                  <ul className={`space-y-3.5 pt-4 border-t ${
                    isDarkMode ? 'border-[#2E2F34] text-[#F3F4F6]' : 'border-stone-100 text-stone-800'
                  }`}>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Live 21 Hospital Proximity & Available ER Beds</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>6-Digit Instant Patient OTP Verification</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>30-Minute Guaranteed Bed Hold Timer</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Direct Hospital Emergency Desk Phone & Tap-to-Call</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setEmergencyOnly(true);
                    setActiveTab('explore');
                  }}
                  className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-black text-base sm:text-lg py-3.5 sm:py-4 px-6 rounded-2xl shadow-lg shadow-red-500/20 transition flex items-center justify-center gap-2"
                >
                  <span>Enter Emergency Flow</span>
                  <IconArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Card B: General Admission Ward Visualizer */}
              <div className={`rounded-3xl border-2 p-6 sm:p-8 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all border-t-8 border-t-emerald-600 ${
                isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
              }`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full uppercase">
                      ELECTIVE & SPECIALTY
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-500 font-mono">Ward Visualizer</span>
                  </div>

                  <div>
                    <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${
                      isDarkMode ? 'text-white' : 'text-[#1C1917]'
                    }`}>
                      GENERAL ADMISSION
                    </h2>
                    {/* Senior-Friendly Readable Paragraph */}
                    <p className={`text-sm sm:text-base font-medium mt-2 leading-relaxed ${
                      isDarkMode ? 'text-[#D1D5DB]' : 'text-stone-700'
                    }`}>
                      For planned clinical specialties (Cardiology, Orthopedics, Neurology, Pediatrics, General Medicine) with interactive ward bed grids.
                    </p>
                  </div>

                  {/* Accessible Checklist */}
                  <ul className={`space-y-3.5 pt-4 border-t ${
                    isDarkMode ? 'border-[#2E2F34] text-[#F3F4F6]' : 'border-stone-100 text-stone-800'
                  }`}>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>5-Step Admission Progress Navigation</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Visual Departmental Ward & Unit Selection (Male/Female/HDU)</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Patient Intake & PMJAY Cashless Validation</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm sm:text-base font-semibold leading-normal">
                      <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>30-Minute Hold Reservation & Printable Pass</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleGeneralWardRequest(selectedHospital)}
                  className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base sm:text-lg py-3.5 sm:py-4 px-6 rounded-2xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  <span>Enter General Admission Flow</span>
                  <IconArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: 5-STEP GENERAL ADMISSION WARD VISUALIZER */}
        {activeTab === 'general_flow' && (
          <GeneralAdmissionFlow
            hospitals={hospitals}
            selectedHospital={selectedHospital}
            onSelectHospital={setSelectedHospital}
            specialties={specialtiesList}
            user={user}
            onRequireAuth={() => setShowAuthModal(true)}
            isDarkMode={isDarkMode}
            onCompleteHold={(holdInfo) => {
              if (!user) {
                setShowAuthModal(true);
                return;
              }
              recordHoldUpdate(holdInfo);
              fetchHospitals();
              setActiveTab('hold_pass');
            }}
            onCancel={() => setActiveTab('gateway')}
          />
        )}

        {/* VIEW 3: ACTIVE 30-MINUTE HOLD PASS SCREEN */}
        {activeTab === 'hold_pass' && activeHoldPass && (
          <HoldPassView
            holdData={activeHoldPass}
            onOpenInNewTab={() => {
              const passUrl = new URL(window.location.href);
              passUrl.searchParams.set('hold_id', activeHoldPass.request_id);
              window.open(passUrl.toString(), '_blank', 'noopener,noreferrer');
            }}
            onReset={() => {
              setActiveHoldPass(latestActiveHold(holdLedger));
              setHoldPassError('');
              setActiveTab('explore');
            }}
            onHoldUpdate={(holdInfo) => {
              recordHoldUpdate(holdInfo);
              refreshBedInventory();
            }}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'hold_pass' && !activeHoldPass && (
          <div className={`max-w-xl mx-auto rounded-2xl border p-6 text-center ${
            isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
          }`}>
            {holdPassLoading ? (
              <p role="status">Loading bed-hold pass…</p>
            ) : (
              <>
                <p role="alert" className="font-semibold text-red-600">
                  {holdPassError || 'This bed-hold pass is unavailable.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const portalUrl = new URL(window.location.href);
                    portalUrl.searchParams.delete('hold_id');
                    window.history.replaceState({}, '', `${portalUrl.pathname}${portalUrl.search}${portalUrl.hash}`);
                    setActiveTab('explore');
                  }}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  Return to Portal
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="space-y-6">
            <div className={`p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between ${
              isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
            }`}>
              <div className="relative flex-1 w-full">
                <IconSearch className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search hospital name, area, or specialty..."
                  className={`w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode ? 'bg-[#0B1220] border-[#334155] text-white placeholder-stone-400' : 'bg-[#F8FAFC] border-[#CBD5E1] text-slate-900'
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setEmergencyOnly(!emergencyOnly)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition ${
                    emergencyOnly 
                      ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                      : isDarkMode 
                      ? 'bg-[#28282B] border-[#38383E] text-stone-300' 
                      : 'bg-[#F1F5F9] border-[#CBD5E1] text-slate-700'
                  }`}
                >
                  24x7 Emergency
                </button>
                <button
                  onClick={() => setPmjayOnly(!pmjayOnly)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition ${
                    pmjayOnly 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                      : isDarkMode 
                      ? 'bg-[#28282B] border-[#38383E] text-stone-300' 
                      : 'bg-[#F1F5F9] border-[#CBD5E1] text-slate-700'
                  }`}
                >
                  PM-JAY Empanelled
                </button>
              </div>
            </div>

            <TopNSlider topN={topN} setTopN={handleTopNChange} totalCount={hospitals.length} isDarkMode={isDarkMode} />
            <TopNSortControls
              sortKey={topNSortKey}
              direction={topNSortDirection}
              onSortKeyChange={handleTopNSortKeyChange}
              onDirectionToggle={() => setTopNSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')}
              isDarkMode={isDarkMode}
            />

            <div className="space-y-6">
              <section className={`relative z-0 isolate mx-auto w-[94%] p-3 rounded-2xl border shadow-sm space-y-2 ${
                isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
              }`}>
                <div className={`flex items-center justify-between px-2 pt-1 text-xs font-bold ${
                  isDarkMode ? 'text-white' : 'text-[#1C1917]'
                }`}>
                  <span>Interactive Map (Bhubaneswar)</span>
                  <span className="text-blue-500 truncate max-w-[60%] text-right">
                    {selectedHospital
                      ? `${selectedHospital.is_in_top_n ? `Top N pick #${selectedHospital.selection_rank} · ` : ''}Score rank #${selectedHospital.rank} · ${selectedHospital.hospital_name}`
                      : ''}
                  </span>
                </div>
                <div className="h-[340px] sm:h-[480px]">
                  <MapComponent
                    hospitals={mapHospitals}
                    userLocation={userLocation}
                    selectedHospital={selectedHospital}
                    onSelectHospital={h => setSelectedHospital(h)}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <div className={`flex flex-wrap items-center gap-3 text-xs px-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span>
                    Showing <b>{visibleHospitals.length}</b> of all <b>{hospitals.length || displayedHospitals.length || 0}</b> hospitals relative to <b>{userLocation.name}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterCardsToTopN(!filterCardsToTopN)}
                    className={`ml-auto shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl border transition shadow-sm ${
                      isDarkMode
                        ? 'border-blue-800 bg-blue-950/50 text-blue-300 hover:bg-blue-900/60'
                        : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    {filterCardsToTopN ? `Show All ${hospitals.length || displayedHospitals.length || 0} Hospitals` : `Filter to Top ${topN} Only`}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {visibleHospitals.map(hospital => (
                    <HospitalCard
                      key={hospital.hospital_id}
                      hospital={hospital}
                      isSelected={selectedHospital?.hospital_id === hospital.hospital_id}
                      onSelect={() => setSelectedHospital(hospital)}
                      onRequestEmergency={h => {
                        if (!user) setShowAuthModal(true);
                        else setEmergencyModalHospital(h);
                      }}
                      onRequestGeneralWard={handleGeneralWardRequest}
                      onViewOnMap={h => {
                        setSelectedHospital(h);
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* VIEW 5: COMPARISON TABLE MATRIX */}
        {activeTab === 'table' && (
          <ComparisonTable
            hospitals={displayedHospitals}
            topN={topN}
            onSelectHospital={h => setSelectedHospital(h)}
            selectedHospital={selectedHospital}
            onRequestEmergency={h => {
              if (!user) setShowAuthModal(true);
              else setEmergencyModalHospital(h);
            }}
            onRequestGeneralWard={handleGeneralWardRequest}
            isDarkMode={isDarkMode}
          />
        )}
      </main>
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onUpdateUser={handleUpdateUser}
        onLogout={handleLogout}
        activeHoldData={activeHoldPass}
        holdLedger={holdLedger}
        isDarkMode={isDarkMode}
      />

      <ChatbotDrawer isDarkMode={isDarkMode} />

      {showLocationModal && (
        <LocationSelectorModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          currentLocation={userLocation}
          onSelectLocation={(loc) => setUserLocation(loc)}
          localities={localities}
          isDarkMode={isDarkMode}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
          isDarkMode={isDarkMode}
        />
      )}

      {showDeskPortal && (
        <DeskPortalModal onClose={() => setShowDeskPortal(false)} isDarkMode={isDarkMode} />
      )}

      {emergencyModalHospital && (
        <EmergencyFlowModal
          hospital={emergencyModalHospital}
          onClose={() => setEmergencyModalHospital(null)}
          onCompleteHold={(holdInfo) => {
            if (!user) {
              setShowAuthModal(true);
              return;
            }
            recordHoldUpdate(holdInfo);
            refreshBedInventory();
            setEmergencyModalHospital(null);
            setActiveTab('hold_pass');
          }}
          user={user}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
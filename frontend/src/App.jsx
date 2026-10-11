import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import TopNSlider from './components/TopNSlider';
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
import SplashScreen from './components/SplashScreen';
import { IconAlert, IconBed, IconShield, IconSearch, IconCheck, IconArrowRight, IconMapPin, IconPhone, IconClock } from './components/Icons';

const latestActiveHold = (ledger) => [...ledger].reverse().find((hold) => hold.status === 'HELD') || null;

function HospitalApp() {
  useEffect(() => {
    const handleReset = () => {
      setActiveHoldPass(null);
      setActiveTab("explore");
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
  const [specialtiesList, setSpecialtiesList] = useState([]);
  const [topN, setTopN] = useState(10);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [pmjayOnly, setPmjayOnly] = useState(false);
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('gateway');
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalSort, setHospitalSort] = useState('near');

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeskPortal, setShowDeskPortal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [emergencyModalHospital, setEmergencyModalHospital] = useState(null);
  const [holdLedger, setHoldLedger] = useState([]);
  const [activeHoldPass, setActiveHoldPass] = useState(null);
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
        if (!cancelled) console.error('Could not load signed-in account data:', error);
      }
    };
    loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

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
      return refreshedCurrent?.status === 'HELD' ? refreshedCurrent : latestActiveHold(holdLedger);
    });
  }, [holdLedger]);

  const [filterCardsToTopN, setFilterCardsToTopN] = useState(true);
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

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        const localitiesList = Array.isArray(data?.localities) ? data.localities : [];
        if (localitiesList.length) setLocalities(localitiesList);
      })
      .catch(err => console.error(err));

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

  const sortedHospitals = useMemo(() => {
    const sorted = [...displayedHospitals];
    if (hospitalSort === 'beds') {
      sorted.sort((a, b) => Number(b.general_ward_available_beds || 0) - Number(a.general_ward_available_beds || 0));
    } else if (hospitalSort === 'recommended') {
      sorted.sort((a, b) => Number(a.rank || Number.MAX_SAFE_INTEGER) - Number(b.rank || Number.MAX_SAFE_INTEGER));
    } else {
      sorted.sort((a, b) => Number(a.road_distance_km ?? a.distance_km ?? Number.MAX_SAFE_INTEGER) -
        Number(b.road_distance_km ?? b.distance_km ?? Number.MAX_SAFE_INTEGER));
    }
    return sorted;
  }, [displayedHospitals, hospitalSort]);
  const visibleHospitals = filterCardsToTopN ? sortedHospitals.slice(0, Number(topN) || 10) : sortedHospitals;
  const mapHospitals = visibleHospitals.length ? visibleHospitals : displayedHospitals.length ? displayedHospitals : hospitals;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDarkMode ? 'bg-[#0A1B22] text-[#E8F3F6]' : 'bg-[#E6F4F6] text-[#0F2233]'
    }`}>
      {/* Top Header Navbar */}
      <Navbar
        user={user}
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
                    <span className={isDarkMode ? 'text-stone-400' : 'text-stone-500'}>Triage Location:</span>
                    <span className={`font-black ${userLocation.isLiveGPS ? 'text-emerald-500' : 'text-blue-600'}`}>
                      {userLocation.name}
                    </span>
                    {userLocation.isLiveGPS && (
                      <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        GPS Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-mono">
                    {userLocation.lat.toFixed(4)} N, {userLocation.lon.toFixed(4)} E &bull; Calculating nearest road distance
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

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              <section className={`flex flex-col rounded-[22px] border p-5 sm:p-6 ${
                isDarkMode ? 'bg-[#12303D] border-[#245160]' : 'bg-white border-[#D7E5E8]'
              }`} aria-labelledby="emergency-beds-heading">
                <div className="flex items-start justify-between">
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
                    <IconAlert className="h-7 w-7" />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-extrabold tracking-wider text-red-700 dark:text-red-300">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                    HIGH PRIORITY
                  </span>
                </div>
                <h2 id="emergency-beds-heading" className={`mt-3 text-[21px] font-black leading-tight ${
                  isDarkMode ? 'text-white' : 'text-[#123B50]'
                }`}>
                  Emergency Beds
                </h2>
                <p className={`mt-3 text-sm ${
                  isDarkMode ? 'text-[#A8C1CB]' : 'text-[#4E6B79]'
                }`}>
                  Urgent care, trauma and critical medical needs.
                </p>
                <div className={`my-4 flex items-center gap-2 text-[13px] font-bold ${
                  isDarkMode ? 'text-[#EAF4F7]' : 'text-[#123B50]'
                }`}>
                  <IconAlert className="h-[18px] w-[18px] shrink-0 text-red-600" />
                  Emergency / urgent care
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmergencyOnly(true);
                    setActiveTab('explore');
                  }}
                  className="flex min-h-[52px] w-full items-center justify-between rounded-[14px] bg-red-600 px-4 text-left text-base font-bold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                >
                  Find Emergency Beds
                  <IconArrowRight className="h-5 w-5 shrink-0" />
                </button>
              </section>

              <section className={`flex flex-col rounded-[22px] border p-5 sm:p-6 ${
                isDarkMode ? 'bg-[#12303D] border-[#245160]' : 'bg-white border-[#D7E5E8]'
              }`} aria-labelledby="general-beds-heading">
                <div className="flex items-start justify-between">
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <IconBed className="h-7 w-7" />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold tracking-wider text-emerald-700 dark:text-emerald-300">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                    PLANNED CARE
                  </span>
                </div>
                <h2 id="general-beds-heading" className={`mt-3 text-[21px] font-black leading-tight ${
                  isDarkMode ? 'text-white' : 'text-[#123B50]'
                }`}>
                  General Beds
                </h2>
                <p className={`mt-3 text-sm ${
                  isDarkMode ? 'text-[#A8C1CB]' : 'text-[#4E6B79]'
                }`}>
                  General wards and non-emergency specialties.
                </p>
                <div className={`my-4 flex items-center gap-2 text-[13px] font-bold ${
                  isDarkMode ? 'text-[#EAF4F7]' : 'text-[#123B50]'
                }`}>
                  <IconClock className="h-[18px] w-[18px] shrink-0 text-emerald-600" />
                  Planned admission
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('general_flow')}
                  className="mt-auto flex min-h-[52px] w-full items-center justify-between rounded-[14px] bg-emerald-700 px-4 text-left text-base font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                >
                  Find General Beds
                  <IconArrowRight className="h-5 w-5 shrink-0" />
                </button>
              </section>
            </div>

            <p className={`mx-auto flex max-w-4xl items-center gap-2 px-1 text-sm ${
              isDarkMode ? 'text-[#A8C1CB]' : 'text-[#4E6B79]'
            }`}>
              <IconShield className="h-5 w-5 shrink-0 text-emerald-600" />
              Bed availability can change. Please confirm with the hospital before travelling.
            </p>

            <a
              href="tel:112"
              className={`mx-auto flex min-h-16 max-w-4xl items-center gap-3 rounded-2xl border p-3 no-underline transition hover:shadow-sm ${
                isDarkMode
                  ? 'border-red-900/60 bg-red-950/30 text-white'
                  : 'border-red-200 bg-red-50 text-[#123B50]'
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <IconPhone className="h-5 w-5" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold">Need urgent help?</span>
                <span className={`block text-xs ${
                  isDarkMode ? 'text-[#A8C1CB]' : 'text-[#4E6B79]'
                }`}>
                  Call emergency services <strong className="text-red-700 dark:text-red-300">112</strong>
                </span>
              </span>
              <IconArrowRight className="ml-auto h-5 w-5 shrink-0 text-red-600" />
            </a>
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
              setHospitals(prev => prev.map(h => {
                if (h.hospital_id === holdInfo.hospital_id) {
                  const updatedBeds = Math.max(0, (h.general_ward_available_beds || 1) - 1);
                  const total = h.general_ward_total_beds || 100;
                  return {
                    ...h,
                    general_ward_available_beds: updatedBeds,
                    general_ward_vacancy_pct: Math.round((updatedBeds / total) * 1000) / 10
                  };
                }
                return h;
              }));
              setActiveTab('hold_pass');
            }}
            onBack={() => setActiveTab('gateway')}
          />
        )}

        {/* VIEW 3: ACTIVE 30-MINUTE HOLD PASS SCREEN */}
        {activeTab === 'hold_pass' && activeHoldPass && (
          <HoldPassView
            holdData={activeHoldPass}
            onReset={() => {
              setActiveHoldPass(null);
              setActiveTab('explore');
            }}
            onHoldUpdate={recordHoldUpdate}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'explore' && (
          <div className="space-y-6">
            <section className={`rounded-2xl border p-4 shadow-sm ${
              isDarkMode ? 'bg-[#112B36] border-[#24505E]' : 'bg-white border-[#DCE6EA]'
            }`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`text-xs font-extrabold uppercase tracking-wider ${
                  isDarkMode ? 'text-teal-300' : 'text-teal-800'
                }`}>
                  Origin
                </span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  userLocation.isLiveGPS
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : isDarkMode
                    ? 'bg-[#0A1B22] text-slate-200'
                    : 'bg-[#E6F4F6] text-[#0F2233]'
                }`}>
                  {userLocation.name}
                </span>
                <span className={`hidden sm:inline text-xs ${
                  isDarkMode ? 'text-[#A3BBC5]' : 'text-[#5B6B7A]'
                }`}>
                  {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className={`ml-auto min-h-10 rounded-xl border px-3 text-xs font-bold transition ${
                    isDarkMode
                      ? 'border-[#24505E] bg-[#0A1B22] text-teal-200 hover:bg-[#173845]'
                      : 'border-[#DCE6EA] bg-[#F5F8FA] text-teal-800 hover:bg-[#E6F4F6]'
                  }`}
                >
                  Change location
                </button>
              </div>
            </section>

            <div className={`p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between ${
              isDarkMode ? 'bg-[#112B36] border-[#24505E]' : 'bg-white border-[#DCE6EA]'
            }`}>
              <div className="relative flex-1 w-full">
                <IconSearch className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search hospital name, area, or specialty..."
                  className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-600 ${
                    isDarkMode ? 'bg-[#0A1B22] border-[#24505E] text-white placeholder-stone-400' : 'bg-[#F5F8FA] border-[#DCE6EA] text-slate-900'
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
                        ? 'bg-[#0A1B22] border-[#24505E] text-stone-300'
                        : 'bg-[#F5F8FA] border-[#DCE6EA] text-slate-700'
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
                        ? 'bg-[#0A1B22] border-[#24505E] text-stone-300'
                        : 'bg-[#F5F8FA] border-[#DCE6EA] text-slate-700'
                  }`}
                >
                  PM-JAY Empanelled
                </button>
              </div>
            </div>

            {specialtiesList.length > 0 && (
              <section className={`rounded-2xl border px-4 py-3 ${
                isDarkMode ? 'bg-[#112B36] border-[#24505E]' : 'bg-white border-[#DCE6EA]'
              }`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`mr-1 text-xs font-extrabold uppercase tracking-wider ${
                    isDarkMode ? 'text-red-300' : 'text-red-700'
                  }`}>
                    Fast specialty filters
                  </span>
                  {specialtiesList.slice(0, 5).map((specialty) => (
                    <button
                      key={specialty}
                      type="button"
                      aria-pressed={selectedSpecialty === specialty}
                      onClick={() => setSelectedSpecialty(selectedSpecialty === specialty ? '' : specialty)}
                      className={`min-h-10 rounded-full border px-3 text-xs font-bold transition ${
                        selectedSpecialty === specialty
                          ? 'border-teal-700 bg-teal-700 text-white'
                          : isDarkMode
                          ? 'border-[#24505E] bg-[#0A1B22] text-slate-200 hover:bg-[#173845]'
                          : 'border-[#DCE6EA] bg-[#F5F8FA] text-[#0F2233] hover:bg-[#E6F4F6]'
                      }`}
                    >
                      {specialty}
                    </button>
                  ))}
                  {selectedSpecialty && (
                    <button
                      type="button"
                      onClick={() => setSelectedSpecialty('')}
                      className={`min-h-10 rounded-full px-3 text-xs font-bold underline underline-offset-2 ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </section>
            )}

            <TopNSlider topN={topN} setTopN={handleTopNChange} totalCount={hospitals.length} isDarkMode={isDarkMode} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-4">
                <div className={`flex items-center justify-between text-xs px-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <span className="text-sm">
                      Showing <b>{visibleHospitals.length}</b> of <b>{displayedHospitals.length}</b> nearby hospitals
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilterCardsToTopN(!filterCardsToTopN)}
                      className={`text-xs font-bold px-3 py-1 rounded-xl border transition shadow-sm ${
                        isDarkMode
                          ? 'border-blue-800 bg-blue-950/50 text-blue-300 hover:bg-blue-900/60'
                          : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                      }`}
                    >
                      {filterCardsToTopN ? `Show all ${displayedHospitals.length}` : `Show top ${topN}`}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`inline-flex gap-1 rounded-xl p-1 ${
                        isDarkMode ? 'bg-[#112B36]' : 'bg-[#DCE6EA]'
                      }`} role="group" aria-label="Type of care">
                        <button
                          type="button"
                          aria-pressed={emergencyOnly}
                          onClick={() => setEmergencyOnly(true)}
                          className={`min-h-10 rounded-lg px-3 text-xs font-extrabold ${
                            emergencyOnly
                              ? isDarkMode ? 'bg-[#1C3945] text-red-300 shadow-sm' : 'bg-white text-red-700 shadow-sm'
                              : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                          }`}
                        >
                          Emergency
                        </button>
                        <button
                          type="button"
                          aria-pressed={!emergencyOnly}
                          onClick={() => setEmergencyOnly(false)}
                          className={`min-h-10 rounded-lg px-3 text-xs font-extrabold ${
                            !emergencyOnly
                              ? isDarkMode ? 'bg-[#1C3945] text-teal-300 shadow-sm' : 'bg-white text-teal-800 shadow-sm'
                              : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                          }`}
                        >
                          General
                        </button>
                      </div>
                      <label className="flex items-center gap-2 font-semibold">
                        <span>Sorted by</span>
                        <select
                          value={hospitalSort}
                          onChange={(event) => setHospitalSort(event.target.value)}
                          className={`min-h-10 rounded-xl border px-2 text-xs ${
                            isDarkMode ? 'border-[#24505E] bg-[#112B36] text-white' : 'border-[#DCE6EA] bg-white text-[#0F2233]'
                          }`}
                        >
                          <option value="near">Nearest first</option>
                          <option value="recommended">Recommended order</option>
                          <option value="beds">Most beds free</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  {loading && (
                    <p role="status" className={`col-span-full rounded-2xl border p-5 text-center text-sm font-semibold ${
                      isDarkMode ? 'border-[#24505E] bg-[#112B36] text-slate-200' : 'border-[#DCE6EA] bg-white text-[#5B6B7A]'
                    }`}>
                      Checking nearby hospitals…
                    </p>
                  )}
                  {!loading && visibleHospitals.length === 0 && (
                    <p role="status" className={`col-span-full rounded-2xl border p-5 text-center text-sm font-semibold ${
                      isDarkMode ? 'border-[#24505E] bg-[#112B36] text-slate-200' : 'border-[#DCE6EA] bg-white text-[#5B6B7A]'
                    }`}>
                      No hospitals match those filters. Try a different search or clear a filter.
                    </p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 sticky top-20 sm:top-24">
                <div className={`p-3 rounded-2xl border shadow-sm space-y-2 ${
                  isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
                }`}>
                  <div className={`flex items-center justify-between px-2 pt-1 text-xs font-bold ${
                    isDarkMode ? 'text-white' : 'text-[#1C1917]'
                  }`}>
                    <span>Interactive Map (Bhubaneswar)</span>
                    <span className="text-blue-500 truncate max-w-[180px]">
                      {selectedHospital ? `#${selectedHospital.rank} ${selectedHospital.hospital_name}` : ''}
                    </span>
                  </div>
                  <div className="h-[340px] sm:h-[480px]">
                    <MapComponent hospitals={mapHospitals}
                      userLocation={userLocation}
                      selectedHospital={selectedHospital}
                      onSelectHospital={h => setSelectedHospital(h)}
                    />
                  </div>
                </div>
              </div>
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

export default function App() {
  const [splashComplete, setSplashComplete] = useState(false);

  if (!splashComplete) {
    return <SplashScreen onReady={() => setSplashComplete(true)} />;
  }

  return <HospitalApp />;
}
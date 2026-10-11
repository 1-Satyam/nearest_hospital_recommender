import React, { useState, useEffect } from 'react';
import { IconCross, IconBed, IconCheck, IconShield, IconClock } from './Icons';

export default function GeneralAdmissionFlow({
  hospitals = [],
  selectedHospital: initialHospital,
  onSelectHospital,
  onCompleteHold,
  onBack,
  user,
  onRequireAuth,
  isDarkMode
}) {
  const [activeHospital, setActiveHospital] = useState(initialHospital || hospitals[0] || null);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedBed, setSelectedBed] = useState(null);
  const [step, setStep] = useState(1); // 1: Bed Grid, 2: Patient Intake, 3: OTP
  const [patientName, setPatientName] = useState(user?.name || '');
  const [contactMobile, setContactMobile] = useState(user?.mobile || '');
  const [age, setAge] = useState('45');
  const [gender, setGender] = useState('Male');
  const [bskyCard, setBskyCard] = useState(user?.pmjay_card_number || '');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [devOtp, setDevOtp] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unitStatuses, setUnitStatuses] = useState({});
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitLoadError, setUnitLoadError] = useState('');
  const [unitsNow, setUnitsNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;
    setPatientName(user.name || '');
    setContactMobile(user.mobile || '');
    setBskyCard(user.pmjay_card_number || '');
  }, [user]);

  // Clean parser for clinical specialties (splits by comma and cleans names)
  const parseSpecialties = (specsStr) => {
    if (!specsStr) return ['General Medicine', 'Nephrology', 'Paediatrics', 'Obstetrics & Gynaecology', 'Orthopaedics'];
    const cleaned = specsStr.replace(/;/g, ',');
    const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    const result = [];
    let i = 0;
    while (i < parts.length) {
      const cur = parts[i];
      if (cur.toLowerCase() === 'obstetrics' && i + 1 < parts.length && parts[i + 1].toLowerCase().includes('gynaecol')) {
        result.push('Obstetrics & Gynaecology');
        i += 2;
      } else {
        result.push(cur);
        i += 1;
      }
    }
    return result.length > 0 ? result : ['General Medicine', 'Nephrology', 'Paediatrics', 'Orthopaedics'];
  };

  const specsList = parseSpecialties(activeHospital?.specialties);

  useEffect(() => {
    if (initialHospital) {
      setActiveHospital(initialHospital);
    } else if (hospitals.length > 0 && !activeHospital) {
      setActiveHospital(hospitals[0]);
    }
  }, [initialHospital, hospitals]);

  useEffect(() => {
    if (specsList.length > 0) {
      setSelectedSpecialty(specsList[0]);
    } else {
      setSelectedSpecialty('General Medicine');
    }
    setSelectedBed(null);
    setStep(1);
    setErrorMsg('');
  }, [activeHospital]);

  useEffect(() => {
    if (!activeHospital?.hospital_id || !selectedSpecialty) return undefined;
    const controller = new AbortController();
    setUnitsLoading(true);
    setUnitLoadError('');
    setUnitStatuses({});

    const loadUnits = async () => {
      try {
        const response = await fetch(
          `/api/requests/units/${encodeURIComponent(activeHospital.hospital_id)}/${encodeURIComponent(selectedSpecialty)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Could not load live bed availability.');
        const statuses = Object.fromEntries((data.units || []).map((unit) => [unit.unit_id, unit]));
        setUnitStatuses(statuses);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setUnitLoadError(error.message || 'Could not load live bed availability.');
        }
      } finally {
        if (!controller.signal.aborted) setUnitsLoading(false);
      }
    };

    loadUnits();
    return () => controller.abort();
  }, [activeHospital?.hospital_id, selectedSpecialty]);

  useEffect(() => {
    if (!Object.values(unitStatuses).some((unit) => unit.status === '30_MIN_HOLD')) return undefined;
    const timer = window.setInterval(() => setUnitsNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [unitStatuses]);

  const handleSpecialtyChange = (spec) => {
    setSelectedSpecialty(spec);
    setSelectedBed(null); // Resets bed on department change
    setErrorMsg('');
  };

  const getPrefix = (dept) => {
    const clean = (dept || 'GENE').toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.includes('ORTH')) return 'ORTH';
    if (clean.includes('PEDI') || clean.includes('PAED')) return 'PEDI';
    if (clean.includes('NEPH')) return 'NEPH';
    if (clean.includes('OBST') || clean.includes('GYNA')) return 'OBGY';
    if (clean.includes('CARD')) return 'CARD';
    return clean.slice(0, 4).padEnd(4, 'X');
  };

  const prefix = getPrefix(selectedSpecialty);

  // Strictly 4 clean, isolated rows for the active department with unique gender IDs
  const bedRows = [
    {
      category: 'General Ward (Male)',
      type: 'General',
      gender: 'Male',
      price: (activeHospital?.admission_fee_inr === 0) ? 'Free' : `INR ${activeHospital?.admission_fee_inr || 0}`,
      beds: [
        { code: `${prefix}-GEN-01`, id: `${prefix}-GEN-M-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-GEN-02`, id: `${prefix}-GEN-M-02`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-GEN-03`, id: `${prefix}-GEN-M-03`, o2: true, vent: false, occupied: true },
        { code: `${prefix}-GEN-04`, id: `${prefix}-GEN-M-04`, o2: true, vent: false, occupied: false }
      ]
    },
    {
      category: 'General Ward (Female)',
      type: 'General',
      gender: 'Female',
      price: (activeHospital?.admission_fee_inr === 0) ? 'Free' : `INR ${activeHospital?.admission_fee_inr || 0}`,
      beds: [
        { code: `${prefix}-GEN-01`, id: `${prefix}-GEN-F-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-GEN-02`, id: `${prefix}-GEN-F-02`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-GEN-03`, id: `${prefix}-GEN-F-03`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-GEN-04`, id: `${prefix}-GEN-F-04`, o2: true, vent: false, occupied: false }
      ]
    },
    {
      category: 'Semi-Private Cabin',
      type: 'Semi-Private',
      gender: 'Any',
      price: 'Rs. 400/d',
      beds: [
        { code: `${prefix}-SEM-01`, id: `${prefix}-SEM-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-SEM-02`, id: `${prefix}-SEM-02`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-SEM-03`, id: `${prefix}-SEM-03`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-SEM-04`, id: `${prefix}-SEM-04`, o2: true, vent: false, occupied: false }
      ]
    },
    {
      category: 'High Dependency Unit (HDU)',
      type: 'HDU',
      gender: 'Any',
      price: 'Rs. 800/d',
      beds: [
        { code: `${prefix}-HDU-01`, id: `${prefix}-HDU-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-HDU-02`, id: `${prefix}-HDU-02`, o2: true, vent: false, occupied: false }
      ]
    }
  ];

  const liveBedRows = bedRows.map((row) => ({
    ...row,
    beds: row.beds.map((bed) => {
      const liveStatus = unitStatuses[bed.id];
      return {
        ...bed,
        status: liveStatus?.status || (bed.occupied ? 'OCCUPIED' : 'AVAILABLE'),
        hold_expires_at: liveStatus?.hold_expires_at || null
      };
    })
  }));

  // TOGGLE UNSELECT: Clicking an active bed unselects it
  const handleBedSelect = (bed, row) => {
    if (unitsLoading || unitLoadError || bed.status !== 'AVAILABLE') return;

    if (selectedBed?.id === bed.id) {
      setSelectedBed(null); // UNSELECT!
      return;
    }

    setSelectedBed({
      id: bed.id,
      code: bed.code,
      category: row.category,
      gender: row.gender,
      price: row.price,
      specialty: selectedSpecialty
    });
  };

  const handleSendOtp = async () => {
    if (!user) {
      setErrorMsg('Sign in to securely associate this reservation with your account.');
      onRequireAuth?.();
      return;
    }
    if (!/^\d{10}$/.test(contactMobile)) {
      setErrorMsg('Enter a valid 10-digit mobile number.');
      return;
    }
    setRequestLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/requests/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_id: activeHospital.hospital_id,
          flow_type: 'GENERAL_WARD',
          specialty: selectedSpecialty,
          bed_type: selectedBed.category,
          bed_unit_id: selectedBed.id,
          patient_count: 1,
          patient_name: patientName,
          contact_mobile: contactMobile,
          age: Number(age) || 45,
          gender,
          pmjay_card_number: bskyCard || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not create the bed hold request.');

      setRequestId(data.request_id);
      setDevOtp(String(data.dev_otp || ''));
      setOtp('');
      setStep(3);
    } catch (error) {
      setErrorMsg(error.message || 'Could not send OTP.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleVerifyAndLock = async () => {
    if (!requestId) {
      setErrorMsg('Create an OTP request before verifying.');
      return;
    }
    setRequestLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/requests/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, otp_code: otp })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'OTP verification failed.');

      onCompleteHold({
        request_id: data.request_id,
        status: data.status || 'HELD',
        hospital_id: activeHospital.hospital_id,
        hospital_name: activeHospital.hospital_name,
        admission_fee_inr: activeHospital.admission_fee_inr,
        specialty: data.specialty || selectedSpecialty,
        bed_unit_id: data.bed_unit_id || selectedBed.id,
        bed_unique_id: selectedBed.id,
        doctor_incharge: data.doctor_incharge,
        desk_location: data.desk_location,
        hospital_desk_contact: data.hospital_desk_contact || activeHospital.contact_phone || '+91-674-2391983',
        patient_name: data.patient_name || patientName,
        contact_mobile: data.contact_mobile || contactMobile,
        directions_url: activeHospital.directions_url,
        flow_type: data.flow_type || 'GENERAL_WARD',
        hold_expires_at: data.hold_expires_at,
        remaining_seconds: data.remaining_seconds
      });
    } catch (error) {
      setErrorMsg(error.message || 'OTP verification failed.');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className={`max-w-5xl mx-auto rounded-3xl border shadow-xl overflow-hidden transition-colors ${
      isDarkMode ? 'bg-[#18181B] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
    }`}>
      {/* Top Header */}
      <div className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDarkMode ? 'bg-[#131315] border-[#2D2D34]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <IconBed className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {activeHospital?.hospital_name || 'Hospital Ward Visualizer'}
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-stone-400 mt-1">
            {activeHospital?.address} &bull; Live Bed Vacancy Matrix
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hospitals.length > 1 && (
            <select
              aria-label="Select hospital for bed availability"
              value={activeHospital?.hospital_id}
              onChange={(e) => {
                const found = hospitals.find(h => h.hospital_id === e.target.value);
                if (found) {
                  setActiveHospital(found);
                  if (onSelectHospital) onSelectHospital(found);
                }
              }}
              className={`text-xs font-black p-2.5 rounded-xl border ${
                isDarkMode ? 'bg-[#1E1E22] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              {hospitals.map(h => (
                <option key={h.hospital_id} value={h.hospital_id}>
                  #{h.rank} {h.hospital_name}
                </option>
              ))}
            </select>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-800 transition text-slate-700 dark:text-stone-300"
            >
              Exit Flow
            </button>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* STEP 1: Bed Selection Grid */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Department Selection Pills (Individual Buttons) */}
            <div>
              <span className={`text-xs font-black uppercase tracking-wider block mb-2.5 ${
                isDarkMode ? 'text-stone-300' : 'text-slate-900'
              }`}>
                Select Clinical Department
              </span>
              <div className="flex flex-wrap gap-2">
                {specsList.map(spec => {
                  const isDeptSelected = selectedSpecialty === spec;
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => handleSpecialtyChange(spec)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm ${
                        isDeptSelected
                          ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-500 scale-[1.02]'
                          : isDarkMode
                          ? 'bg-[#222226] text-stone-200 border border-[#3F3F46] hover:bg-[#2A2A30] hover:text-white'
                          : 'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                      }`}
                    >
                      {spec}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* High-Contrast Legend */}
            <div className={`flex items-center gap-5 text-xs font-black pt-1 ${
              isDarkMode ? 'text-stone-300' : 'text-slate-700'
            }`}>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span> 30-Min Hold
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-400"></span> Occupied (Unavailable)
              </span>
            </div>

            {unitsLoading && (
              <p role="status" className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Loading live bed availability…
              </p>
            )}
            {unitLoadError && (
              <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
                {unitLoadError} Bed selection is disabled until availability can be confirmed.
              </p>
            )}

            {/* High-Contrast Bed Grid */}
            <div className="space-y-5">
              {liveBedRows.map((row) => (
                <div key={row.category} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                      {row.category}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-black">
                      {row.price}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {row.beds.map((b) => {
                      const isSelected = selectedBed?.id === b.id;
                      const isOccupied = b.status === 'OCCUPIED';
                      const isHeld = b.status === '30_MIN_HOLD';
                      const holdExpiry = b.hold_expires_at ? Date.parse(b.hold_expires_at) : NaN;
                      const holdMinutesLeft = Number.isFinite(holdExpiry)
                        ? Math.max(0, Math.ceil((holdExpiry - unitsNow) / 60000))
                        : null;
                      const tileUnavailable = isOccupied || isHeld || unitsLoading || Boolean(unitLoadError);
                      return (
                        <div
                          key={b.id}
                          onClick={() => handleBedSelect(b, row)}
                          className={`p-3.5 rounded-2xl border-2 transition-all text-left relative ${
                            isOccupied
                              ? isDarkMode
                                ? 'border-dashed border-slate-600 bg-slate-800/50 cursor-not-allowed opacity-55'
                                : 'border-dashed border-slate-300 bg-slate-100 cursor-not-allowed opacity-60'
                              : isHeld
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 cursor-not-allowed shadow-sm'
                              : isSelected
                              ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-500/30 shadow-lg cursor-pointer'
                              : tileUnavailable
                              ? 'border-slate-200 bg-slate-50 opacity-60 cursor-wait dark:border-slate-700 dark:bg-slate-800'
                              : isDarkMode
                              ? 'border-slate-700 bg-[#1E1E24] hover:border-blue-500 cursor-pointer shadow-sm'
                              : 'border-slate-300 bg-white hover:border-blue-600 hover:shadow-md cursor-pointer shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-black text-sm font-mono tracking-tight ${
                              isOccupied
                                ? isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                : isHeld
                                ? 'text-amber-900 dark:text-amber-200'
                                : isSelected
                                ? 'text-blue-900'
                                : isDarkMode
                                ? 'text-white'
                                : 'text-slate-900'
                            }`}>
                              {b.code}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              isOccupied
                                ? isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                                : isHeld
                                ? 'bg-amber-200 text-amber-950 dark:bg-amber-400 dark:text-black'
                                : isSelected
                                ? 'bg-blue-600 text-white'
                                : isDarkMode
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {isOccupied ? 'BED BOOKED' : isHeld ? 'TIMER BOOKING' : row.price}
                            </span>
                          </div>

                          <div className={`text-xs mt-1 font-bold ${
                            isOccupied
                              ? isDarkMode ? 'text-slate-400' : 'text-slate-500'
                              : isHeld
                              ? 'text-amber-800 dark:text-amber-200'
                              : isSelected
                              ? 'text-blue-800'
                              : isDarkMode
                              ? 'text-zinc-300'
                              : 'text-slate-700'
                          }`}>
                            {row.category}
                          </div>

                          <div className="flex items-center gap-1.5 mt-2.5">
                            {b.o2 && (
                              <span className="text-[10px] bg-blue-100 border border-blue-300 text-blue-900 font-black px-2 py-0.5 rounded-md">
                                O2
                              </span>
                            )}
                            {b.vent && (
                              <span className="text-[10px] bg-purple-100 border border-purple-300 text-purple-900 font-black px-2 py-0.5 rounded-md">
                                Ventilator
                              </span>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-zinc-800 text-xs font-black flex items-center justify-between">
                            <span className={
                              isOccupied
                                ? 'text-slate-500 dark:text-slate-400'
                                : isHeld
                                ? 'text-amber-800 dark:text-amber-200'
                                : unitsLoading || unitLoadError
                                ? 'text-slate-500'
                                : isSelected 
                                ? 'text-blue-700' 
                                : 'text-emerald-700 dark:text-emerald-400'
                            }>
                              {isOccupied
                                ? 'BED BOOKED'
                                : isHeld
                                ? `TIMER BOOKING${holdMinutesLeft === null ? '' : ` (${holdMinutesLeft}M LEFT)`}`
                                : unitsLoading
                                ? 'CHECKING'
                                : unitLoadError
                                ? 'UNAVAILABLE'
                                : isSelected
                                ? 'SELECTED'
                                : 'AVAILABLE'}
                            </span>
                            {isSelected && <IconCheck className="w-4 h-4 text-blue-700 font-black" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Bar */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between mt-4 ${
              isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                {selectedBed ? (
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                    Selected Unit: {selectedBed.code} ({selectedBed.category}) &bull; Tap tile to deselect
                  </span>
                ) : (
                  <span className="text-xs font-black text-slate-600 dark:text-stone-400">
                    Tap any available bed to select
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedBed}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-md"
              >
                Proceed to Intake Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Patient Intake (Deep Contrast) */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Patient Intake Details</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-stone-400">Provide demographic info to generate official OTP-verified bed hold</p>
            </div>

            {/* Autofill Demographic */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
              isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="font-black text-slate-600 dark:text-stone-400 text-[10px] uppercase">Autofill Demographic:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPatientName('Rohan Patnaik');
                    setGender('Male');
                    setAge('48');
                  }}
                  className="bg-white dark:bg-[#202024] border border-slate-300 dark:border-stone-700 px-3 py-1.5 rounded-xl font-black text-xs hover:border-blue-500 transition shadow-sm text-slate-900 dark:text-stone-100"
                >
                  Autofill: Male Patient (His)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPatientName('Sunita Mohapatra');
                    setGender('Female');
                    setAge('42');
                  }}
                  className="bg-white dark:bg-[#202024] border border-slate-300 dark:border-stone-700 px-3 py-1.5 rounded-xl font-black text-xs hover:border-blue-500 transition shadow-sm text-slate-900 dark:text-stone-100"
                >
                  Autofill: Female Patient (Her)
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">Patient Full Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">Mobile Phone (for OTP)</label>
                <input
                  type="text"
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">Age (Years)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-black text-slate-700 dark:text-stone-300 text-xs mb-1">
                PM-JAY / BSKY Card Number (Optional for Cashless)
              </label>
              <input
                type="text"
                value={bskyCard}
                onChange={(e) => setBskyCard(e.target.value)}
                className={`w-full p-2.5 rounded-xl border font-mono font-bold text-xs sm:text-sm ${
                  isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* High-Contrast Bed Summary Box */}
            <div className={`p-4 rounded-2xl border-2 shadow-sm ${
              isDarkMode 
                ? 'bg-blue-950/60 border-blue-600 text-white' 
                : 'bg-blue-50 border-blue-500 text-slate-900'
            }`}>
              <div className="font-black text-xs uppercase tracking-wider text-blue-800 dark:text-blue-300 mb-1">
                Selected Bed Summary:
              </div>
              <div className="font-black text-sm text-slate-950 dark:text-white leading-snug">
                {activeHospital?.hospital_name} &bull; <span className="text-blue-700 dark:text-blue-300">{selectedSpecialty}</span> &bull; Bed: <span className="font-mono bg-blue-600 text-white px-2 py-0.5 rounded font-black">{selectedBed?.code}</span> ({selectedBed?.category})
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-bold">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-600 hover:text-slate-900 dark:text-stone-400 dark:hover:text-stone-200 font-bold text-xs"
              >
                &larr; Back to Bed Grid
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={requestLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-md"
              >
                {requestLoading ? 'Sending OTP…' : 'Send OTP & Lock Bed Hold →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP Verification */}
        {step === 3 && (
          <div className="space-y-4 py-2 text-center max-w-sm mx-auto">
            <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <IconShield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Verify Mobile OTP</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-stone-400 mt-1">
                Enter the 6-digit verification code sent to <b>+91 {contactMobile}</b>
              </p>
              {devOtp && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-900">
                  <span className="font-bold">Demonstration OTP:</span> {devOtp}
                  <button
                    type="button"
                    onClick={() => setOtp(devOtp)}
                    className="mt-2 block rounded-lg border border-amber-400 px-3 py-1.5 font-bold hover:bg-amber-100"
                  >
                    Auto-fill demo OTP
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full text-center tracking-[0.5em] font-mono text-2xl font-black p-3 rounded-2xl border-2 border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#141416] text-slate-900 dark:text-white shadow-inner"
            />

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-bold">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyAndLock}
              disabled={requestLoading || otp.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm py-3.5 rounded-2xl transition shadow-lg shadow-emerald-500/20"
            >
              {requestLoading ? 'Verifying…' : 'Verify & Activate 30-Min Bed Hold'}
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-stone-200 block mx-auto font-bold"
            >
              Change Patient Information
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

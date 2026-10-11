import React, { useState, useEffect } from 'react';
import { IconCross, IconBed, IconCheck, IconShield, IconClock } from './Icons';

export default function GeneralAdmissionModal({
  isOpen,
  onClose,
  hospital,
  specialties = [],
  onConfirmHold,
  isDarkMode
}) {
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedBed, setSelectedBed] = useState(null);
  const [patientName, setPatientName] = useState('Rohan Patnaik');
  const [contactMobile, setContactMobile] = useState('9861048219');
  const [age, setAge] = useState('48');
  const [gender, setGender] = useState('Male');
  const [bskyCard, setBskyCard] = useState('BSKY-BBSR-2026-99');
  const [step, setStep] = useState(1); // 1: Bed Grid, 2: Demographic Details, 3: OTP
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Default specialty setup on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedBed(null);
      setErrorMsg('');
      if (hospital?.specialties) {
        const specs = hospital.specialties.split(';').map(s => s.trim()).filter(Boolean);
        setSelectedSpecialty(specs[0] || 'General Medicine');
      } else {
        setSelectedSpecialty('General Medicine');
      }
    }
  }, [isOpen, hospital]);

  // When switching specialty, clear selected bed and error
  const handleSpecialtyChange = (spec) => {
    setSelectedSpecialty(spec);
    setSelectedBed(null);
    setErrorMsg('');
  };

  if (!isOpen || !hospital) return null;

  // Department code derivation (e.g. "General Medicine" -> "GENE", "Orthopedics" -> "ORTH")
  const getDeptPrefix = (dept) => {
    const clean = (dept || 'GENE').toUpperCase().replace(/[^A-Z]/g, '');
    return clean.slice(0, 4).padEnd(4, 'X');
  };

  const prefix = getDeptPrefix(selectedSpecialty);

  // Pure, Isolated Bed Matrix (Fixes Issues 5 & 6)
  // Generates 4 clean rows strictly for the current specialty with distinct Gender IDs:
  // Row 1: General Ward (Male)   -> unique_id: ${prefix}-GEN-M-01 ...   // Row 2: General Ward (Female) -> unique_id:${prefix}-GEN-F-01 ...
  // Row 3: Semi-Private          -> unique_id: ${prefix}-SEM-01 ...   // Row 4: HDU / Special Care    -> unique_id:${prefix}-HDU-01 ...
  const bedRows = [
    {
      category: 'General Ward (Male)',
      type: 'General',
      gender: 'Male',
      price: hospital.admission_fee_inr === 0 ? 'Free' : `Rs. ${hospital.admission_fee_inr}`,
      beds: [
        { code: `${prefix}-GEN-01`, unique_id: `${prefix}-GEN-M-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-GEN-02`, unique_id: `${prefix}-GEN-M-02`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-GEN-03`, unique_id: `${prefix}-GEN-M-03`, o2: true, vent: false, occupied: true },
        { code: `${prefix}-GEN-04`, unique_id: `${prefix}-GEN-M-04`, o2: true, vent: false, occupied: false }
      ]
    },
    {
      category: 'General Ward (Female)',
      type: 'General',
      gender: 'Female',
      price: hospital.admission_fee_inr === 0 ? 'Free' : `Rs. ${hospital.admission_fee_inr}`,
      beds: [
        { code: `${prefix}-GEN-01`, unique_id: `${prefix}-GEN-F-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-GEN-02`, unique_id: `${prefix}-GEN-F-02`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-GEN-03`, unique_id: `${prefix}-GEN-F-03`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-GEN-04`, unique_id: `${prefix}-GEN-F-04`, o2: true, vent: false, occupied: false }
      ]
    },
    {
      category: 'Semi-Private Cabin',
      type: 'Semi-Private',
      gender: 'Any',
      price: 'Rs. 400/d',
      beds: [
        { code: `${prefix}-SEM-01`, unique_id: `${prefix}-SEM-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-SEM-02`, unique_id: `${prefix}-SEM-02`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-SEM-03`, unique_id: `${prefix}-SEM-03`, o2: true, vent: false, occupied: false },
        { code: `${prefix}-SEM-04`, unique_id: `${prefix}-SEM-04`, o2: true, vent: false, occupied: false }
      ]
    },
    {
      category: 'High Dependency Unit (HDU)',
      type: 'HDU',
      gender: 'Any',
      price: 'Rs. 800/d',
      beds: [
        { code: `${prefix}-HDU-01`, unique_id: `${prefix}-HDU-01`, o2: true, vent: true, occupied: false },
        { code: `${prefix}-HDU-02`, unique_id: `${prefix}-HDU-02`, o2: true, vent: false, occupied: false }
      ]
    }
  ];

  const handleBedSelect = (bed, row) => {
    if (bed.occupied) return;
    setSelectedBed({
      bed_code: bed.code,
      unique_id: bed.unique_id,
      category: row.category,
      gender: row.gender,
      type: row.type,
      price: row.price,
      specialty: selectedSpecialty
    });
  };

  const handleSendOtp = () => {
    if (!patientName.trim() || !contactMobile.trim()) {
      setErrorMsg('Please enter patient name and mobile number.');
      return;
    }
    setOtpSent(true);
    setStep(3);
    setOtp('');
  };

  const handleVerifyAndLock = () => {
    const bookingRef = `AROGYA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const holdPayload = {
      request_id: bookingRef,
      hospital_id: hospital.hospital_id,
      hospital_name: hospital.hospital_name,
      admission_fee_inr: hospital.admission_fee_inr,
      specialty: selectedSpecialty,
      bed_unit_id: selectedBed.bed_code,
      bed_unique_id: selectedBed.unique_id,
      doctor_incharge: 'Dr. Duty Medical Officer',
      desk_location: 'Central Admission Wing, Gate 1',
      hospital_desk_contact: hospital.contact_phone || '+91-674-2391983',
      patient_name: patientName,
      contact_mobile: contactMobile,
      directions_url: hospital.directions_url
    };
    onConfirmHold(holdPayload);
  };

  const hospitalSpecs = hospital.specialties
    ? hospital.specialties.split(';').map(s => s.trim()).filter(Boolean)
    : ['General Medicine'];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl overflow-hidden border flex flex-col transition-colors ${
          isDarkMode ? 'bg-[#18181B] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#E7E4DC] text-[#1C1917]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-[#131315] border-[#2D2D34]' : 'bg-[#FAF8F5] border-[#E7E4DC]'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <IconBed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">{hospital.hospital_name}</h3>
              <p className="text-xs text-stone-400">Departmental Ward Discovery & 30-Min Hold Pass</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition"
          >
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* STEP 1: Department & Bed Selection */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Department Pills */}
              <div>
                <span className="text-[10px] font-bold uppercase text-stone-400 tracking-wider block mb-2">
                  Select Clinical Specialty Department
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {hospitalSpecs.map(spec => (
                    <button
                      key={spec}
                      onClick={() => handleSpecialtyChange(spec)}
                      className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition ${
                        selectedSpecialty === spec
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDarkMode
                          ? 'bg-[#222226] text-stone-300 hover:bg-[#2A2A30] border border-[#2D2D34]'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bed Legend */}
              <div className="flex items-center gap-4 text-[11px] pt-1 text-stone-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available (Click to Select)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-500"></span> Occupied
                </span>
              </div>

              {/* Bed Grid (Pure & Isolated) */}
              <div className="space-y-4">
                {bedRows.map((row) => (
                  <div key={row.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-400">
                      <span>{row.category}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{row.price}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {row.beds.map((b) => {
                        const isSelected = selectedBed?.unique_id === b.unique_id;
                        return (
                          <div
                            key={b.unique_id}
                            onClick={() => handleBedSelect(b, row)}
                            className={`p-3 rounded-2xl border-2 transition text-left cursor-pointer relative ${
                              b.occupied
                                ? isDarkMode
                                  ? 'border-[#242428] bg-[#141416] opacity-40 cursor-not-allowed'
                                  : 'border-stone-200 bg-stone-100 opacity-40 cursor-not-allowed'
                                : isSelected
                                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-sm'
                                : isDarkMode
                                ? 'border-[#2D2D34] bg-[#1E1E22] hover:border-blue-500'
                                : 'border-stone-200 bg-white hover:border-blue-400 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs font-mono text-stone-900 dark:text-stone-100">
                                {b.code}
                              </span>
                              <span className="text-[10px] text-stone-400 font-medium">
                                {b.occupied ? 'Occupied' : 'Free'}
                              </span>
                            </div>

                            <div className="text-[10px] text-stone-400 mt-0.5 truncate">
                              {row.category}
                            </div>

                            <div className="flex items-center gap-1.5 mt-2">
                              {b.o2 && (
                                <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.2 rounded">
                                  O2
                                </span>
                              )}
                              {b.vent && (
                                <span className="text-[9px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold px-1.5 py-0.2 rounded">
                                  Ventilator
                                </span>
                              )}
                            </div>

                            <div className="mt-2 text-[10px] font-bold flex items-center justify-between">
                              <span className={b.occupied ? 'text-stone-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {b.occupied ? 'Occupied' : 'Available'}
                              </span>
                              {isSelected && <IconCheck className="w-3.5 h-3.5 text-blue-600" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Step 1 Footer Action */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  {selectedBed ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Selected Bed: {selectedBed.bed_code} ({selectedBed.category})
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">Please tap an available bed to proceed</span>
                  )}
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedBed}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-md"
                >
                  Proceed to Patient Intake &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Patient Intake (Fixed Contrast Issue 1) */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-extrabold text-base">Patient Intake Details</h4>
                <p className="text-xs text-stone-400">Please provide patient demographic information for 6-digit OTP verification</p>
              </div>

              {/* Autofill Shortcuts */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-stone-50 border-stone-200'
              }`}>
                <span className="font-bold text-stone-400 text-[10px] uppercase">Quick Patient Autofill:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPatientName('Rohan Patnaik');
                      setGender('Male');
                      setAge('48');
                    }}
                    className="bg-white dark:bg-[#202024] border border-stone-200 dark:border-stone-700 px-3 py-1 rounded-xl font-bold text-xs hover:border-blue-500 transition shadow-sm"
                  >
                    Autofill: Male Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPatientName('Sunita Mohapatra');
                      setGender('Female');
                      setAge('42');
                    }}
                    className="bg-white dark:bg-[#202024] border border-stone-200 dark:border-stone-700 px-3 py-1 rounded-xl font-bold text-xs hover:border-blue-500 transition shadow-sm"
                  >
                    Autofill: Female Patient
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-400 mb-1">Patient Full Name</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-400 mb-1">Mobile Phone (for OTP)</label>
                  <input
                    type="text"
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-400 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-400 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-400 text-xs mb-1">
                  PM-JAY / BSKY Card Number (Optional for Cashless Admission)
                </label>
                <input
                  type="text"
                  value={bskyCard}
                  onChange={(e) => setBskyCard(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-mono font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-stone-300 text-stone-900'
                  }`}
                />
              </div>

              {/* HIGH CONTRAST BED SUMMARY BOX (Fixes Issue 1) */}
              <div className={`p-4 rounded-2xl border-2 shadow-sm ${
                isDarkMode 
                  ? 'bg-blue-950/40 border-blue-800 text-blue-100' 
                  : 'bg-blue-50 border-blue-300 text-slate-900'
              }`}>
                <div className="font-extrabold text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                  Selected Bed Summary:
                </div>
                <div className="font-bold text-sm leading-snug">
                  {hospital.hospital_name} &bull; <span className="text-blue-600 dark:text-blue-300">{selectedSpecialty}</span> &bull; Bed: <span className="font-mono bg-blue-600 text-white px-2 py-0.5 rounded-md font-black">{selectedBed?.bed_code}</span> ({selectedBed?.category})
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-bold">
                  {errorMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-stone-400 hover:text-stone-600 font-bold text-xs"
                >
                  &larr; Back to Bed Grid
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-md"
                >
                  Send OTP & Lock Bed Hold &rarr;
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
                <h4 className="font-extrabold text-base">Verify Mobile OTP</h4>
                <p className="text-xs text-stone-400 mt-1">
                  Enter the 6-digit OTP sent to <b>+91 {contactMobile}</b> to lock your 30-minute hold pass.
                </p>
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-900">
                  <span className="font-bold">Demonstration OTP:</span> 582190
                  <button
                    type="button"
                    onClick={() => setOtp('582190')}
                    className="mt-2 block rounded-lg border border-amber-400 px-3 py-1.5 font-bold hover:bg-amber-100"
                  >
                    Auto-fill demo OTP
                  </button>
                </div>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full text-center tracking-[0.5em] font-mono text-2xl font-black p-3 rounded-2xl border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#141416] text-stone-900 dark:text-white"
              />

              <button
                type="button"
                onClick={handleVerifyAndLock}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 rounded-2xl transition shadow-lg shadow-emerald-500/20"
              >
                Verify & Activate 30-Min Bed Hold
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-stone-400 hover:text-stone-600 block mx-auto font-medium"
              >
                Change Patient Info
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

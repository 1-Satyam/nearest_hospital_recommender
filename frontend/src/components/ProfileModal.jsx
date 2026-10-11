import React, { useEffect, useState } from 'react';
import { IconCross, IconClock, IconPhone, IconCheck, IconShield, IconMapPin } from './Icons';

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  activeHoldData,
  holdLedger = [],
  onLogout,
  isDarkMode
}) {
  const [activeTab, setActiveTab] = useState('account');
  const [name, setName] = useState(user?.name || '');
  const mobile = user?.mobile || '';
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [card, setCard] = useState(user?.pmjay_card_number || user?.bskyCard || user?.pmjayCard || '');
  const [locality, setLocality] = useState(user?.locality || '');
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup || '');
  const [kinName, setKinName] = useState(user?.kinName || '');
  const [kinPhone, setKinPhone] = useState(user?.kinPhone || '');
  const [allergies, setAllergies] = useState(user?.allergies || '');
  const [saveBanner, setSaveBanner] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setName(user?.name || '');
    setAge(user?.age || '');
    setGender(user?.gender || '');
    setCard(user?.pmjay_card_number || user?.bskyCard || user?.pmjayCard || '');
    setLocality(user?.locality || '');
    setBloodGroup(user?.bloodGroup || '');
    setKinName(user?.kinName || '');
    setKinPhone(user?.kinPhone || '');
    setAllergies(user?.allergies || '');
    setActiveTab('account');
  }, [isOpen, user]);

  const reservations = holdLedger.length > 0 ? holdLedger : (activeHoldData ? [activeHoldData] : []);

  useEffect(() => {
    if (!isOpen || !reservations.some((hold) => hold.status === 'HELD')) return undefined;
    const timerId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [isOpen, holdLedger, activeHoldData]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    const updatedUser = {
      ...user,
      name,
      mobile,
      age,
      gender,
      has_pmjay: Boolean(user?.has_pmjay),
      pmjay_card_number: card,
      bskyCard: card,
      locality,
      bloodGroup,
      kinName,
      kinPhone,
      allergies,
      scheme: user?.has_pmjay ? 'PM-JAY' : 'Standard'
    };
    try {
      if (typeof onUpdateUser === 'function') await onUpdateUser(updatedUser);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 3000);
    } catch (error) {
      setProfileError(error.message || 'Could not save your account profile.');
    }
  };

  const getHoldStatusLabel = (hold) => {
    if (hold.status !== 'HELD') return hold.status || 'UNKNOWN';
    const expiresAt = hold.hold_expires_at ? Date.parse(hold.hold_expires_at) : NaN;
    const seconds = Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - clockNow) / 1000)) : 0;
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} REMAINING`;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl overflow-hidden border flex flex-col transition-colors ${
          isDarkMode ? 'bg-[#18181B] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-[#131315] border-[#2D2D34]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-md">
              {name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">{name}</h3>
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {user?.has_pmjay ? 'PM-JAY Beneficiary' : 'Standard Account'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-stone-400 mt-0.5">
                ABHA Health ID: 91-8492-3841-2091 &bull; Citizen Profile
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 transition cursor-pointer"
          >
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className={`flex border-b text-xs font-black ${
          isDarkMode ? 'border-[#2D2D34] bg-[#141416]' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-3 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'account' 
                ? 'border-blue-600 text-blue-600 bg-white dark:bg-[#18181B]' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-stone-300'
            }`}
          >
            1. Citizen Health Demographics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 py-3 text-center border-b-2 transition cursor-pointer ${
              activeTab === 'ledger' 
                ? 'border-blue-600 text-blue-600 bg-white dark:bg-[#18181B]' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-stone-300'
            }`}
          >
            2. BED HOLD LEDGER {reservations.some((hold) => hold.status === 'HELD') && `• (${reservations.filter((hold) => hold.status === 'HELD').length} ACTIVE)`}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {saveBanner && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-black flex items-center justify-center gap-2 animate-fadeIn">
              <IconCheck className="w-4 h-4" />
              <span>Profile, scheme card, and emergency contact details updated successfully!</span>
            </div>
          )}

          {activeTab === 'account' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Ayushman Bharat PM-JAY Golden Card Visual */}
              {user?.has_pmjay && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white shadow-lg space-y-2.5 relative overflow-hidden">
                <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-100 flex items-center gap-1">
                    <IconShield className="w-3.5 h-3.5" /> Ayushman Bharat PM-JAY Golden Card
                  </span>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    Active & Verified
                  </span>
                </div>
                <div className="font-mono text-xl font-black tracking-widest text-emerald-50">
                  {card || 'PM-JAY card number not added'}
                </div>
                <div className="flex items-center justify-between text-xs text-emerald-100 pt-1 border-t border-white/20 font-bold">
                  <span>Cardholder: {name}</span>
                  <span>Coverage: INR 5,00,000 / Year Cashless</span>
                </div>
              </div>
              )}

              {/* Form Fields: Previous & Missing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">
                    Full Name (Registered)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">
                    Registered Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    readOnly
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-stone-400' : 'bg-slate-100 border-slate-300 text-slate-600'
                    }`}
                  />
                  <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-stone-400">
                    Sign-in mobile number cannot be changed without a verification flow.
                  </p>
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">
                    Age & Gender
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className={`w-20 p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                        isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={`flex-1 p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
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
                  <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">
                    Blood Group (Medical Profile)
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="A+">A+ (Positive)</option>
                    <option value="A-">A- (Negative)</option>
                    <option value="B+">B+ (Positive)</option>
                    <option value="B-">B- (Negative)</option>
                    <option value="O+">O+ (Universal Donor)</option>
                    <option value="O-">O- (Negative)</option>
                    <option value="AB+">AB+ (Positive)</option>
                    <option value="AB-">AB- (Negative)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">
                    Emergency Next of Kin Name
                  </label>
                  <input
                    type="text"
                    value={kinName}
                    onChange={(e) => setKinName(e.target.value)}
                    placeholder="e.g. Sita (Spouse)"
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-stone-300 mb-1">
                    Emergency Next of Kin Mobile
                  </label>
                  <input
                    type="text"
                    value={kinPhone}
                    onChange={(e) => setKinPhone(e.target.value)}
                    placeholder="e.g. +91 94370 12345"
                    className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-stone-300 text-xs mb-1">
                  Default Locality / Sector in Bhubaneswar
                </label>
                <input
                  type="text"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-stone-300 text-xs mb-1">
                  Known Allergies / Medical Flags (Optional)
                </label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin allergy, Diabetic"
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs sm:text-sm ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-2">
                {profileError && (
                  <p role="alert" className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    {profileError}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm py-3 rounded-xl transition shadow-md cursor-pointer"
                >
                  Save & Update Citizen Health Profile
                </button>
              </div>
            </form>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-stone-400 tracking-wider block">
                Active & Recent Bed Reservations
              </span>

              {reservations.length > 0 ? reservations.slice().reverse().map((hold) => (
                <div
                  key={hold.request_id}
                  className={`p-4 rounded-2xl border-2 space-y-3 ${
                    hold.status === 'HELD'
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
                      : hold.status === 'ADMITTED'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                      {hold.request_id}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${
                      hold.status === 'HELD'
                        ? 'bg-amber-200 text-amber-950 dark:bg-amber-400 dark:text-black'
                        : hold.status === 'ADMITTED'
                        ? 'bg-emerald-200 text-emerald-950 dark:bg-emerald-500 dark:text-white'
                        : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                    }`}>
                      <IconClock className="w-3 h-3" />
                      {getHoldStatusLabel(hold)}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">
                      {hold.hospital_name}
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                      {hold.flow_type === 'EMERGENCY' ? 'EMERGENCY' : hold.specialty}
                      {hold.bed_unit_id && <> &bull; UNIT: <b className="text-blue-800 dark:text-blue-300">{hold.bed_unit_id}</b></>}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-300 dark:border-slate-700 font-bold">
                    <span className="text-slate-700 dark:text-slate-300">
                      Doctor: {hold.doctor_incharge || 'Dr. Duty Officer'}
                    </span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300">
                      {hold.admission_fee_inr === 0 ? 'FREE / Govt PM-JAY' : `INR ${hold.admission_fee_inr ?? '—'}`}
                    </span>
                  </div>
                </div>
              )) : (
                <div className={`p-8 rounded-2xl border text-center text-xs font-bold text-slate-500 ${
                  isDarkMode ? 'bg-[#131315] border-[#2D2D34]' : 'bg-slate-50 border-slate-200'
                }`}>
                  No bed reservations are recorded on this device yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 ${
          isDarkMode ? 'bg-[#131315] border-[#2D2D34]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
        }`}>
          {onLogout && (
            <button 
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
            >
              Sign Out
            </button>
          )}
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-black text-xs py-3 rounded-xl transition shadow-md cursor-pointer"
          >
            Close Account Page
          </button>
        </div>
      </div>
    </div>
  );
}

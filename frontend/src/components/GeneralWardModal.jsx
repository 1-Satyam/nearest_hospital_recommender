import React, { useState, useEffect } from 'react';
import { IconBed, IconClock, IconCross, IconCheck } from './Icons';
import { getGeneralWardVacancyPercent } from '../utils/hospitalMetrics';

export default function GeneralWardModal({ hospital, onClose, user, specialtiesList = [] }) {
  const vacancyPercent = getGeneralWardVacancyPercent(hospital);
  const [step, setStep] = useState(1);
  const [selectedSpecialty, setSelectedSpecialty] = useState(specialtiesList[0] || 'Cardiology');
  const [bedType, setBedType] = useState('Standard');
  const [patientName, setPatientName] = useState(user?.name || '');
  const [contactMobile, setContactMobile] = useState(user?.mobile || '');
  const [requestId, setRequestId] = useState(null);
  const [devOtp, setDevOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(1800);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let timer;
    if (step === 3 && remainingSeconds > 0) {
      timer = setInterval(() => {
        setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, remainingSeconds]);

  const handleCreateHold = async (e) => {
    e.preventDefault();
    if (!contactMobile || contactMobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/requests/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_id: hospital.hospital_id,
          flow_type: 'GENERAL_WARD',
          specialty: selectedSpecialty,
          bed_type: bedType,
          patient_count: 1,
          patient_name: patientName || 'Standard Patient',
          contact_mobile: contactMobile
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to initiate request');

      setRequestId(data.request_id);
      setDevOtp(data.dev_otp);
      setEnteredOtp('');
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/requests/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          otp_code: enteredOtp
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Verification failed');

      setRemainingSeconds(data.remaining_seconds || 1800);
      setStep(3);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IconBed className="w-5 h-5 text-white" />
            <div>
              <div className="text-sm font-bold uppercase tracking-wide">General Ward & Specialty Bed Hold</div>
              <div className="text-xs text-blue-100">30-Minute Temporary Hold Booking</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-blue-200 p-1">
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase">
              General Ward Flow
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1">
              {hospital.hospital_name}
            </h3>
            <p className="text-xs text-slate-500">{hospital.address} • {hospital.distance_km} km away</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleCreateHold} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400">General Ward Vacancy</span>
                  <div className="font-extrabold text-emerald-600 text-sm">
                    {vacancyPercent === null ? '—' : `${vacancyPercent}%`} ({hospital.general_ward_available_beds} beds)
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Admission Fee</span>
                  <div className="font-extrabold text-slate-800 text-sm">₹{hospital.admission_fee_inr}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Specialty</label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {specialtiesList.map((sp) => (
                    <option key={sp} value={sp}>{sp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bed Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Standard', 'Oxygen Supported'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBedType(type)}
                      className={`text-xs py-2 px-3 rounded-xl font-bold border transition ${
                        bedType === type
                          ? 'bg-blue-50 border-blue-600 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Patient Full Name</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Patient Name"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Mobile Number</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={contactMobile}
                  onChange={(e) => setContactMobile(e.target.value)}
                  placeholder="10-digit number"
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-md shadow-blue-500/20"
              >
                {loading ? 'Processing...' : 'Reserve 30-min Bed Hold & Get OTP'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs text-amber-800">
                <span className="font-bold">Demonstration OTP Adapter:</span> Code generated for {contactMobile}.
                <div className="mt-1 font-mono font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded inline-block">
                  Dev OTP: {devOtp}
                </div>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(String(devOtp))}
                  className="mt-2 block rounded-lg border border-amber-300 px-3 py-1.5 font-bold text-amber-800 hover:bg-amber-100 transition"
                >
                  Auto-fill demo OTP
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Enter 6-digit OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center text-lg tracking-widest font-mono font-bold px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-md"
              >
                {loading ? 'Verifying...' : 'Verify OTP & Confirm Hold'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <IconClock className="w-8 h-8" />
              </div>

              <div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Hold Active (30-Minute Hold)
                </span>
                <h4 className="text-2xl font-black text-slate-900 mt-2">
                  {formatTimer(remainingSeconds)}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Hold Request ID: <span className="font-mono font-bold text-slate-700">{requestId}</span>
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hospital Admission Desk:</span>
                  <a href={`tel:${hospital.contact_phone}`} className="font-bold text-blue-600 underline">
                    {hospital.contact_phone}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reserved Ward:</span>
                  <span className="font-bold text-slate-800">{selectedSpecialty} ({bedType})</span>
                </div>
                <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200">
                  * Note: Temporary hold request. Please present this request ID at the reception within 30 minutes.
                </p>
              </div>

              <div className="flex gap-2">
                <a
                  href={hospital.directions_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition text-center"
                >
                  Google Directions
                </a>
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

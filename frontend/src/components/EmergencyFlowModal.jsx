import React, { useState, useEffect } from 'react';
import { IconAlert, IconPhone, IconClock, IconCross, IconCheck } from './Icons';

export default function EmergencyFlowModal({ hospital, onClose, onCompleteHold, user, isDarkMode }) {
  const [step, setStep] = useState(1);
  const [patientName, setPatientName] = useState(user?.name || '');
  const [patientCount, setPatientCount] = useState(1);
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
          flow_type: 'EMERGENCY',
          specialty: 'Emergency',
          bed_type: 'ICU',
          patient_count: Number(patientCount),
          patient_name: patientName || 'Emergency Patient',
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
      if (typeof onCompleteHold === 'function') {
        onCompleteHold({
          request_id: data.request_id || requestId,
          status: data.status || 'HELD',
          hospital_id: hospital.hospital_id,
          hospital_name: hospital.hospital_name,
          admission_fee_inr: hospital.admission_fee_inr,
          specialty: data.specialty || 'Emergency',
          bed_unit_id: data.bed_unit_id || 'Casualty Bay',
          doctor_incharge: data.doctor_incharge,
          desk_location: data.desk_location,
          hospital_desk_contact: data.hospital_desk_contact || hospital.contact_phone,
          patient_name: data.patient_name || patientName,
          contact_mobile: data.contact_mobile || contactMobile,
          directions_url: hospital.directions_url,
          flow_type: data.flow_type || 'EMERGENCY',
          hold_expires_at: data.hold_expires_at,
          remaining_seconds: data.remaining_seconds || 1800
        });
      }
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border transition-all ${
          isDarkMode ? 'bg-[#1E1E22] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#E7E4DC] text-[#1C1917]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-red-600 text-white p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IconAlert className="w-5 h-5 text-white animate-bounce" />
            <div>
              <div className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                Urgent Medical Emergency?
              </div>
              <div className="text-xs text-red-100">
                Call <a href="tel:108" className="font-bold underline text-white">108</a> immediately. Do not delay medical transit!
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-200 p-1">
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <span className="text-[10px] font-bold tracking-wider text-red-600 bg-red-500/10 px-2.5 py-0.5 rounded-full uppercase">
              Emergency Flow
            </span>
            <h3 className="text-xl font-bold mt-1">
              {hospital.hospital_name}
            </h3>
            <p className="text-xs text-stone-500">{hospital.address} • {hospital.distance_km} km away</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleCreateHold} className="space-y-4">
              <div className={`grid grid-cols-2 gap-3 text-xs p-3 rounded-2xl border ${
                isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-[#FAF8F5] border-[#E7E4DC]'
              }`}>
                <div>
                  <span className="text-stone-400">Emergency Beds</span>
                  <div className="font-bold text-sm mt-0.5">24x7 Available</div>
                </div>
                <div>
                  <span className="text-stone-400">Base Admission Fee</span>
                  <div className="font-bold text-sm mt-0.5">INR {hospital.admission_fee_inr + 500}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-400">Patient Name</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Full name of patient"
                  className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-400">Patient Count</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={patientCount}
                    onChange={(e) => setPatientCount(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-400">Contact Mobile</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
                    placeholder="10-digit number"
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-md shadow-red-500/20"
              >
                {loading ? 'Processing...' : 'Request Emergency Bed & Get OTP'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs text-amber-500">
                <span className="font-bold">Demonstration OTP Adapter:</span> Code sent to {contactMobile}.
                <div className="mt-1 font-mono font-bold bg-amber-500/20 px-2 py-1 rounded inline-block">
                  Dev OTP: {devOtp}
                </div>
                <button
                  type="button"
                  onClick={() => setEnteredOtp(String(devOtp))}
                  className="mt-2 block rounded-lg border border-amber-500/40 px-3 py-1.5 font-bold text-amber-500 hover:bg-amber-500/10 transition"
                >
                  Auto-fill demo OTP
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-stone-400">Enter 6-digit OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`w-full text-center text-lg tracking-widest font-mono font-bold px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-md"
              >
                {loading ? 'Verifying...' : 'Verify OTP & Activate 30-min Hold'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <IconClock className="w-8 h-8" />
              </div>

              <div>
                <span className="bg-emerald-500/10 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Provisional Bed Hold Active
                </span>
                <h4 className="text-3xl font-black text-red-600 font-mono mt-2">
                  {formatTimer(remainingSeconds)}
                </h4>
                <p className="text-xs text-stone-400 mt-1">
                  Hold Request ID: <span className="font-mono font-bold">{requestId}</span>
                </p>
              </div>

              <div className={`p-4 rounded-2xl border text-left text-xs space-y-2 ${
                isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-[#FAF8F5] border-[#E7E4DC]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Casualty Desk:</span>
                  <a href={`tel:${hospital.contact_phone}`} className="font-bold text-blue-500 underline">
                    {hospital.contact_phone}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Hospital:</span>
                  <span className="font-bold">{hospital.hospital_name}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={hospital.directions_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition text-center"
                >
                  Navigate Maps
                </a>
                <button
                  onClick={onClose}
                  className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition ${
                    isDarkMode ? 'bg-[#25252A] text-stone-300 hover:bg-[#2E2E34]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
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

import React, { useEffect, useState } from 'react';
import { IconCheck, IconClock, IconPhone, IconNavigation } from './Icons';

export default function HoldPassView({
  holdData,
  onReset,
  onDone,
  onClose,
  onBack,
  onHoldUpdate,
  isDarkMode
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState(holdData?.status || 'HELD');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setStatus(holdData?.status || 'HELD');
  }, [holdData?.request_id, holdData?.status]);

  useEffect(() => {
    const expiresAt = holdData?.hold_expires_at ? Date.parse(holdData.hold_expires_at) : NaN;
    if (!Number.isFinite(expiresAt)) {
      setRemainingSeconds(0);
      return undefined;
    }

    const updateRemaining = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timerId);
  }, [holdData?.hold_expires_at]);

  useEffect(() => {
    if (remainingSeconds !== 0 || status !== 'HELD' || !holdData?.request_id) return;
    const expiry = holdData.hold_expires_at ? Date.parse(holdData.hold_expires_at) : NaN;
    if (Number.isFinite(expiry) && expiry > Date.now()) return;

    let cancelled = false;
    fetch(`/api/requests/${encodeURIComponent(holdData.request_id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Could not refresh hold status.');
        if (!cancelled && data.status !== status) {
          setStatus(data.status);
          onHoldUpdate?.({ ...holdData, status: data.status });
        }
      })
      .catch((error) => {
        if (!cancelled) setActionError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [remainingSeconds, status, holdData, onHoldUpdate]);

  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  const resolveHold = async (action) => {
    if (!holdData?.request_id) return;
    setActionLoading(true);
    setActionError('');
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(request_id)}/${action}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Could not ${action} this hold.`);
      setStatus(data.status);
      onHoldUpdate?.({ ...holdData, status: data.status });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!holdData) return null;

  const {
    request_id,
    hospital_name,
    admission_fee_inr,
    specialty,
    bed_unit_id,
    doctor_incharge,
    desk_location,
    hospital_desk_contact,
    patient_name,
    directions_url
  } = holdData;

  const whatsappMessage = encodeURIComponent(
    `*Arogya - Bhubaneswar Emergency Bed Hold Confirmation*\n\n` +
    `*Patient:* ${patient_name || 'Ramesh'}\n` +
    `*Hospital:* ${hospital_name}\n` +
    `*Department:* ${specialty}\n` +
    `*Allocated Bed Unit:* ${bed_unit_id || 'Casualty Bay'}\n` +
    `*Doctor on Duty:* ${doctor_incharge || 'Casualty Medical Officer'}\n` +
    `*Location:* ${desk_location || 'Main Admission Wing'}\n` +
    `*Booking ID:* ${request_id}\n` +
    `*Route Navigation:* ${directions_url || 'https://maps.google.com'}`
  );

  const handleReturn = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (typeof onReset === 'function') onReset();
    if (typeof onDone === 'function') onDone();
    if (typeof onClose === 'function') onClose();
    if (typeof onBack === 'function') onBack();
    window.dispatchEvent(new CustomEvent('arogya:reset-hold-pass'));
  };

  return (
    <div className={`max-w-xl mx-auto rounded-3xl border shadow-xl overflow-hidden transition-colors ${
      isDarkMode ? 'bg-[#1E1E22] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#CBD5E1] text-[#0F172A]'
    }`}>
      <div className="bg-emerald-600 text-white p-6 text-center space-y-2">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
          <IconCheck className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          {status === 'HELD' ? '30-Minute Bed Hold Confirmed' : `Bed Hold ${status}`}
        </h2>
        <p className="text-xs text-emerald-100 max-w-md mx-auto">
          {status === 'HELD'
            ? 'The bed hold is active until the countdown expires. This is a provisional reservation; confirm with the hospital.'
            : status === 'ADMITTED'
              ? 'Admission has been marked as completed.'
              : status === 'CANCELLED'
                ? 'The hold was declined and released.'
                : 'The bed hold has expired.'}
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div>
            <span className="text-[10px] uppercase font-black text-slate-500 dark:text-stone-400 block tracking-wider">
              Booking Reference ID
            </span>
            <span className="font-mono text-base font-black text-blue-700 dark:text-blue-400">
              {request_id}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-xl text-xs font-black">
            <IconClock className="w-4 h-4" />
            <span>{status === 'HELD' ? formatTimer(remainingSeconds) : status}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className={`p-3.5 rounded-2xl border ${
            isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-white border-slate-200'
          }`}>
            <span className="text-[10px] font-black text-slate-500 dark:text-stone-400 uppercase tracking-wider block">
              Hospital & Ward
            </span>
            <div className="font-black text-sm mt-1 text-slate-900 dark:text-white leading-tight">
              {hospital_name}
            </div>
            <div className="text-slate-600 dark:text-stone-400 font-bold mt-1">
              {specialty} &bull; Bed: <b className="text-blue-700 dark:text-blue-400">{bed_unit_id}</b>
            </div>
          </div>

          <div className={`p-3.5 rounded-2xl border ${
            isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-white border-slate-200'
          }`}>
            <span className="text-[10px] font-black text-slate-500 dark:text-stone-400 uppercase tracking-wider block">
              Doctor on Duty
            </span>
            <div className="font-black text-sm mt-1 text-slate-900 dark:text-white leading-tight">
              {doctor_incharge || 'Dr. Duty Officer (Casualty)'}
            </div>
            <div className="text-slate-600 dark:text-stone-400 font-bold mt-1">
              {desk_location || 'Central Admission Wing, Gate 1'}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          {actionError && (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {actionError}
            </p>
          )}
          {status === 'HELD' && remainingSeconds > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => resolveHold('cancel')}
                className="rounded-xl border border-red-300 bg-red-50 py-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                {actionLoading ? 'Updating…' : 'Decline Hold'}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => resolveHold('checkin')}
                className="rounded-xl bg-emerald-600 py-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading ? 'Updating…' : 'Mark Admitted'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <a 
              href={`https://api.whatsapp.com/send?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition"
            >
              Share Pass via WhatsApp
            </a>
            <a 
              href={`tel:${hospital_desk_contact || '+916742391983'}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition"
            >
              <IconPhone className="w-4 h-4" /> Call Casualty Desk
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {directions_url ? (
              <a 
                href={directions_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`border text-center font-black text-xs py-3 rounded-xl transition ${
                  isDarkMode ? 'border-[#2D2D34] text-stone-300 hover:bg-[#25252A]' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Open Google Maps
              </a>
            ) : (
              <div />
            )}
            
            <button 
              type="button"
              onClick={handleReturn}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-black text-xs py-3 rounded-xl transition shadow-md cursor-pointer border border-transparent"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

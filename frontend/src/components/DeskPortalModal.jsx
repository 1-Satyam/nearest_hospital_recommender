import React, { useState, useEffect } from 'react';
import { IconCross, IconDatabase, IconCheck, IconRefresh } from './Icons';

export default function DeskPortalModal({ onClose, isDarkMode }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalToken, setPortalToken] = useState('');
  const [staff, setStaff] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [auditEvents, setAuditEvents] = useState({});
  const [loadingHistoryId, setLoadingHistoryId] = useState(null);

  const fetchDeskData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/requests/portal/active', {
        headers: { 'X-Hospital-Staff-Token': portalToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not load desk requests.');
      setRequests(data.requests || []);
      setStaff(data.staff || null);
    } catch (err) {
      setStaff(null);
      setRequests([]);
      setErrorMessage(err.message || 'Could not load desk requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeskData();
  }, []);

  const handleCheckin = async (reqId) => {
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(reqId)}/checkin`, {
        method: 'POST',
        headers: { 'X-Hospital-Staff-Token': portalToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not update request.');
      alert(data.message);
      fetchDeskData();
    } catch (err) {
      setErrorMessage(err.message || 'Error updating status.');
    }
  };

  const handleCancel = async (reqId) => {
    if (!confirm('Are you sure you want to cancel this bed hold?')) return;
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(reqId)}/cancel`, {
        method: 'POST',
        headers: { 'X-Hospital-Staff-Token': portalToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not cancel hold.');
      alert(data.message);
      fetchDeskData();
    } catch (err) {
      setErrorMessage(err.message || 'Error cancelling hold.');
    }
  };

  const handleDischarge = async (reqId) => {
    if (!confirm('Confirm discharge and release this bed to available inventory?')) return;
    try {
      const res = await fetch(`/api/requests/${encodeURIComponent(reqId)}/discharge`, {
        method: 'POST',
        headers: { 'X-Hospital-Staff-Token': portalToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not release the admitted bed.');
      await fetchDeskData();
    } catch (err) {
      setErrorMessage(err.message || 'Could not release the admitted bed.');
    }
  };

  const handleToggleHistory = async (reqId) => {
    if (auditEvents[reqId]) {
      setAuditEvents((current) => ({ ...current, [reqId]: null }));
      return;
    }
    setLoadingHistoryId(reqId);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(reqId)}/events`, {
        headers: { 'X-Hospital-Staff-Token': portalToken }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Could not load reservation history.');
      setAuditEvents((current) => ({ ...current, [reqId]: data.events || [] }));
    } catch (error) {
      setErrorMessage(error.message || 'Could not load reservation history.');
    } finally {
      setLoadingHistoryId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border max-h-[85vh] flex flex-col transition-all ${
          isDarkMode ? 'bg-[#1E1E22] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#E7E4DC] text-[#1C1917]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${
          isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-[#FAF8F5] border-[#E7E4DC]'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <IconDatabase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Hospital Desk Portal and Triage Registry</h3>
              <p className="text-xs text-stone-400">Requests and bed actions are limited to the signed-in staff member’s hospital</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="password"
              aria-label="Individual hospital staff token"
              value={portalToken}
              onChange={(event) => {
                setPortalToken(event.target.value);
                setStaff(null);
                setRequests([]);
                setAuditEvents({});
              }}
              placeholder="Staff access token"
              className={`w-36 rounded-lg border px-2 py-1.5 text-xs ${
                isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button aria-label="Refresh desk requests" onClick={fetchDeskData} className="p-2 rounded-lg text-stone-400 hover:text-stone-600">
              <IconRefresh className="w-4 h-4" />
            </button>
            <button aria-label="Close desk portal" onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-stone-600">
              <IconCross className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {errorMessage && (
            <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {errorMessage}
            </p>
          )}
          {staff && (
            <p className="mb-4 text-xs font-bold text-slate-600 dark:text-slate-300">
              Signed in as {staff.staff_id} · Hospital {staff.hospital_id}
            </p>
          )}
          {loading ? (
            <div className="text-center py-12 text-stone-400 text-sm">Loading triage records...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">No bed requests found in database. Create a hold first!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Hospital desk reservation registry</caption>
                <thead className={`font-semibold uppercase text-[10px] tracking-wider border-b ${
                  isDarkMode ? 'bg-[#141416] text-stone-400 border-[#2D2D34]' : 'bg-stone-50 text-stone-500 border-stone-200'
                }`}>
                  <tr>
                    <th className="py-2.5 px-3">Req ID</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Bed Unit</th>
                    <th className="py-2.5 px-3">Specialty</th>
                    <th className="py-2.5 px-3">PM-JAY</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-[#2D2D34]' : 'divide-stone-100'}`}>
                  {requests.map((r) => (
                    <tr key={r.id} className={isDarkMode ? 'hover:bg-[#25252A]' : 'hover:bg-stone-50'}>
                      <td className="py-3 px-3 font-mono font-bold">{r.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold">{r.patient_name}</div>
                        <div className="text-[11px] text-stone-400">{r.contact_mobile}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-500">{r.bed_unit_id}</td>
                      <td className="py-3 px-3">{r.specialty}</td>
                      <td className="py-3 px-3">
                        {r.pmjay_card_number ? (
                          <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-bold text-[10px]">
                            {r.pmjay_card_number}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[10px]">Standard</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          r.status === 'HELD' ? 'bg-amber-500/10 text-amber-500' :
                          r.status === 'ADMITTED' ? 'bg-emerald-500/10 text-emerald-500' :
                          r.status === 'DISCHARGED' ? 'bg-blue-500/10 text-blue-500' :
                          r.status === 'CANCELLED' ? 'bg-red-500/10 text-red-500' : 'bg-stone-500/10 text-stone-500'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                        {r.status === 'HELD' && (
                          <>
                            <button
                              type="button"
                              aria-label={`Mark request ${r.id} as admitted`}
                              onClick={() => handleCheckin(r.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded text-[11px]"
                            >
                              Check-in
                            </button>
                            <button
                              type="button"
                              aria-label={`Release hold for request ${r.id}`}
                              onClick={() => handleCancel(r.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold px-2 py-1 rounded text-[11px]"
                            >
                              Release
                            </button>
                          </>
                        )}
                        {r.status === 'ADMITTED' && (
                          <button
                            type="button"
                            aria-label={`Discharge request ${r.id} and release its bed`}
                            onClick={() => handleDischarge(r.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded text-[11px]"
                          >
                            Discharge & release bed
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleHistory(r.id)}
                          className={`ml-1 rounded border px-2 py-1 text-[11px] font-bold ${
                            isDarkMode ? 'border-slate-600 text-slate-200' : 'border-slate-300 text-slate-700'
                          }`}
                        >
                          {loadingHistoryId === r.id ? 'Loading…' : auditEvents[r.id] ? 'Hide history' : 'History'}
                        </button>
                        {Array.isArray(auditEvents[r.id]) && (
                          <ol className="mt-2 space-y-1 whitespace-normal text-left text-[10px] text-slate-500" aria-label={`Status history for ${r.id}`}>
                            {auditEvents[r.id].map((event, index) => (
                              <li key={`${event.created_at}-${index}`}>
                                {event.to_status} · {new Date(event.created_at).toLocaleString()}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

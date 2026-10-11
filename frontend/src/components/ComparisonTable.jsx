import React from 'react';
import { IconStar, IconMapPin, IconShield, IconBed, IconNavigation } from './Icons';
import { getGeneralWardVacancyPercent, isHospitalPmjayEmpanelled } from '../utils/hospitalMetrics';
import { getHospitalWebsite } from '../utils/hospitalWebsites';

export default function ComparisonTable({
  hospitals = [],
  topN = 10,
  onSelectHospital,
  selectedHospital,
  onRequestEmergency,
  onRequestGeneralWard,
  isDarkMode
}) {
  const tableData = hospitals.slice(0, 10);

  return (
    <div className={`rounded-3xl border shadow-sm overflow-hidden transition-colors ${
      isDarkMode ? 'bg-[#111C2E] border-[#29364A] text-slate-100' : 'bg-white border-[#D8E1EE] text-slate-900'
    }`}>
      <div className={`p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
        isDarkMode ? 'border-[#29364A] bg-[#0F192A]' : 'border-[#D8E1EE] bg-[#F8FAFC]'
      }`}>
        <div>
          <h3 className="font-bold text-lg tracking-tight">Hospital Multi-Criteria Comparison Matrix</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Compare ranked institutions with fees, distances, reported vacancy, and a clearly labeled 24h demo forecast
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-lg font-bold">
            Top {topN} Highlighted
          </span>
          <span className="text-stone-400">Total: {tableData.length} Hospitals</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className={`font-semibold uppercase text-[10px] tracking-wider border-b ${
            isDarkMode ? 'bg-[#0F192A] text-slate-300 border-[#29364A]' : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}>
            <tr>
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Hospital Name</th>
              <th className="py-3 px-4">Gradient Boosting · 24h</th>
              <th className="py-3 px-4">Road Distance</th>
              <th className="py-3 px-4">Admission Fee</th>
              <th className="py-3 px-4">Rating / Reviews</th>
              <th className="py-3 px-4">Bed Vacancy</th>
              <th className="py-3 px-4">PM-JAY Scheme</th>
              <th className="py-3 px-4">Official Website</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-[#29364A]' : 'divide-slate-200'}`}>
            {tableData.map((h) => {
              const isInTopN = h.rank <= topN;
              const isSelected = selectedHospital?.hospital_id === h.hospital_id;
              const vacancyPercent = getGeneralWardVacancyPercent(h);
              const webUrl = getHospitalWebsite(h);
              const distKm = h.road_distance_km || h.distance_km || 0;
              const etaMins = h.eta_minutes || Math.max(3, Math.round(distKm * 2.2));
              const distanceLabel = h.is_real_road ? `${distKm} km` : `~${distKm} km`;
              const etaLabel = h.is_real_road ? `~${etaMins} mins drive` : `~${etaMins} mins (estimate)`;
              const hasForecastBeds = Number.isFinite(h.forecast_available_beds_24h);
              const hasForecastVacancy = Number.isFinite(h.forecast_vacancy_pct_24h);

              return (
                <tr
                  key={h.hospital_id}
                  onClick={() => onSelectHospital(h)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? (isDarkMode ? 'bg-blue-950/30' : 'bg-blue-50/70')
                      : isInTopN
                      ? (isDarkMode ? 'hover:bg-[#172338]' : 'hover:bg-slate-50')
                      : (isDarkMode ? 'opacity-80 hover:opacity-100 hover:bg-[#172338]' : 'opacity-80 hover:opacity-100 hover:bg-slate-50')
                  }`}
                >
                  <td className="py-3.5 px-4 font-black">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                      isInTopN
                        ? 'bg-blue-600 text-white shadow-sm'
                        : (isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-700')
                    }`}>
                      #{h.rank}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-sm leading-snug">{h.hospital_name}</div>
                    <div className="text-[11px] text-stone-400 truncate max-w-xs">{h.address}</div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-bold text-blue-700 dark:text-blue-300">
                      {hasForecastBeds ? `${h.forecast_available_beds_24h} beds` : 'Unavailable'}
                      {hasForecastVacancy ? ` · ${h.forecast_vacancy_pct_24h}%` : ''}
                    </div>
                    <div className="text-[10px] text-stone-400">Synthetic demo · not operational</div>
                  </td>

                  <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                    <div>{distanceLabel}</div>
                    <div className="text-[10px] text-stone-400 font-normal">&bull; {etaLabel}</div>
                  </td>

                  <td className="py-3.5 px-4 font-black whitespace-nowrap">
                    {h.admission_fee_inr === 0 ? (
                      <span className="text-emerald-600">FREE / Govt</span>
                    ) : (
                      <span>&#8377;{h.admission_fee_inr}</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 font-bold">
                      <IconStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{h.rating_5}</span>
                    </div>
                    <div className="text-[10px] text-stone-400">({h.review_count || 120} reviews)</div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-bold text-emerald-600">{vacancyPercent === null ? '—' : `${vacancyPercent}%`}</span>
                    <div className="text-[10px] text-stone-400">{h.general_ward_available_beds} beds free</div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {isHospitalPmjayEmpanelled(h) ? (
                      <span className="bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                        <IconShield className="w-3.5 h-3.5" /> Empanelled
                      </span>
                    ) : (
                      <span className="text-stone-400 text-[10px]">Standard</span>
                    )}
                  </td>

                  {/* Official Website Column */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {webUrl ? (
                      <a
                        href={webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1 text-[11px]"
                      >
                        <span>Visit Portal</span>
                        <IconNavigation className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-stone-400 text-[11px]">Unavailable</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestEmergency(h);
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition shadow-sm"
                    >
                      Emergency
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestGeneralWard(h);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition shadow-sm inline-flex items-center gap-1"
                    >
                      <IconBed className="w-3.5 h-3.5" /> Ward
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

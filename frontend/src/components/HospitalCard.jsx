import React from 'react';
import { IconStar, IconMapPin, IconNavigation, IconShield, IconBed } from './Icons';
import { getGeneralWardVacancyPercent, isHospitalEmergencyReady, isHospitalPmjayEmpanelled } from '../utils/hospitalMetrics';
import { getHospitalWebsite } from '../utils/hospitalWebsites';

export default function HospitalCard({
  hospital,
  isDarkMode,
  isSelected,
  onSelect,
  onRequestEmergency,
  onRequestGeneralWard,
  onViewOnMap
}) {
  const isInTopN = hospital.is_in_top_n;
  const heroImage = hospital.image_hero || "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=600&q=80";
  const distKm = hospital.road_distance_km || hospital.distance_km || 0;
  const etaMins = hospital.eta_minutes || Math.max(3, Math.round(distKm * 2.2));
  const distanceLabel = hospital.is_real_road ? `${distKm} km` : `~${distKm} km`;
  const etaLabel = hospital.is_real_road ? `${etaMins} mins` : `~${etaMins} mins (estimate)`;
  const webUrl = getHospitalWebsite(hospital);
  const vacancyPercent = getGeneralWardVacancyPercent(hospital);
  const pmjayEmpanelled = isHospitalPmjayEmpanelled(hospital);
  const emergencyReady = isHospitalEmergencyReady(hospital);
  const reportedAt = hospital.general_ward_reported_at
    ? new Date(hospital.general_ward_reported_at)
    : null;
  const reportedDate = reportedAt && !Number.isNaN(reportedAt.getTime())
    ? reportedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;
  const demoForecastAvailable = Number.isFinite(hospital.forecast_available_beds_24h);
  const demoForecastPercent = Number.isFinite(hospital.forecast_vacancy_pct_24h)
    ? hospital.forecast_vacancy_pct_24h
    : null;

  return (
    <div
      onClick={onSelect}
      className={`relative group rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between hover:shadow-lg cursor-pointer ${
        isDarkMode ? 'bg-[#111C2E] text-slate-100' : 'bg-white text-slate-900'
      } ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
          : isInTopN
          ? (isDarkMode ? 'border-slate-700 shadow-sm' : 'border-slate-200 shadow-sm')
          : (isDarkMode ? 'border-slate-700 opacity-90 hover:opacity-100' : 'border-slate-200 opacity-90 hover:opacity-100')
      }`}
    >
      <div>
        <div className={`relative h-40 xl:h-28 w-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <img
            src={heroImage}
            alt={hospital.hospital_name}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80";
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-sm flex items-center gap-1 ${
                isInTopN
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/80 backdrop-blur-sm text-slate-200'
              }`}
            >
              #{isInTopN ? hospital.selection_rank : hospital.rank}
              <span className="text-[10px] font-medium opacity-90">
                {isInTopN ? 'Top N pick' : 'Result'}
              </span>
            </span>
          </div>

          {pmjayEmpanelled && (
            <div className="absolute top-3 right-3 bg-emerald-600/95 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              <IconShield className="w-3.5 h-3.5" />
              PM-JAY
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs bg-slate-900/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl">
            <div className="flex items-center gap-1.5">
              <IconMapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-bold">{distanceLabel}</span>
              <span className="text-slate-300 text-[11px] font-medium">• {etaLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <IconStar className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold">{hospital.rating_5}</span>
              <span className="text-slate-400 text-[10px]">({hospital.review_count || 120})</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 xl:p-2.5 space-y-2.5 xl:space-y-2">
          <div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(hospital);
              }}
              className={`text-left text-base xl:text-sm font-bold group-hover:text-blue-600 transition leading-snug line-clamp-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              {hospital.hospital_name}
            </button>
            <p className={`text-xs mt-1 line-clamp-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{hospital.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 xl:gap-1 text-xs">
            <div className={`p-2 xl:p-1.5 rounded-xl border flex flex-col min-w-0 ${isDarkMode ? 'bg-[#172338] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-[10px] uppercase font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Admission Fee</span>
              <span className={`text-sm xl:text-xs font-extrabold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                {hospital.admission_fee_inr === 0 ? 'FREE / Govt' : `INR ${hospital.admission_fee_inr}`}
              </span>
              <span className={`text-[10px] xl:text-[9px] leading-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {pmjayEmpanelled ? 'PM-JAY cashless eligible' : 'PM-JAY not listed'}
              </span>
            </div>

            <div className={`p-2 xl:p-1.5 rounded-xl border flex flex-col min-w-0 ${isDarkMode ? 'bg-[#172338] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-[10px] xl:text-[9px] uppercase font-semibold leading-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Reported Ward Vacancy</span>
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm xl:text-xs font-extrabold text-emerald-600">
                  {vacancyPercent === null ? '—' : `${vacancyPercent}%`}
                </span>
                <span className={`text-[10px] xl:text-[9px] font-medium truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {hospital.general_ward_available_beds} free
                </span>
              </div>
              <span className={`text-[10px] xl:text-[9px] leading-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {reportedDate ? `Inventory snapshot · ${reportedDate}` : 'Inventory ratio · not a forecast'}
              </span>
            </div>
          </div>

          {hospital.forecast_mode === 'synthetic_demo' && (
            <div className={`rounded-xl border px-2.5 xl:px-2 py-2 xl:py-1.5 text-[10px] xl:text-[9px] leading-snug ${isDarkMode ? 'border-blue-900 bg-blue-950/40 text-slate-200' : 'border-blue-200 bg-blue-50 text-slate-700'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-blue-700 leading-tight">24h Gradient Boosting demo</span>
                <span className="font-semibold text-blue-700 whitespace-nowrap">
                  {demoForecastAvailable ? `${hospital.forecast_available_beds_24h} beds · ${demoForecastPercent}%` : 'Unavailable'}
                </span>
              </div>
              <p className="mt-0.5">Synthetic data · not operational.</p>
            </div>
          )}

          {/* Clean Single-Line Truncated Specialties (Prevents text being vertically sliced) */}
          
          

          {hospital.specialties && (
            <div className={`text-[11px] xl:text-[10px] p-2 xl:p-1.5 rounded-xl border flex items-center gap-1 overflow-hidden ${isDarkMode ? 'bg-[#172338] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`font-bold shrink-0 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>Specialties:</span>
              <span className={isDarkMode ? 'text-slate-300 truncate' : 'text-slate-600 truncate'}>{hospital.specialties.replace(/;/g, ', ')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 xl:p-2.5 pt-0 space-y-2 xl:space-y-1.5">
        <div className="grid grid-cols-2 gap-2 xl:gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestEmergency(hospital);
            }}
            className="w-full text-xs xl:text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-2 xl:py-1.5 px-1 rounded-xl transition flex items-center justify-center gap-1 shadow-sm"
          >
            {emergencyReady ? 'Emergency 24×7' : 'Emergency'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestGeneralWard(hospital);
            }}
            className="w-full text-xs xl:text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 xl:py-1.5 px-1 rounded-xl transition flex items-center justify-center gap-1 shadow-sm"
          >
            <IconBed className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">General Ward</span>
          </button>
        </div>

        {/* Card Footer: View Pin, Official Website Link, and Directions */}
        <div className={`flex items-center justify-between gap-1 pt-1 border-t text-xs xl:text-[10px] ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewOnMap(hospital);
            }}
            className={`hover:text-blue-600 font-medium flex items-center gap-1 transition whitespace-nowrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
          >
            <IconMapPin className="w-3.5 h-3.5" /> View Pin
          </button>

          {webUrl ? (
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`hover:text-blue-600 font-semibold flex items-center gap-0.5 transition whitespace-nowrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
            >
              <span>Website ↗</span>
            </a>
          ) : (
            <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Website unavailable</span>
          )}

          <a
            href={hospital.directions_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition whitespace-nowrap"
          >
            <IconNavigation className="w-3.5 h-3.5" /> Directions
          </a>
        </div>
      </div>
    </div>
  );
}

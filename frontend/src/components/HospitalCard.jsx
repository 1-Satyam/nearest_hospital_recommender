import React from 'react';
import { IconStar, IconMapPin, IconNavigation, IconShield, IconBed, IconPhone } from './Icons';
import { getGeneralWardVacancyPercent, isHospitalEmergencyReady, isHospitalPmjayEmpanelled } from '../utils/hospitalMetrics';
import { getHospitalWebsite } from '../utils/hospitalWebsites';

const fallbackHeroImage = 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80';

export default function HospitalCard({
  hospital,
  isDarkMode,
  isSelected,
  onSelect,
  onRequestEmergency,
  onRequestGeneralWard,
  onViewOnMap
}) {
  const heroImage = hospital.image_hero || 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=600&q=80';
  const distKm = Number(hospital.road_distance_km || hospital.distance_km || 0);
  const etaMins = hospital.eta_minutes || Math.max(3, Math.round(distKm * 2.2));
  const distanceLabel = hospital.is_real_road ? `${distKm} km` : `~${distKm} km`;
  const etaLabel = hospital.is_real_road ? `${etaMins} mins` : `~${etaMins} mins (estimate)`;
  const webUrl = getHospitalWebsite(hospital);
  const vacancyPercent = getGeneralWardVacancyPercent(hospital);
  const pmjayEmpanelled = isHospitalPmjayEmpanelled(hospital);
  const emergencyReady = isHospitalEmergencyReady(hospital);
  const reviewCount = Number(hospital.rating_count ?? hospital.review_count);
  const hasReviewCount = Number.isFinite(reviewCount) && reviewCount > 0;
  const rating = Number(hospital.rating_5 ?? hospital.rating);
  const hasRating = Number.isFinite(rating);
  const admissionFee = Number(hospital.admission_fee_inr ?? hospital.admission_fee);
  const hasAdmissionFee = Number.isFinite(admissionFee);
  const availableBeds = Number(hospital.general_ward_available_beds);
  const hasAvailableBeds = hospital.general_ward_available_beds !== null
    && hospital.general_ward_available_beds !== undefined
    && hospital.general_ward_available_beds !== ''
    && Number.isFinite(availableBeds);
  const phone = typeof hospital.contact_phone === 'string' ? hospital.contact_phone.trim() : '';
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;
  const specialties = String(hospital.specialties || '').replace(/;/g, ', ').trim();
  const cardSurface = isDarkMode ? 'bg-[#111C2E] text-slate-100' : 'bg-white text-slate-900';
  const factSurface = isDarkMode ? 'bg-[#172338] border-slate-700' : 'bg-slate-50 border-slate-200';
  const muted = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const stopCardClick = (event) => event.stopPropagation();

  return (
    <article
      onClick={onSelect}
      className={`group overflow-hidden rounded-[22px] border transition-all duration-200 hover:shadow-lg ${
        cardSurface
      } ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
          : isDarkMode
          ? 'border-slate-700 shadow-sm'
          : 'border-slate-200 shadow-sm'
      }`}
    >
      <div className={`relative h-[200px] w-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <img
          src={heroImage}
          alt={`Photo of ${hospital.hospital_name}`}
          onError={(event) => {
            if (event.currentTarget.src !== fallbackHeroImage) {
              event.currentTarget.src = fallbackHeroImage;
            }
          }}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold leading-tight text-white shadow-sm">
          #{hospital.rank ?? '—'} Result
        </span>

        {pmjayEmpanelled && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold leading-tight text-white shadow-sm">
            <IconShield className="h-3.5 w-3.5" />
            PM-JAY
          </span>
        )}

        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 rounded-[14px] bg-slate-900/90 px-3.5 py-2 text-sm text-white backdrop-blur">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <IconMapPin className="h-4 w-4 shrink-0 text-blue-300" />
            <span className="truncate">
              <b>{distanceLabel}</b> <span className="text-slate-300">· {etaLabel}</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-bold">
            <IconStar className="h-4 w-4 fill-amber-400 text-amber-400" />
            {hasRating ? rating.toFixed(1) : '—'}
            {hasReviewCount && <span className="font-medium text-slate-300">({reviewCount})</span>}
          </span>
        </div>
      </div>

      <div className="grid gap-3.5 p-4">
        <header>
          <button
            type="button"
            onClick={(event) => {
              stopCardClick(event);
              onSelect(hospital);
            }}
            className={`text-left text-xl font-extrabold leading-tight transition hover:text-blue-600 ${
              isDarkMode ? 'text-white' : 'text-blue-700'
            }`}
          >
            {hospital.hospital_name}
          </button>
          <p className={`mt-1 text-sm ${muted}`}>{hospital.address}</p>
        </header>

        <div className="grid grid-cols-2 gap-2.5">
          <div className={`grid min-w-0 content-start gap-0.5 rounded-[14px] border p-2.5 ${factSurface}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Admission Fee</span>
            <span className={`text-lg font-extrabold leading-snug ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              {!hasAdmissionFee ? 'Not listed' : admissionFee === 0 ? 'FREE / Govt' : `INR ${admissionFee.toLocaleString()}`}
            </span>
          </div>

          <div className={`grid min-w-0 content-start gap-0.5 rounded-[14px] border p-2.5 ${factSurface}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Ward Vacancy</span>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-lg font-extrabold leading-snug text-emerald-600">
                {vacancyPercent === null ? '—' : `${vacancyPercent}%`}
              </span>
              <span className={`text-right text-xs ${muted}`}>
                {hasAvailableBeds ? `${availableBeds} beds left` : 'Beds not listed'}
              </span>
            </div>
          </div>
        </div>

        {specialties && (
          <p className={`rounded-[14px] border px-3 py-2.5 text-sm ${factSurface} ${muted}`}>
            <strong className={isDarkMode ? 'text-slate-100' : 'text-slate-900'}>Specialties:</strong>{' '}
            <span>{specialties}</span>
          </p>
        )}

        <div className="grid gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(event) => {
                stopCardClick(event);
                onRequestEmergency(hospital);
              }}
              className={`min-h-12 rounded-[14px] border px-3 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                isDarkMode
                  ? 'border-red-900 bg-red-950/40 text-red-300 hover:bg-red-950/70'
                  : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              {emergencyReady ? 'Emergency 24×7' : 'Emergency'}
            </button>
            <button
              type="button"
              onClick={(event) => {
                stopCardClick(event);
                onRequestGeneralWard(hospital);
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-teal-700 px-3 text-sm font-extrabold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              <IconBed className="h-4 w-4" />
              General Ward
            </button>
          </div>
        </div>

        <nav
          aria-label={`Links for ${hospital.hospital_name}`}
          className={`flex flex-wrap items-center justify-between gap-1 border-t pt-2 ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={(event) => {
              stopCardClick(event);
              onViewOnMap(hospital);
            }}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 text-sm font-semibold transition hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${muted}`}
          >
            <IconMapPin className="h-4 w-4" /> View Pin
          </button>

          {phoneHref ? (
            <a
              href={phoneHref}
              onClick={stopCardClick}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <IconPhone className="h-4 w-4" /> Call
            </a>
          ) : (
            <span className={`px-1.5 text-xs ${muted}`}>Phone unavailable</span>
          )}

          {webUrl ? (
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopCardClick}
              className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-sm font-semibold transition hover:text-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${muted}`}
            >
              Website <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className={`px-1.5 text-xs ${muted}`}>Website unavailable</span>
          )}

          {hospital.directions_url && (
            <a
              href={hospital.directions_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopCardClick}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-1.5 text-sm font-semibold text-teal-700 transition hover:text-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              <IconNavigation className="h-4 w-4" /> Directions
            </a>
          )}
        </nav>
      </div>
    </article>
  );
}

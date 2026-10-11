import React from 'react';
import { HOSPITAL_SORT_DEFAULTS } from '../utils/hospitalSorting';

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended ranking' },
  { value: 'distance', label: 'Road distance' },
  { value: 'fee', label: 'Admission fee' },
  { value: 'ratingReviews', label: 'Rating × reviews' },
  { value: 'vacancy', label: 'Beds available' }
];

const SORT_GOALS = {
  distance: { asc: 'Closest hospitals first', desc: 'Farthest hospitals first' },
  fee: { asc: 'Lowest fees first', desc: 'Highest fees first' },
  ratingReviews: { asc: 'Lower rating × reviews first', desc: 'Higher rating × reviews first' },
  vacancy: { asc: 'Fewer beds available first', desc: 'More beds available first' }
};

export default function TopNSortControls({ sortKey, direction, onSortKeyChange, onDirectionToggle, isDarkMode }) {
  const directionLabel = sortKey === 'recommended'
    ? 'Current recommendation order'
    : SORT_GOALS[sortKey][direction];

  return (
    <section
      aria-label="Choose how top hospitals are selected"
      className={`rounded-2xl border px-4 py-3 shadow-sm ${
        isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE]'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="top-hospital-sort"
            className={`block text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}
          >
            Choose which hospitals appear in Top N
          </label>
          <p className={`mt-0.5 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {sortKey === 'recommended'
              ? 'Keep the app’s recommended order, or choose a factor to prioritize.'
              : `Top N is selected by ${SORT_OPTIONS.find((option) => option.value === sortKey)?.label.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <select
            id="top-hospital-sort"
            value={sortKey}
            onChange={(event) => onSortKeyChange(event.target.value)}
            className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs font-bold outline-none transition focus:ring-2 focus:ring-blue-500 sm:w-56 sm:flex-none ${
              isDarkMode
                ? 'bg-[#0B1220] border-[#334155] text-slate-100'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-slate-800'
            }`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDirectionToggle}
            disabled={sortKey === 'recommended'}
            aria-label={`Change sort direction. Current order: ${directionLabel}`}
            title={directionLabel}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDarkMode
                ? 'border-[#334155] bg-[#1E2B40] text-blue-300 hover:bg-[#293950]'
                : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            {sortKey === 'recommended' ? 'Recommended' : SORT_GOALS[sortKey][direction]}
          </button>
        </div>
      </div>
    </section>
  );
}

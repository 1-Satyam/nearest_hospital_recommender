import React from 'react';

export default function TopNSlider({ topN, setTopN, totalCount = 10, isDarkMode }) {
  const maxTopN = Math.min(10, totalCount || 10);
  const rangePercent = maxTopN > 1 ? ((topN - 1) / (maxTopN - 1)) * 100 : 100;
  const trackColor = isDarkMode ? '#1e293b' : '#e7e5e4';

  return (
    <div className={`p-4 rounded-3xl border transition-colors ${
      isDarkMode ? 'bg-[#111C2E] border-[#29364A]' : 'bg-white border-[#D8E1EE] shadow-sm'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">
              Hospital Recommendations
            </h4>
            <span className="bg-blue-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-lg shadow-sm">
              Top {topN}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Choose how many hospitals to show in the list and on the map. There are {totalCount} hospitals to choose from.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {[2, 3, 5, 10].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setTopN(num)}
              aria-pressed={topN === num}
              className={`text-xs px-2.5 py-1 rounded-xl font-bold transition ${
                topN === num
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDarkMode
                  ? 'bg-[#1E2B40] text-slate-200 hover:bg-[#293950]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Top {num}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-stone-400">1</span>
        <input
          type="range"
          aria-label="Number of top hospital recommendations"
          aria-valuetext={`Top ${topN} recommendations`}
          min="1"
          max={maxTopN}
          value={topN}
          onChange={(e) => setTopN(parseInt(e.target.value, 10))}
          style={{
            background: `linear-gradient(to right, #2563eb 0%, #2563eb ${rangePercent}%, ${trackColor} ${rangePercent}%, ${trackColor} 100%)`
          }}
          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <span className="text-xs font-bold text-stone-400">{maxTopN}</span>
      </div>
    </div>
  );
}

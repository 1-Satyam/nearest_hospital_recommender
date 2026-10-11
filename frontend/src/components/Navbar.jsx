import React from 'react';
import { IconHospital, IconPhone, IconMapPin, IconShield, IconDatabase, IconArrowRight, IconSun, IconMoon, IconMenu } from './Icons';

export default function Navbar({
  user,
  onOpenAuth,
  onLogout,
  userLocation,
  onOpenLocationModal,
  activeTab,
  setActiveTab,
  onToggleSidebar,
  activeHoldPass,
  onViewActiveHold,
  isDarkMode,
  onToggleTheme
, onOpenProfile}) {
  return (
    <header className={`sticky top-0 z-30 border-b shadow-sm transition-colors ${
      isDarkMode ? 'bg-[#111C2E] border-[#29364A] text-slate-100' : 'bg-white border-[#D8E1EE] text-slate-900'
    }`}>
      {/* 1. Critical Hotline Banner */}
      {activeHoldPass?.status === 'HELD' ? (
        <div className="bg-amber-600 text-white text-xs sm:text-sm py-1.5 px-3 sm:px-4 font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <span className="animate-pulse bg-white text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
              HOLD ACTIVE
            </span>
            <span className="truncate text-xs">{activeHoldPass.hospital_name || 'Hospital'} | Bed: <b className="font-mono">{activeHoldPass.bed_unit_id}</b></span>
          </div>
          <button
            onClick={onViewActiveHold}
            className="bg-white text-amber-800 text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-amber-50 flex items-center gap-1 shadow-sm shrink-0"
          >
            <span>Hold Pass</span>
            <IconArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-red-600 text-white text-xs py-1 px-3 sm:px-4 font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <span className="animate-pulse bg-white text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded tracking-wide uppercase">Critical</span>
            <span className="hidden sm:inline font-bold">Emergency Hotlines:</span>
            <a href="tel:108" className="font-bold underline hover:text-red-100 flex items-center gap-1">
              <IconPhone className="w-3.5 h-3.5 inline" /> 108 (Ambulance)
            </a>
            <span className="hidden sm:inline font-bold">|</span>
            <a href="tel:112" className="hidden sm:inline font-bold underline hover:text-red-100">
              112 (Helpline)
            </a>
          </div>
          <span className="text-[11px] opacity-90 hidden md:inline font-medium">Bhubaneswar 24x7 Emergency Bed Registry</span>
        </div>
      )}

      {/* 2. Bhubaneswar Bed Registry (Restored on Top Part) */}
      <div className={`text-[11px] py-1.5 px-4 border-b overflow-x-auto no-scrollbar transition-colors ${
        isDarkMode ? 'bg-[#0F192A] border-[#29364A] text-slate-200' : 'bg-slate-50 border-[#D8E1EE] text-slate-700'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between whitespace-nowrap min-w-max">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px]">Bhubaneswar Bed Registry:</span>
            <span>Coverage: <b className={isDarkMode ? 'text-white' : 'text-stone-900'}>21 Hospitals</b></span>
            <span className="text-stone-400">&bull;</span>
            <span>Emergency: <b className="text-emerald-600 dark:text-emerald-400">84 Live</b></span>
            <span className="text-stone-400">&bull;</span>
            <span>General Ward: <b className="text-blue-600 dark:text-blue-400">809 Free</b></span>
            <span className="text-stone-400">&bull;</span>
            <span>PM-JAY: <b className="text-amber-600 dark:text-amber-400">17 Empanelled</b></span>
          </div>
          <div className="hidden sm:flex items-center space-x-2 pl-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-mono text-[10px] text-stone-500 dark:text-stone-400">Two-Phase Lock Protocol Active</span>
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 sm:h-16 gap-2">
          {/* Left: Hamburger Button + ArogyaSetu Logo */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5">
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-xl border transition-all ${
                isDarkMode 
                  ? 'bg-[#1E2B40] border-[#334155] text-white hover:bg-[#293950]' 
                  : 'bg-slate-50 border-[#CBD5E1] text-slate-900 hover:bg-slate-100'
              }`}
              title="Open Navigation Dashboard"
              aria-label="Open Navigation Dashboard"
            >
              <IconMenu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </button>

            <div 
              className="flex items-center space-x-2.5 cursor-pointer" 
              onClick={() => setActiveTab('gateway')}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <IconHospital className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className={`font-extrabold text-lg sm:text-xl tracking-tight leading-none ${
                    isDarkMode ? 'text-white' : 'text-[#1C1917]'
                  }`}>
                    Arogya<span className="text-blue-600 font-extrabold">Setu</span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    BBSR
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 tracking-wider mt-0.5 hidden sm:block">
                  Bhubaneswar Healthcare Network
                </span>
              </div>
            </div>
          </div>

          {/* Right: Origin Location, Day/Night Squircle, Sign In */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={onOpenLocationModal}
              className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                userLocation?.isLiveGPS
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20'
                  : isDarkMode
                  ? 'bg-[#222226] border-[#333338] text-[#F4F4F6] hover:bg-[#2B2C30]'
                  : 'bg-[#F2EFE9] border-[#DFDBD0] text-[#1C1917] hover:bg-[#EBE7DC]'
              }`}
              title="Click to view or change your location"
            >
              <div className="relative flex items-center justify-center">
                <IconMapPin className="w-3.5 h-3.5 text-blue-600" />
                {userLocation?.isLiveGPS && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                )}
              </div>
              <span className="max-w-[100px] sm:max-w-[150px] truncate">{userLocation?.name || 'Set Location'}</span>
              <span className="text-[10px] text-stone-400">&#9662;</span>
            </button>

            <button
              onClick={onToggleTheme}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border shrink-0 ${
                isDarkMode 
                  ? 'bg-amber-400/10 border-amber-400/30 text-amber-300 hover:bg-amber-400/20 shadow-sm' 
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 shadow-sm'
              }`}
              title={isDarkMode ? "Dark Mode Active: Tap for Light Mode" : "Light Mode Active: Tap for Dark Mode"}
            >
              {isDarkMode ? <IconSun className="w-4 h-4 text-amber-300" /> : <IconMoon className="w-4 h-4 text-stone-700" />}
            </button>

            {user ? (
              <div className="flex items-center space-x-1.5 shrink-0">
                <div className="text-right hidden sm:block" onClick={onOpenProfile} style={{ cursor: "pointer" }} title="Click to view Ramesh Profile & PM-JAY Card">
                  <div className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-[#1C1917]'}`}>{user.name}</div>
                  <div className="text-[10px] text-emerald-500 font-semibold">{user.has_pmjay ? 'PM-JAY' : 'Standard'}</div>
                </div>
                <button
                  onClick={onLogout}
                  className={`text-xs px-2 py-1.5 rounded-lg border ${
                    isDarkMode ? 'bg-[#1E2B40] border-[#334155] text-slate-200' : 'bg-slate-50 border-[#CBD5E1] text-slate-700'
                  }`}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl shadow-sm transition shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

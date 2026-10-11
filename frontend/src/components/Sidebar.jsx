import React from 'react';
import { IconHospital, IconDatabase, IconBed } from './Icons';
import ArogyaLogo from './ArogyaLogo';

export default function Sidebar({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  user,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  isDarkMode
}) {
  const navItems = [
    { 
      id: 'gateway', 
      label: 'Bed Need Gateway', 
      icon: IconBed, 
      desc: 'Emergency vs General Triage' 
    },
    { 
      id: 'explore', 
      label: 'Hospitals & Live Map', 
      icon: IconHospital, 
      desc: 'All 21 institutions & map view' 
    },
    { 
      id: 'table', 
      label: 'Comparison Matrix', 
      icon: IconDatabase, 
      desc: 'Ranked comparison matrix' 
    }
  ];

  const isSignedIn = Boolean(user);
  const userName = user?.name || 'Guest';
  const userScheme = user?.has_pmjay ? 'PM-JAY' : 'Standard';
  const userPhone = user?.mobile || 'Not signed in';

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* 2. Cascading Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-80 max-w-[85vw] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out transform border-r ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDarkMode 
            ? 'bg-[#141416] border-[#2D2D34] text-[#F4F4F6]' 
            : 'bg-white border-[#CBD5E1] text-[#0F172A]'
        }`}
      >
        {/* Drawer Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-[#18181B] border-[#2D2D34]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shadow-md">
              <ArogyaLogo className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`font-black text-base leading-tight ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                  Arogya
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                  isDarkMode ? 'bg-blue-900/60 text-blue-200' : 'bg-blue-100 text-blue-800'
                }`}>
                  BBSR
                </span>
              </div>
              <p className={`text-[11px] font-bold mt-0.5 ${isDarkMode ? 'text-stone-400' : 'text-slate-500'}`}>
                Navigation & Hospital Dashboard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDarkMode 
                ? 'text-stone-400 hover:text-white hover:bg-[#25252A]' 
                : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-100'
            }`}
            title="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Tabs (Encircled Area) */}
        <div className="flex-1 px-4 py-5 space-y-2.5 overflow-y-auto">
          <span className={`text-[11px] font-black uppercase px-2 tracking-wider block mb-2 ${
            isDarkMode ? 'text-stone-400' : 'text-slate-500'
          }`}>
            Main Portals
          </span>

          {navItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all text-left cursor-pointer border ${
                  isActive
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-500/40'
                    : isDarkMode
                    ? 'bg-[#1A1A1E] border-[#2D2D34] text-white hover:bg-[#25252A] hover:border-stone-600'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A] hover:bg-[#EDF2F7] hover:border-[#CBD5E1]'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isDarkMode
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`font-black text-sm leading-tight truncate ${
                    isActive 
                      ? 'text-white' 
                      : isDarkMode 
                      ? 'text-white' 
                      : 'text-[#0F172A]'
                  }`}>
                    {item.label}
                  </div>
                  <div className={`text-xs mt-0.5 font-bold truncate ${
                    isActive 
                      ? 'text-blue-100' 
                      : isDarkMode 
                      ? 'text-stone-400' 
                      : 'text-[#475569]'
                  }`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Citizen Profile Card */}
        <div className={`p-4 m-4 rounded-3xl border shadow-sm ${
          isDarkMode ? 'bg-[#18181B] border-[#2D2D34]' : 'bg-[#F8FAFC] border-[#CBD5E1]'
        }`}>
          <div
            onClick={() => {
              if (isSignedIn) {
                if (onOpenProfile) onOpenProfile();
              } else if (onOpenAuth) {
                onOpenAuth();
              }
              onClose();
            }}
            className="flex items-center gap-3 cursor-pointer group"
            title={isSignedIn ? 'View or edit your health account' : 'Sign in to your health account'}
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white font-black text-base shadow-md group-hover:scale-105 transition-transform">
              {userName.charAt(0)}
            </div>

            <div className="flex-1 truncate">
              <div className="flex items-center gap-1.5">
                <span className={`font-black text-sm truncate ${isDarkMode ? 'text-white' : 'text-[#0F172A]'}`}>
                  {userName}
                </span>
                {isSignedIn && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    user?.has_pmjay
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}>
                  {userScheme}
                  </span>
                )}
              </div>
              <p className={`text-xs font-bold mt-0.5 truncate font-mono ${
                isDarkMode ? 'text-stone-400' : 'text-[#475569]'
              }`}>
                {userPhone}
              </p>
            </div>
          </div>

          {isSignedIn ? (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  if (onOpenProfile) onOpenProfile();
                  onClose();
                }}
                className="bg-[#0F172A] hover:bg-slate-800 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>Health Account</span>
                <span className="text-xs font-black">&rarr;</span>
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs py-2.5 rounded-xl transition cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onOpenAuth) onOpenAuth();
                onClose();
              }}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              Sign In / Create Account
              <span className="text-xs font-black">&rarr;</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

import React, { useState } from 'react';
import { IconCross, IconShield } from './Icons';

export default function AuthModal({ onClose, onAuthSuccess, isDarkMode }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [hasPmjay, setHasPmjay] = useState(false);
  const [pmjayCardNumber, setPmjayCardNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const bodyData = isLogin
      ? { mobile, password }
      : {
          name,
          mobile,
          password,
          email: email || undefined,
          has_pmjay: hasPmjay,
          pmjay_card_number: hasPmjay ? pmjayCardNumber : undefined
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authentication failed');

      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border transition-all ${
          isDarkMode ? 'bg-[#1E1E22] border-[#2D2D34] text-[#F4F4F6]' : 'bg-white border-[#E7E4DC] text-[#1C1917]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 border-b flex items-center justify-between ${
          isDarkMode ? 'border-[#2D2D34] bg-[#141416]' : 'border-[#E7E4DC] bg-[#FAF8F5]'
        }`}>
          <div>
            <h3 className="text-xl font-bold">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {isLogin ? 'Access your bed requests & holds' : 'Register for Bhubaneswar hospital services'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-600">
            <IconCross className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold mb-1 text-stone-500 dark:text-stone-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Mohapatra"
                  className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                  }`}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-500 dark:text-stone-400">Mobile Number</label>
              <input
                type="tel"
                required
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit mobile number"
                className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-stone-500 dark:text-stone-400">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                }`}
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-bold mb-1 text-stone-500 dark:text-stone-400">Email (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode ? 'bg-[#141416] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                    }`}
                  />
                </div>

                <div className={`p-3.5 rounded-2xl border space-y-2 ${
                  isDarkMode ? 'bg-[#141416] border-[#2D2D34]' : 'bg-[#FAF8F5] border-[#E7E4DC]'
                }`}>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPmjay}
                      onChange={(e) => setHasPmjay(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold flex items-center gap-1">
                      <IconShield className="w-3.5 h-3.5 text-emerald-600" />
                      I hold a PM-JAY / Ayushman Card
                    </span>
                  </label>

                  {hasPmjay && (
                    <div className="pt-2">
                      <input
                        type="text"
                        value={pmjayCardNumber}
                        onChange={(e) => setPmjayCardNumber(e.target.value)}
                        placeholder="Enter Ayushman Card / Beneficiary ID"
                        className={`w-full text-xs px-3 py-2 rounded-xl border ${
                          isDarkMode ? 'bg-[#1E1E22] border-[#2D2D34] text-white' : 'bg-white border-[#DCD7CB] text-stone-900'
                        }`}
                      />
                      <p className="text-[10px] text-stone-400 mt-1 italic">
                        * Note: Stored for admissions preferences.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-md shadow-blue-500/20"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg('');
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already registered? Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

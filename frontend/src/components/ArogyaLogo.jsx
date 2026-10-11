import React from 'react';

export default function ArogyaLogo({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path
        d="M60 6C37 6 20 24 20 46c0 29 40 66 40 66s40-37 40-66C100 24 83 6 60 6Z"
        fill="#0FA37A"
      />
      <polyline
        points="34,48 47,48 54,32 64,64 71,48 86,48"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

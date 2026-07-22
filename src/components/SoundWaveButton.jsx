// src/components/SoundWaveButton.jsx
import React, { useState } from 'react';

export default function SoundWaveButton({ 
  onClick, 
  className = '', 
  size = 'medium', // 支持 'small' | 'medium' | 'large'
  variant = 'default'
}) {
  const [isRippling, setIsRippling] = useState(false);

  const handleClick = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsRippling(true);
    setTimeout(() => setIsRippling(false), 1200);
    if (onClick) onClick(e);
  };

  const sizeClasses = {
    small: 'w-10 h-7 sm:w-12 sm:h-8 px-1',
    medium: 'w-16 h-9 sm:w-20 sm:h-11 px-2',
    large: 'w-48 sm:w-64 h-16 sm:h-20 px-4'
  }[size] || 'w-16 h-9 px-2';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative rounded-full bg-white border border-[#E8E4DC] shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center overflow-hidden shrink-0 select-none group ${sizeClasses} ${className}`}
    >
      {/* 🌟 核心：注入 Siri 风彩色声波交织动画 Keyframes */}
      <style>{`
        @keyframes siriWave1 {
          0%, 100% { transform: scaleY(0.5) translateY(0px); }
          50% { transform: scaleY(1.4) translateY(-2px); }
        }
        @keyframes siriWave2 {
          0%, 100% { transform: scaleY(0.7) translateY(0px); }
          50% { transform: scaleY(1.6) translateY(2px); }
        }
        @keyframes siriWave3 {
          0%, 100% { transform: scaleY(0.4) translateY(0px); }
          50% { transform: scaleY(1.3) translateY(-1px); }
        }
        .wave-act-1 { animation: siriWave1 0.6s infinite ease-in-out; }
        .wave-act-2 { animation: siriWave2 0.7s infinite ease-in-out; }
        .wave-act-3 { animation: siriWave3 0.5s infinite ease-in-out; }
      `}</style>

      {/* 🌟 核心：三条横向交织的彩色正弦波浪线 */}
      <div className="w-full h-full flex items-center justify-center relative">
        <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible">
          {/* 1. 主色绿线条 (#A3C9B8) */}
          <path
            d="M 0 30 Q 50 10, 100 30 T 200 30"
            fill="none"
            stroke="#A3C9B8"
            strokeWidth="5"
            strokeLinecap="round"
            className={`transition-all duration-300 ${isRippling ? 'wave-act-1 stroke-[7]' : 'opacity-70'}`}
          />
          {/* 2. 暖阳黄线条 (#FBBF24) */}
          <path
            d="M 0 30 Q 50 50, 100 30 T 200 30"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="4.5"
            strokeLinecap="round"
            className={`transition-all duration-300 ${isRippling ? 'wave-act-2 stroke-[6]' : 'opacity-60'}`}
          />
          {/* 3. 珊瑚粉线条 (#F43F5E) */}
          <path
            d="M 0 30 Q 50 20, 100 40 T 200 30"
            fill="none"
            stroke="#F43F5E"
            strokeWidth="4"
            strokeLinecap="round"
            className={`transition-all duration-300 ${isRippling ? 'wave-act-3 stroke-[5.5]' : 'opacity-50'}`}
          />
        </svg>
      </div>
    </button>
  );
}
// src/components/SoundWaveButton.jsx
import React, { useState, useEffect } from 'react';

export default function SoundWaveButton({ 
  onClick, 
  className = '', 
  size = 'medium', // 支持 'small' | 'medium' | 'large'
  isSpeaking = false // 来自全局发音引擎的真实同步状态
}) {
  const [waveState, setWaveState] = useState('idle'); // 'idle' | 'active' | 'fading'

  useEffect(() => {
    if (isSpeaking) {
      setWaveState('active');
    } else if (waveState === 'active') {
      setWaveState('fading');
      const timer = setTimeout(() => setWaveState('idle'), 800);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking]);

  const sizeClasses = {
    small: 'w-9 h-7 sm:w-11 sm:h-8 px-1',
    medium: 'w-14 h-9 sm:w-18 sm:h-10 px-2',
    large: 'w-48 sm:w-60 h-14 sm:h-18 px-3'
  }[size] || 'w-14 h-9 px-2';

  // 🌟 提升显色与粗细：静止时从 1.2px 提至 2px，大幅提升清晰度
  const strokeClass = {
    active: size === 'large' ? 'stroke-[3.5px]' : 'stroke-[2.5px]',
    fading: size === 'large' ? 'stroke-[2.2px]' : 'stroke-[1.8px]',
    idle: 'stroke-[2px]'
  }[waveState];

  // 🌟 提升透明度：静止时从 35% 提升至 85%，显色高对比
  const opacityClass = {
    active: 'opacity-100 transition-opacity duration-300 ease-in',
    fading: 'opacity-70 transition-all duration-800 ease-out',
    idle: 'opacity-85 transition-all duration-800 ease-out'
  }[waveState];

  return (
    <button
      type="button"
      onClick={(e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (onClick) onClick(e);
      }}
      className={`relative rounded-full bg-[#EFECE4] border border-[#DCD6CA] shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center overflow-hidden shrink-0 select-none group ${sizeClasses} ${className}`}
    >
      <style>{`
        @keyframes pitchWave1 {
          0% { transform: translateX(0px) scaleY(0.5); }
          25% { transform: translateX(-25px) scaleY(1.6); }
          50% { transform: translateX(-50px) scaleY(0.7); }
          75% { transform: translateX(-75px) scaleY(1.4); }
          100% { transform: translateX(-100px) scaleY(0.5); }
        }
        @keyframes pitchWave2 {
          0% { transform: translateX(-100px) scaleY(0.7); }
          33% { transform: translateX(-66px) scaleY(1.3); }
          66% { transform: translateX(-33px) scaleY(0.6); }
          100% { transform: translateX(0px) scaleY(0.7); }
        }
        @keyframes pitchWave3 {
          0% { transform: translateX(0px) scaleY(0.4); }
          50% { transform: translateX(-40px) scaleY(1.7); }
          100% { transform: translateX(-80px) scaleY(0.4); }
        }

        .wave-pitch-1 { animation: pitchWave1 0.75s infinite ease-in-out; }
        .wave-pitch-2 { animation: pitchWave2 0.95s infinite ease-in-out; }
        .wave-pitch-3 { animation: pitchWave3 0.65s infinite ease-in-out; }

        .wave-idle-1 { animation: pitchWave1 4.0s infinite linear; }
        .wave-idle-2 { animation: pitchWave2 4.5s infinite linear; }
        .wave-idle-3 { animation: pitchWave3 3.5s infinite linear; }
      `}</style>

      <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 300 60" className="w-[150%] h-full shrink-0 overflow-visible">
          {/* 1. 高频主色绿 */}
          <path
            d="M 0 30 Q 25 10, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#4A9A74"
            strokeLinecap="round"
            className={`origin-center ${waveState === 'active' ? 'wave-pitch-1' : 'wave-idle-1'} ${strokeClass} ${opacityClass}`}
          />
          {/* 2. 中频暖阳黄 */}
          <path
            d="M 0 30 Q 25 50, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#D4A017"
            strokeLinecap="round"
            className={`origin-center ${waveState === 'active' ? 'wave-pitch-2' : 'wave-idle-2'} ${strokeClass} ${opacityClass}`}
          />
          {/* 3. 低频静谧天蓝 */}
          <path
            d="M 0 30 Q 25 20, 50 40 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#38BDF8"
            strokeLinecap="round"
            className={`origin-center ${waveState === 'active' ? 'wave-pitch-3' : 'wave-idle-3'} ${strokeClass} ${opacityClass}`}
          />
        </svg>
      </div>
    </button>
  );
}
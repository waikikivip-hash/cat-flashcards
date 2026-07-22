// src/components/SoundWaveButton.jsx
import React, { useState, useEffect } from 'react';

export default function SoundWaveButton({ 
  onClick, 
  className = '', 
  size = 'medium', // 支持 'small' | 'medium' | 'large'
  isSpeaking = false // 🌟 来自全局发音引擎的真实同步状态
}) {
  const [waveState, setWaveState] = useState('idle'); // 'idle' | 'active' | 'fading'

  useEffect(() => {
    if (isSpeaking) {
      setWaveState('active');
    } else if (waveState === 'active') {
      // 🌟 核心：声音停止时，进入 700ms 的余波平息衰减过程，平滑渐变缩回
      setWaveState('fading');
      const timer = setTimeout(() => {
        setWaveState('idle');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking]);

  const sizeClasses = {
    small: 'w-10 h-7 sm:w-12 sm:h-8 px-1',
    medium: 'w-16 h-9 sm:w-20 sm:h-11 px-2',
    large: 'w-48 sm:w-64 h-16 sm:h-20 px-4'
  }[size] || 'w-16 h-9 px-2';

  // 🌟 核心：控制 3 种状态下的线条粗细与透明度渐变
  const getLineStyle = (activeStroke, fadingStroke, idleStroke) => {
    if (waveState === 'active') return `${activeStroke} opacity-90`;
    if (waveState === 'fading') return `${fadingStroke} opacity-60 transition-all duration-700 ease-out`;
    return `${idleStroke} opacity-40 transition-all duration-700 ease-out`;
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (onClick) onClick(e);
      }}
      className={`relative rounded-full bg-white border border-[#E8E4DC] shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center overflow-hidden shrink-0 select-none group ${sizeClasses} ${className}`}
    >
      <style>{`
        @keyframes siriFlow1 {
          0% { transform: translateX(0px) scaleY(0.6); }
          50% { transform: translateX(-50px) scaleY(1.3); }
          100% { transform: translateX(-100px) scaleY(0.6); }
        }
        @keyframes siriFlow2 {
          0% { transform: translateX(-100px) scaleY(0.5); }
          50% { transform: translateX(-50px) scaleY(1.5); }
          100% { transform: translateX(0px) scaleY(0.5); }
        }
        @keyframes siriFlow3 {
          0% { transform: translateX(0px) scaleY(0.4); }
          50% { transform: translateX(-40px) scaleY(1.2); }
          100% { transform: translateX(-80px) scaleY(0.4); }
        }

        .wave-act-1 { animation: siriFlow1 0.7s infinite linear; }
        .wave-act-2 { animation: siriFlow2 0.9s infinite linear; }
        .wave-act-3 { animation: siriFlow3 0.6s infinite linear; }

        .wave-idle-1 { animation: siriFlow1 3.5s infinite linear; }
        .wave-idle-2 { animation: siriFlow2 4.0s infinite linear; }
        .wave-idle-3 { animation: siriFlow3 3.0s infinite linear; }
      `}</style>

      <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 300 60" className="w-[150%] h-full shrink-0 overflow-visible">
          {/* 1. 主色绿 (#A3C9B8) */}
          <path
            d="M 0 30 Q 25 10, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#A3C9B8"
            strokeLinecap="round"
            className={`origin-center ${waveState === 'active' ? 'wave-act-1' : 'wave-idle-1'} ${getLineStyle('stroke-[3.5px]', 'stroke-[2px]', 'stroke-[1.5px]')}`}
          />
          {/* 2. 暖阳黄 (#F3C98B) */}
          <path
            d="M 0 30 Q 25 50, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#F3C98B"
            strokeLinecap="round"
            className={`origin-center ${waveState === 'active' ? 'wave-act-2' : 'wave-idle-2'} ${getLineStyle('stroke-[3px]', 'stroke-[1.8px]', 'stroke-[1.2px]')}`}
          />
          {/* 3. 替换刺眼红线为：静谧天蓝 (#8ECAE6) */}
          <path
            d="M 0 30 Q 25 20, 50 40 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#8ECAE6"
            strokeLinecap="round"
            className={`origin-center ${waveState === 'active' ? 'wave-act-3' : 'wave-idle-3'} ${getLineStyle('stroke-[2.8px]', 'stroke-[1.5px]', 'stroke-[1px]')}`}
          />
        </svg>
      </div>
    </button>
  );
}
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
      {/* 🌟 核心：X轴横向流动 + Y轴振幅双重 keyframe 动画 */}
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

        /* 激活状态：快速流体奔涌 */
        .wave-act-1 { animation: siriFlow1 0.8s infinite linear; }
        .wave-act-2 { animation: siriFlow2 1.0s infinite linear; }
        .wave-act-3 { animation: siriFlow3 0.7s infinite linear; }

        /* 未激活状态：极其平缓的慢速流动 */
        .wave-idle-1 { animation: siriFlow1 3.5s infinite linear; }
        .wave-idle-2 { animation: siriFlow2 4.0s infinite linear; }
        .wave-idle-3 { animation: siriFlow3 3.0s infinite linear; }
      `}</style>

      {/* 🌟 核心：超长连续正弦波浪（宽 400px，确保平移时不露馅） */}
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 300 60" className="w-[150%] h-full shrink-0 overflow-visible">
          {/* 1. 主色绿 */}
          <path
            d="M 0 30 Q 25 10, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#A3C9B8"
            strokeWidth="5"
            strokeLinecap="round"
            className={`transition-all duration-300 origin-center ${isRippling ? 'wave-act-1 stroke-[7]' : 'wave-idle-1 opacity-60'}`}
          />
          {/* 2. 暖阳黄 */}
          <path
            d="M 0 30 Q 25 50, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#FBBF24"
            strokeWidth="4.5"
            strokeLinecap="round"
            className={`transition-all duration-300 origin-center ${isRippling ? 'wave-act-2 stroke-[6]' : 'wave-idle-2 opacity-50'}`}
          />
          {/* 3. 珊瑚粉 */}
          <path
            d="M 0 30 Q 25 20, 50 40 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30"
            fill="none"
            stroke="#F43F5E"
            strokeWidth="4"
            strokeLinecap="round"
            className={`transition-all duration-300 origin-center ${isRippling ? 'wave-act-3 stroke-[5.5]' : 'wave-idle-3 opacity-40'}`}
          />
        </svg>
      </div>
    </button>
  );
}
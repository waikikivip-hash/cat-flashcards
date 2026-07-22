// src/components/SoundWaveButton.jsx
import React, { useState } from 'react';

export default function SoundWaveButton({ 
  onClick, 
  className = '', 
  size = 'medium', // 支持 'small' | 'medium' | 'large'
  variant = 'default' // 'default' | 'primary'
}) {
  const [isRippling, setIsRippling] = useState(false);

  const handleClick = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsRippling(true);
    setTimeout(() => setIsRippling(false), 800);
    if (onClick) onClick(e);
  };

  const sizeClasses = {
    small: 'w-7 h-7 sm:w-8 sm:h-8',
    medium: 'w-10 h-10 sm:w-12 sm:h-12',
    large: 'w-20 h-20 sm:w-24 sm:h-24'
  }[size] || 'w-10 h-10';

  const barWidthClass = {
    small: 'w-0.5',
    medium: 'w-1',
    large: 'w-1.5 sm:w-2'
  }[size] || 'w-1';

  const bgClasses = variant === 'primary' 
    ? 'bg-[#A3C9B8] text-[#2D4A3E] hover:bg-[#8FBBAA] shadow-[0_4px_0_#7eb5af]' 
    : 'bg-[#EBF5F0] text-[#4A9A74] hover:bg-[#D5EAE2] shadow-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative rounded-full flex items-center justify-center transition-transform active:scale-90 shrink-0 select-none ${bgClasses} ${sizeClasses} ${className}`}
    >
      {/* 🌟 核心：按上去触发的向外扩散波纹光环 */}
      {isRippling && (
        <>
          <span className="absolute inset-0 rounded-full bg-[#A3C9B8] opacity-60 animate-ping pointer-events-none" />
          <span className="absolute -inset-2 rounded-full border-2 border-[#A3C9B8]/50 animate-pulse pointer-events-none" />
        </>
      )}

      {/* 🌟 核心：动态跳动的声波频柱 */}
      <div className="flex items-center justify-center gap-0.5 sm:gap-1 h-1/2 z-10 pointer-events-none">
        <span 
          className={`${barWidthClass} bg-current rounded-full transition-all duration-200 ${isRippling ? 'h-full animate-bounce' : 'h-2 sm:h-3'}`} 
          style={{ animationDelay: '0ms' }}
        />
        <span 
          className={`${barWidthClass} bg-current rounded-full transition-all duration-200 ${isRippling ? 'h-3/4 animate-bounce' : 'h-4 sm:h-5'}`} 
          style={{ animationDelay: '150ms' }}
        />
        <span 
          className={`${barWidthClass} bg-current rounded-full transition-all duration-200 ${isRippling ? 'h-full animate-bounce' : 'h-3 sm:h-4'}`} 
          style={{ animationDelay: '300ms' }}
        />
        <span 
          className={`${barWidthClass} bg-current rounded-full transition-all duration-200 ${isRippling ? 'h-1/2 animate-bounce' : 'h-2 sm:h-2.5'}`} 
          style={{ animationDelay: '100ms' }}
        />
      </div>
    </button>
  );
}
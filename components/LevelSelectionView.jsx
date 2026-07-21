import React from 'react';

export default function LevelSelectionView({ availableLevels, allCards, onSelectLevel, onGoHome }) {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#f4f1ea] flex flex-col items-center justify-center p-6 font-sans text-slate-700 overflow-hidden">
      <div className="w-full max-w-2xl text-center mb-6 mt-10">
        <h2 className="text-xl font-bold text-gray-800 mb-2">🏰 请选择你今日要挑战的「级别之门」</h2>
        <p className="text-xs text-gray-400">推开对应的大门，解锁专属的词汇领域：</p>
      </div>
      <div className="flex flex-wrap justify-center gap-6 w-full max-w-3xl px-2 mb-12">
        {availableLevels.map((lvl) => {
          const count = allCards.filter((c) => c.level === lvl).length;
          return (
            <div 
              key={lvl} onClick={() => onSelectLevel(lvl)} 
              className="bg-white rounded-t-full rounded-b-2xl shadow-sm border border-gray-50 w-36 sm:w-44 py-10 flex flex-col items-center cursor-pointer hover:-translate-y-2 transition-transform"
            >
              <div className="text-4xl mb-4">🚪</div>
              <h3 className="text-2xl font-bold text-gray-800">{lvl}</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-6">Level Door</p>
              <div className="bg-[#F0F4F8] text-[#5C728A] text-xs px-3 py-1 rounded-full font-medium">剩余 {count} 词</div>
            </div>
          );
        })}
      </div>
      <button onClick={onGoHome} className="text-gray-400 text-sm flex items-center gap-2 hover:text-gray-600 transition-colors pb-10">
        🔙 返回开饭签到处
      </button>
    </div>
  );
}
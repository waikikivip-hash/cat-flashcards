import React from 'react';

export default function CategorySelectionView({ selectedLevel, availableCategories, allCards, onSelectCategory, onGoBack }) {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#f4f1ea] flex flex-col items-center justify-center p-6 font-sans text-slate-700 overflow-hidden">
      <div className="bg-white rounded-[32px] shadow-sm p-8 w-full max-w-md text-center border border-[#e8e4dc]">
        <div className="text-4xl mb-3">🍗</div>
        <h2 className="text-xl font-bold text-gray-800 tracking-wide">级别 {selectedLevel} 传送成功</h2>
        <p className="text-xs font-bold text-[#a4d5cf] mt-1">✨ 请选择你想要的分类吧：</p>
        
        <div className="my-6 flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
          <button 
            onClick={() => onSelectCategory('All')}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-100 hover:border-[#a4d5cf] font-bold py-3.5 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center shadow-sm"
          >
            <span>📦 学习全部主题</span>
            <span className="text-xs text-slate-400 font-mono">共 {allCards.filter(c => c.level === selectedLevel).length} 词</span>
          </button>

          {availableCategories.map((cat, idx) => {
            const count = allCards.filter(c => c.level === selectedLevel && c.category === cat).length;
            return (
              <button 
                key={idx} onClick={() => onSelectCategory(cat)}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-100 hover:border-[#a4d5cf] font-bold py-3.5 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center shadow-sm"
              >
                <span>🗂️ {cat}</span>
                <span className="text-xs text-[#a4d5cf] font-bold">{count} 词 →</span>
              </button>
            );
          })}
        </div>
        <button onClick={onGoBack} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
          🔙 返回更换级别大门
        </button>
      </div>
    </div>
  );
}
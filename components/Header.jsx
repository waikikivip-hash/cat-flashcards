import React from 'react';

export default function Header({ selectedLevel, selectedCategory, activeTab, rawCardsCount, onNavHome, onNavFlashcard, onNavDictation, onNavLibrary }) {
  return (
    <header className="w-full max-w-4xl flex justify-between items-center mb-6 sm:mb-8 shrink-0 px-2 sm:px-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="text-3xl cursor-pointer hover:scale-110 transition-transform select-none" onClick={onNavHome}>🐱</div>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 leading-tight">猫咪闪卡学院</h1>
          <p className="text-[10px] sm:text-xs text-gray-400">{selectedLevel} · {selectedCategory === 'All' ? '全部' : selectedCategory}</p>
        </div>
      </div>
      <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-100 overflow-x-auto">
        <button 
          onClick={onNavFlashcard} 
          className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 ${activeTab === 'flashcard' ? 'bg-[#EBF5F0] text-[#4A9A74]' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <span>🎴</span> 传统背卡
        </button>
        <button 
          onClick={onNavDictation} 
          className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 ${activeTab === 'dictation' ? 'bg-[#EBF5F0] text-[#4A9A74]' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <span>🎯</span> 听音拼写
        </button>
        <button 
          onClick={onNavLibrary} 
          className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 ml-1 shrink-0 ${activeTab === 'library' || activeTab === 'hall' || activeTab === 'list' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <span>📚</span> 单词大厅 ({rawCardsCount})
        </button>
      </div>
    </header>
  );
}
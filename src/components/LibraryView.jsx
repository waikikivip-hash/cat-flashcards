// src/components/LibraryView.jsx
import React, { useState } from 'react';

export default function LibraryView({
  currentView, setCurrentView,
  rawCards, hallLevel, setHallLevel,
  selectedLibPack, setSelectedLibPack,
  handleArchiveCard, getAvailableLevels, getLibraryPacks
}) {
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listVisibleCount, setListVisibleCount] = useState(20);

  if (currentView === 'hall') {
    return (
      <div className="w-full max-w-4xl relative pb-8 flex-1">
        <button onClick={() => setCurrentView('home')} className="absolute top-0 left-0 text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">
          🔙 返回签到处
        </button>
        <div className="text-center mb-8 mt-2">
          <h2 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2 mb-4">📚 单词大厅</h2>
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs text-gray-400 tracking-wider">选择词汇级别</span>
            <div className="bg-white rounded-full p-1 shadow-sm flex flex-wrap justify-center border border-gray-100">
              {getAvailableLevels().map((level) => (
                <button 
                  key={level} onClick={() => setHallLevel(level)}
                  className={`px-6 py-2 text-sm rounded-full font-bold transition-colors ${hallLevel === level ? 'bg-[#A3C9B8] text-[#2D4A3E] shadow-sm' : 'text-gray-400 hover:text-gray-600 bg-transparent'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 mb-6 tracking-wider">选择细分主题项目</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pb-10">
          {getLibraryPacks().filter(p => p.level === hallLevel).map((pack) => (
            <div 
              key={`${pack.level}-${pack.category}`} 
              onClick={() => { 
                setSelectedLibPack(pack); 
                setListSearchQuery('');      
                setListVisibleCount(20);     
                setCurrentView('list'); 
              }}
              className="bg-white rounded-3xl shadow-sm border border-gray-50 py-8 flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform"
            >
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">{pack.category}</h3>
              <span className="text-xs text-[#A3C9B8] font-medium">共 {pack.count} 词</span>
            </div>
          ))}
          {getLibraryPacks().filter(p => p.level === hallLevel).length === 0 && (
            <div className="col-span-full text-center text-sm font-bold text-gray-400 mt-10">该级别下暂无单词包 🐾</div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'list' && selectedLibPack) {
    const targetList = rawCards.filter((card) => card.level === selectedLibPack.level && card.category === selectedLibPack.category);
    
    // 🌟 核心升级：中英文双向模糊搜索算法
    const query = listSearchQuery.trim().toLowerCase();
    const searchedList = targetList.filter((card) => {
      if (!query) return true;
      const enMatch = card.word && card.word.toLowerCase().includes(query);
      const cnMatch = card.translation && card.translation.toLowerCase().includes(query);
      const cnSentenceMatch = card.translation_cn && card.translation_cn.toLowerCase().includes(query);
      return enMatch || cnMatch || cnSentenceMatch;
    });

    const displayList = searchedList.slice(0, listVisibleCount);

    return (
      <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-sm overflow-hidden flex flex-col min-h-[500px] mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-gray-100 shrink-0 gap-3">
          <div className="flex w-full sm:w-auto justify-between items-center gap-2">
            <button onClick={() => setCurrentView('hall')} className="text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 border border-gray-200 px-4 py-1.5 rounded-full shrink-0">
              🔙 返回大厅
            </button>
            <span className="bg-[#EBF5F0] text-[#4A9A74] text-xs font-bold px-4 py-1.5 rounded-full uppercase shrink-0">
              {selectedLibPack.level} · {selectedLibPack.category}
            </span>
          </div>
          <input 
            type="text" 
            placeholder="🔍 搜英文或中文..." 
            value={listSearchQuery}
            onChange={(e) => { 
              setListSearchQuery(e.target.value); 
              setListVisibleCount(20); 
            }}
            className="w-full sm:w-56 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#A3C9B8] focus:bg-white transition-colors"
          />
        </div>
        
        <div className="flex-1 overflow-x-auto p-2 sm:p-6">
          <div className="min-w-[400px]">
            <div className="grid grid-cols-4 text-center text-sm font-bold text-gray-500 mb-4 pb-2 border-b border-gray-50">
              <div className="col-span-1">单词</div>
              <div className="col-span-1">中文</div>
              <div className="col-span-1">连对/复习</div>
              <div className="col-span-1">操作</div>
            </div>
            {displayList.map((card) => (
              <div key={card.id} className="grid grid-cols-4 text-center items-center py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <div className="font-bold text-gray-800 text-base font-mono">
                  {card.word} {card.is_archived && <span className="block text-[10px] text-gray-400 font-sans mt-0.5">已封印</span>}
                </div>
                <div className="text-gray-600 text-sm">{card.translation}</div>
                <div className="text-xs text-gray-500"><span className="text-[#D4A017]">{card.streak_correct||0}次</span> / <span className="text-[#4A9A74]">{card.interval||1}天</span></div>
                <div>
                  <button 
                    onClick={(e) => {
                      handleArchiveCard(card.id, e);
                      const remains = rawCards.filter((c) => c.id !== card.id && c.level === selectedLibPack.level && c.category === selectedLibPack.category);
                      if (remains.length === 0) setCurrentView('hall');
                    }} 
                    className="text-[#D84C4C] text-xs bg-[#FFEBEB] px-3 py-1.5 rounded-full font-bold hover:bg-[#FFDFDF] transition-colors"
                  >
                    封印 🐾
                  </button>
                </div>
              </div>
            ))}
            {searchedList.length === 0 && (
              <div className="text-center py-10 text-gray-400 font-bold text-sm">没有找到相关单词 😿</div>
            )}
            {searchedList.length > listVisibleCount && (
              <div className="text-center py-6 border-t border-gray-50">
                <button 
                  onClick={() => setListVisibleCount(prev => prev + 20)}
                  className="bg-[#EBF5F0] text-[#4A9A74] px-6 py-2 rounded-full text-sm font-bold hover:bg-[#D5EAE2] transition-colors"
                >
                  加载更多 👇
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
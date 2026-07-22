// src/components/LibraryView.jsx
import React, { useState } from 'react';
import { containsChinese } from '../utils';

export default function LibraryView({
  currentView = 'hall', setCurrentView = () => {},
  rawCards = [], hallLevel = 'A1', setHallLevel = () => {},
  selectedLibPack = null, setSelectedLibPack = () => {},
  handleArchiveCard = () => {}, getAvailableLevels = () => [], getLibraryPacks = () => [],
  playSpeech = () => {}
}) {
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listVisibleCount, setListVisibleCount] = useState(20);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalVisibleCount, setGlobalVisibleCount] = useState(20);

  const filterCards = (cards, queryText) => {
    const query = String(queryText || '').trim().toLowerCase();
    if (!query) return [];
    const isCn = containsChinese(query);
    return (cards || []).filter((card) => {
      if (!card) return false;
      const word = String(card.word || '').toLowerCase();
      const translation = String(card.translation || '').toLowerCase();
      const translationCn = String(card.translation_cn || '').toLowerCase();
      return isCn ? (translation.includes(query) || translationCn.includes(query)) : word.startsWith(query);
    });
  };

  if (currentView === 'hall') {
    const globalSearchResults = filterCards(rawCards, globalSearchQuery);
    const displayResults = globalSearchResults.slice(0, globalVisibleCount);

    return (
      <div className="w-full max-w-4xl relative pb-8 flex-1">
        <button onClick={() => setCurrentView('home')} className="absolute top-0 left-0 text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm z-10">
          🔙 返回签到处
        </button>

        <div className="text-center mb-6 mt-2 pt-10 sm:pt-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2 mb-4">📚 单词大厅</h2>
          <div className="w-full max-w-xl mx-auto mb-6 px-2">
            <div className="relative">
              <input 
                type="text" 
                placeholder="🔍 全局搜索：英文搜首字母，中文搜词意..." 
                value={globalSearchQuery}
                onChange={(e) => { setGlobalSearchQuery(e.target.value); setGlobalVisibleCount(20); }}
                className="w-full px-5 py-3 bg-white border-2 border-[#A3C9B8] rounded-2xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#A3C9B8]/50 shadow-sm font-medium text-gray-800 placeholder:text-gray-400"
              />
              {globalSearchQuery && (
                <button onClick={() => setGlobalSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-sm bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">✕</button>
              )}
            </div>
          </div>

          {!globalSearchQuery && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs text-gray-400 tracking-wider">选择词汇级别</span>
              <div className="bg-white rounded-full p-1 shadow-sm flex flex-wrap justify-center border border-gray-100">
                {getAvailableLevels().map((lvl) => (
                  <button key={lvl} onClick={() => setHallLevel(lvl)} className={`px-6 py-2 text-sm rounded-full font-bold transition-colors ${hallLevel === lvl ? 'bg-[#A3C9B8] text-[#2D4A3E] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {globalSearchQuery ? (
          <div className="w-full space-y-4 px-2">
            <div className="text-xs text-gray-500 font-bold px-2 flex justify-between items-center">
              <span>搜到 {globalSearchResults.length} 个相关单词：</span>
              <span className="text-gray-400">展示级别与全部属性</span>
            </div>
            {displayResults.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm flex flex-col gap-3 hover:shadow-md">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex gap-2 items-center">
                    <span className="bg-[#A3C9B8] text-[#2D4A3E] font-black px-2.5 py-0.5 rounded-md uppercase font-mono">{card.level}</span>
                    <span className="bg-[#EBF5F0] text-[#4A9A74] font-bold px-2.5 py-0.5 rounded-md">{card.category}</span>
                    {card.is_archived && <span className="bg-gray-100 text-gray-400 font-bold px-2 py-0.5 rounded-md text-[10px]">已封印 🐾</span>}
                  </div>
                  <div className="text-gray-400 text-[11px]">连对: <strong className="text-[#D4A017]">{card.streak_correct || 0}</strong>次 | 间隔: <strong className="text-[#4A9A74]">{card.interval || 1}</strong>天</div>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-gray-800 font-mono">{card.word}</h3>
                      <span className="text-sm text-gray-400 font-light">{card.phonetic}</span>
                      <button type="button" onClick={(e) => playSpeech && playSpeech(card.word, e)} className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500">🔊</button>
                    </div>
                    <p className="text-base font-bold text-[#4A9A74] mt-1">{card.translation}</p>
                  </div>
                  <button onClick={(e) => handleArchiveCard(card.id, e)} className={`text-xs px-3 py-1.5 rounded-full font-bold ${card.is_archived ? 'bg-gray-100 text-gray-400' : 'text-[#D84C4C] bg-[#FFEBEB]'}`}>
                    {card.is_archived ? '已归档' : '封印 🐾'}
                  </button>
                </div>
                {card.sentence && (
                  <div className="bg-gray-50 rounded-xl p-3 text-xs border border-gray-100/80">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-gray-700 font-medium italic">"{card.sentence}"</p>
                      <button type="button" onClick={(e) => playSpeech && playSpeech(card.sentence, e)} className="shrink-0 p-1 rounded-full bg-white text-gray-400 shadow-sm">🔊</button>
                    </div>
                    {card.translation_cn && <p className="text-gray-400 mt-1">({card.translation_cn})</p>}
                  </div>
                )}
              </div>
            ))}
            {globalSearchResults.length === 0 && <div className="text-center py-12 text-gray-400 font-bold text-sm bg-white rounded-2xl border border-gray-100">没有找到符合 “{globalSearchQuery}” 的单词 😿</div>}
            {globalSearchResults.length > globalVisibleCount && (
              <div className="text-center py-4">
                <button onClick={() => setGlobalVisibleCount(prev => prev + 20)} className="bg-[#EBF5F0] text-[#4A9A74] px-6 py-2 rounded-full text-sm font-bold hover:bg-[#D5EAE2]">查看更多结果 👇</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-center text-xs text-gray-400 mb-6 tracking-wider">选择细分主题项目</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pb-10">
              {getLibraryPacks().filter(p => p.level === hallLevel).map((pack) => (
                <div key={`${pack.level}-${pack.category}`} onClick={() => { setSelectedLibPack(pack); setListSearchQuery(''); setListVisibleCount(20); setCurrentView('list'); }} className="bg-white rounded-3xl shadow-sm border border-gray-50 py-8 flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform">
                  <div className="text-4xl mb-4">📦</div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">{pack.category}</h3>
                  <span className="text-xs text-[#A3C9B8] font-medium">共 {pack.count} 词</span>
                </div>
              ))}
              {getLibraryPacks().filter(p => p.level === hallLevel).length === 0 && <div className="col-span-full text-center text-sm font-bold text-gray-400 mt-10">该级别下暂无单词包 🐾</div>}
            </div>
          </>
        )}
      </div>
    );
  }

  if (currentView === 'list' && selectedLibPack) {
    const targetList = (rawCards || []).filter((card) => card && card.level === selectedLibPack.level && card.category === selectedLibPack.category);
    const searchedList = listSearchQuery.trim() ? filterCards(targetList, listSearchQuery) : targetList;
    const displayList = searchedList.slice(0, listVisibleCount);

    return (
      <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-sm overflow-hidden flex flex-col min-h-[500px] mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-gray-100 shrink-0 gap-3">
          <div className="flex w-full sm:w-auto justify-between items-center gap-2">
            <button onClick={() => setCurrentView('hall')} className="text-gray-500 text-sm flex items-center gap-1 border border-gray-200 px-4 py-1.5 rounded-full shrink-0">🔙 返回大厅</button>
            <span className="bg-[#EBF5F0] text-[#4A9A74] text-xs font-bold px-4 py-1.5 rounded-full uppercase shrink-0">{selectedLibPack.level} · {selectedLibPack.category}</span>
          </div>
          <input 
            type="text" placeholder="🔍 搜包内单词/词意..." value={listSearchQuery}
            onChange={(e) => { setListSearchQuery(e.target.value); setListVisibleCount(20); }}
            className="w-full sm:w-56 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#A3C9B8]"
          />
        </div>
        
        <div className="flex-1 overflow-x-auto p-2 sm:p-6">
          <div className="min-w-[400px]">
            <div className="grid grid-cols-4 text-center text-sm font-bold text-gray-500 mb-4 pb-2 border-b border-gray-50">
              <div>单词</div><div>中文</div><div>连对/复习</div><div>操作</div>
            </div>
            {displayList.map((card) => (
              <div key={card.id} className="grid grid-cols-4 text-center items-center py-4 border-b border-gray-50 hover:bg-gray-50">
                <div className="font-bold text-gray-800 text-base font-mono">{card.word} {card.is_archived && <span className="block text-[10px] text-gray-400 font-sans">已封印</span>}</div>
                <div className="text-gray-600 text-sm">{card.translation}</div>
                <div className="text-xs text-gray-500"><span className="text-[#D4A017]">{card.streak_correct||0}次</span> / <span className="text-[#4A9A74]">{card.interval||1}天</span></div>
                <div>
                  <button onClick={(e) => { handleArchiveCard(card.id, e); if (rawCards.filter(c => c.id !== card.id && c.level === selectedLibPack.level && c.category === selectedLibPack.category).length === 0) setCurrentView('hall'); }} className="text-[#D84C4C] text-xs bg-[#FFEBEB] px-3 py-1.5 rounded-full font-bold">封印 🐾</button>
                </div>
              </div>
            ))}
            {searchedList.length === 0 && <div className="text-center py-10 text-gray-400 font-bold text-sm">没有找到相关单词 😿</div>}
            {searchedList.length > listVisibleCount && (
              <div className="text-center py-6 border-t border-gray-50">
                <button onClick={() => setListVisibleCount(prev => prev + 20)} className="bg-[#EBF5F0] text-[#4A9A74] px-6 py-2 rounded-full text-sm font-bold">加载更多 👇</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
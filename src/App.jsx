import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';

// 🚨 1. 定義系統的「標準級別排序字典」，為未來的托福、雅思、GRE與專業詞彙鋪路
const LEVEL_ORDER = [
  'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 
  'TOEFL', 'IELTS', 'GRE', 
  'Business', 'Medical', 'Academic', 'Coding' // 未來可無限追加專業領域
];

function App() {
  const [allCards, setAllCards] = useState([]);      // 存放從雲端拉下來的所有單字原數據
  const [filteredCards, setFilteredCards] = useState([]); // 存放篩選過後的單字
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 篩選器的狀態
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // 控制視窗切換 ( 'learn' = 背卡模式, 'library' = 單字庫模式 )
  const [currentView, setCurrentView] = useState('learn');
  const [searchQuery, setSearchQuery] = useState(''); // 單字庫搜尋框

  // 選中的主題包（若為 null 表示在「主題大廳」；若有值則進入「專屬單字表」）
  const [activePack, setActivePack] = useState(null);

  // 控制發音的安全鎖
  const isFirstRender = useRef(true);
  const prevIndexRef = useRef(-1); 

  // 1. 自動讀取雲端數據
  useEffect(() => {
    fetchCards();
  }, []);

  // 確保瀏覽器加載完語音包
  useEffect(() => {
    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setAllCards(data || []);
      setFilteredCards(data || []); 
      prevIndexRef.current = 0; 
    } catch (error) {
      console.error('讀取雲端數據失敗:', error.message);
      alert('無法連線到雲端資料庫，請檢查您的 .env 設定！');
    } finally {
      setIsLoading(false);
    }
  };

  // 當篩選條件改變時，重新過濾單字清單
  useEffect(() => {
    if (allCards.length === 0) return;
    
    let temp = [...allCards];
    
    if (selectedLevel !== 'All') {
      temp = temp.filter(card => card.level === selectedLevel);
    }
    
    if (selectedCategory !== 'All') {
      temp = temp.filter(card => card.category === selectedCategory);
    }
    
    isFirstRender.current = true;
    setFilteredCards(temp);
    setCurrentIndex(0); 
    prevIndexRef.current = 0; 
    setIsFlipped(false);
  }, [selectedLevel, selectedCategory, allCards]);

  // 🔊 原生瀏覽器發音 (TTS)
  const playSpeech = (text, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!text) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    const preferredVoice = voices.find(
      (voice) =>
        voice.lang.includes('en-US') &&
        (voice.name.includes('Samantha') || 
         voice.name.includes('Google') || 
         voice.name.includes('Ava') || 
         voice.name.includes('Premium'))
    ) || voices.find((voice) => voice.lang.includes('en-US'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    } else {
      utterance.lang = 'en-US';
    }

    utterance.rate = 0.85;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  };

  // 當切換卡片時自動播放發音（安全控制）
  useEffect(() => {
    if (currentView !== 'learn') return; 
    
    if (filteredCards.length > 0 && filteredCards[currentIndex]) {
      if (isFirstRender.current) {
        const timer = setTimeout(() => {
          playSpeech(filteredCards[currentIndex].word);
          isFirstRender.current = false;
          prevIndexRef.current = currentIndex; 
        }, 300);
        return () => clearTimeout(timer);
      } 
      
      if (currentIndex !== prevIndexRef.current) {
        playSpeech(filteredCards[currentIndex].word);
        prevIndexRef.current = currentIndex; 
      }
    }
  }, [currentIndex, filteredCards, currentView]);

  // 2. Q 彈紙屑特效
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2DD4BF', '#FBBF24', '#F43F5E', '#60A5FA', '#34D399']
    });
  };

  // 3. SM-2 核心演算法
  const calculateSM2 = (card, quality) => {
    let nextInterval = 1;
    let nextRepetitions = card.repetitions || 0;
    let nextEasiness = card.easiness || 2.5;

    if (quality < 3) {
      nextRepetitions = 0;
      nextInterval = 1;
    } else {
      if (nextRepetitions === 0) {
        nextInterval = 1;
      } else if (nextRepetitions === 1) {
        nextInterval = 6;
      } else {
        nextInterval = Math.round(card.interval * card.easiness);
      }
      nextRepetitions += 1;
    }

    nextEasiness = card.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (nextEasiness < 1.3) nextEasiness = 1.3;

    return {
      interval: nextInterval,
      repetitions: nextRepetitions,
      easiness: Number(nextEasiness.toFixed(2)),
      next_review: Date.now() + nextInterval * 60 * 1000,
    };
  };

  // 4. 評分並更新
  const handleGrade = async (quality) => {
    if (quality === 5) {
      triggerConfetti();
    }

    const currentCard = filteredCards[currentIndex];
    const sm2Data = calculateSM2(currentCard, quality);

    const updatedCard = { ...currentCard, ...sm2Data };
    const updatedFiltered = filteredCards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    setFilteredCards(updatedFiltered);

    setAllCards((prev) => prev.map((c) => (c.id === currentCard.id ? updatedCard : c)));

    supabase
      .from('words')
      .update({
        interval: sm2Data.interval,
        repetitions: sm2Data.repetitions,
        easiness: sm2Data.easiness,
        next_review: sm2Data.next_review
      })
      .eq('id', currentCard.id)
      .then(({ error }) => {
        if (error) console.error('寫入雲端失敗:', error.message);
        else console.log('雲端數據同步成功！');
      });

    setIsFlipped(false);

    if (updatedFiltered.length <= 1) return;

    const sortedList = updatedFiltered
      .map((card, index) => ({ originalIndex: index, ...card }))
      .sort((a, b) => {
        if (a.repetitions === 0 && b.repetitions > 0) return -1;
        if (b.repetitions === 0 && a.repetitions > 0) return 1;
        return a.interval - b.interval;
      });

    let nextItem = sortedList.find(item => item.id !== currentCard.id);
    if (!nextItem) {
      nextItem = sortedList[0];
    }

    setCurrentIndex(nextItem.originalIndex);
  };

  // 🚨 2. 定義排序輔助函數，確保選單與主題大廳嚴格按照難度由淺入深排列
  const sortLevels = (levelList) => {
    return [...levelList].sort((a, b) => {
      const idxA = LEVEL_ORDER.indexOf(a);
      const idxB = LEVEL_ORDER.indexOf(b);
      // 如果不在預設字典裡，就排到最後面（做為兜底）
      const weightA = idxA === -1 ? 999 : idxA;
      const weightB = idxB === -1 ? 999 : idxB;
      return weightA - weightB;
    });
  };

  // 提取動態篩選選項，並通過自定義字典排序
  const rawLevels = [...new Set(allCards.map(c => c.level).filter(Boolean))];
  const levels = ['All', ...sortLevels(rawLevels)];
  const categories = ['All', ...new Set(allCards.map(c => c.category).filter(Boolean))];

  // 計算有哪些「不重複的級別 + 分類」組合，並按級別權重排序後渲染主題卡片包
  const getPacks = () => {
    const packsMap = {};
    allCards.forEach(card => {
      const lvl = card.level || 'A1';
      const cat = card.category || '生活';
      const key = `${lvl}-${cat}`;
      if (!packsMap[key]) {
        packsMap[key] = {
          level: lvl,
          category: cat,
          count: 0
        };
      }
      packsMap[key].count += 1;
    });

    return Object.values(packsMap).sort((a, b) => {
      const idxA = LEVEL_ORDER.indexOf(a.level);
      const idxB = LEVEL_ORDER.indexOf(b.level);
      const weightA = idxA === -1 ? 999 : idxA;
      const weightB = idxB === -1 ? 999 : idxB;
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.category.localeCompare(b.category); // 同級別下，主題按拼音/英文字母排序
    });
  };

  // 篩選當前選中主題包下的單字
  const getPackCards = () => {
    if (!activePack) return [];
    return allCards.filter(card => {
      const lvl = card.level || 'A1';
      const cat = card.category || '生活';
      
      const matchPack = lvl === activePack.level && cat === activePack.category;
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return matchPack && (
          card.word.toLowerCase().includes(query) ||
          card.translation.toLowerCase().includes(query)
        );
      }
      return matchPack;
    });
  };

  const packCards = getPackCards();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl animate-bounce duration-1000 block">🐱</span>
          <p className="text-teal-800 font-semibold mt-4">正在加載貓咪分類單字包...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-between p-6 font-sans text-slate-700">
      
      {/* 頂部導航欄 */}
      <header className="w-full max-w-4xl flex justify-between items-center py-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🐱</span>
          <h1 className="text-xl font-bold tracking-wider text-teal-800">貓咪閃卡學院</h1>
        </div>
        
        {/* 按鈕：切換背卡模式與單字庫模式 */}
        {currentView === 'learn' ? (
          <button 
            onClick={() => {
              setCurrentView('library');
              setActivePack(null); // 進單字庫時，預設顯示「主題大廳」
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
          >
            📚 級別單字庫 ({allCards.length})
          </button>
        ) : (
          <button 
            onClick={() => setCurrentView('learn')}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
          >
            🔙 返回背卡
          </button>
        )}
      </header>

      {/* -------------------- 【視窗 A：背卡學習模式】 -------------------- */}
      {currentView === 'learn' && (
        <>
          {/* 分類篩選區域 */}
          <section className="w-full max-w-md bg-white/70 backdrop-blur-md p-3 rounded-2xl shadow-sm border border-teal-100/50 flex gap-2 my-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">難度級別</label>
              <select 
                value={selectedLevel} 
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full bg-teal-50 border border-teal-100 text-slate-600 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {levels.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl === 'All' ? '全部級別' : lvl}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">主題場景</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-teal-50 border border-teal-100 text-slate-600 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'All' ? '全部場景' : cat}</option>
                ))}
              </select>
            </div>
          </section>

          {/* 主體內容區 */}
          <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-2">
            
            {filteredCards.length === 0 ? (
              <div className="text-center py-12 bg-white/50 rounded-3xl w-full border border-dashed border-teal-200">
                <span className="text-4xl block mb-2">🙀</span>
                <p className="text-sm text-slate-400 font-medium">這個分類下目前空空的～</p>
                <p className="text-xs text-slate-300 mt-1">切換其他分類試試看吧！</p>
              </div>
            ) : (
              <>
                {/* 頂部卡片狀態 */}
                <div className="w-full mb-2 px-2 flex justify-between text-xs text-slate-400">
                  <span>間隔: <strong className="text-teal-600">{filteredCards[currentIndex]?.interval || 1}天</strong></span>
                  <div className="flex gap-2">
                    <span className="bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded text-[10px]">{filteredCards[currentIndex]?.level}</span>
                    <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[10px]">{filteredCards[currentIndex]?.category}</span>
                  </div>
                  <span>已記對: <strong className="text-teal-600">{filteredCards[currentIndex]?.repetitions || 0}次</strong></span>
                </div>

                {/* 卡片容器 */}
                <div 
                  onClick={() => {
                    if (!isFlipped) {
                      playSpeech(filteredCards[currentIndex]?.word);
                    }
                    setIsFlipped(!isFlipped);
                  }}
                  className="w-full h-80 cursor-pointer [perspective:1000px]"
                >
                  <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    
                    {/* 卡片正面 */}
                    <div className="absolute inset-0 w-full h-full bg-white rounded-3xl shadow-xl shadow-teal-100/50 flex flex-col items-center justify-between p-8 border-4 border-teal-200 [backface-visibility:hidden]">
                      <div className="text-right w-full text-xs text-slate-400">點擊卡片翻面 🐾</div>
                      
                      <div className="flex flex-col items-center justify-center flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-5xl font-black text-teal-700 tracking-tight">{filteredCards[currentIndex]?.word}</span>
                          <button
                            onClick={(e) => playSpeech(filteredCards[currentIndex]?.word, e)}
                            className="p-2 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 active:scale-90 transition-all border border-teal-100"
                            title="播放發音"
                          >
                            🔊
                          </button>
                        </div>
                        <span className="text-lg text-slate-400 mt-2 font-mono">{filteredCards[currentIndex]?.phonetic}</span>
                      </div>
                      
                      <div className="text-teal-500 font-medium flex items-center gap-1">
                        <span>🐱 喵～點我揭曉答案！</span>
                      </div>
                    </div>

                    {/* 卡片背面 */}
                    <div className="absolute inset-0 w-full h-full bg-teal-50 rounded-3xl shadow-xl shadow-teal-100/50 flex flex-col items-center justify-between p-8 border-4 border-teal-300 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <div className="text-right w-full text-xs text-slate-400">背面 🐾</div>
                      <div className="flex flex-col items-center px-2">
                        <span className="text-3xl font-bold text-teal-800 mb-4">{filteredCards[currentIndex]?.translation}</span>
                        <p className="text-sm font-medium text-slate-600 text-center leading-relaxed mb-1">
                          "{filteredCards[currentIndex]?.sentence}"
                        </p>
                        <p className="text-xs text-slate-400 text-center">
                          ({filteredCards[currentIndex]?.translation_cn || filteredCards[currentIndex]?.translationCn})
                        </p>
                      </div>
                      <div className="text-xs text-teal-600 font-semibold bg-white px-3 py-1 rounded-full border border-teal-200">
                        🐾 請為你的記憶程度評分
                      </div>
                    </div>

                  </div>
                </div>

                {/* 互動評分按鈕組 */}
                <div className="w-full mt-4">
                  {isFlipped ? (
                    <div className="grid grid-cols-3 gap-3">
                      <button 
                        onClick={() => handleGrade(0)}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-3 px-2 rounded-2xl shadow-sm active:scale-95 transition-all flex flex-col items-center gap-1 border border-rose-200"
                      >
                        <span className="text-2xl">❌</span>
                        <span className="text-xs">遺忘了</span>
                      </button>
                      <button 
                        onClick={() => handleGrade(3)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold py-3 px-2 rounded-2xl shadow-sm active:scale-95 transition-all flex flex-col items-center gap-1 border border-amber-200"
                      >
                        <span className="text-2xl">😮</span>
                        <span className="text-xs">模糊糊</span>
                      </button>
                      <button 
                        onClick={() => handleGrade(5)}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-3 px-2 rounded-2xl shadow-sm active:scale-95 transition-all flex flex-col items-center gap-1 border border-emerald-200"
                      >
                        <span className="text-2xl">😻</span>
                        <span className="text-xs">秒記住</span>
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsFlipped(true)}
                      className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-teal-500/20 active:scale-95 transition-all duration-150 text-center text-lg flex items-center justify-center gap-2"
                    >
                      <span>點擊卡片翻面 🐾</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </main>
        </>
      )}

      {/* -------------------- 【視窗 B：單字庫模式】 -------------------- */}
      {currentView === 'library' && (
        <main className="w-full max-w-4xl flex-1 flex flex-col my-2 overflow-hidden">
          
          {/* 🌟 1. 主題大廳 */}
          {!activePack ? (
            <div className="flex-1 flex flex-col">
              <div className="text-center py-4">
                <h2 className="text-2xl font-black text-teal-800 tracking-tight flex items-center justify-center gap-2">
                  📚 級別主題大廳
                </h2>
                <p className="text-sm text-slate-400 mt-1">單字包已按照難度（A0-C2 / 托福 / 雅思 / GRE）順序排列：</p>
              </div>

              {/* 主題包網格（已支持 CEFR 與 各大留學考試科學排序） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-2 overflow-y-auto max-h-[60vh]">
                {getPacks().map((pack) => (
                  <div
                    key={`${pack.level}-${pack.category}`}
                    onClick={() => {
                      setActivePack(pack);
                      setSearchQuery(''); 
                    }}
                    className="cursor-pointer bg-white hover:bg-teal-50/30 p-5 rounded-3xl border-2 border-teal-100/50 hover:border-teal-300 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex flex-col justify-between h-40"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                          {pack.level}
                        </span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          {pack.category}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 tracking-tight leading-snug">
                        {pack.level} 級別 - {pack.category}單字包
                      </h3>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-50 pt-3">
                      <span>包含：<strong className="text-teal-600">{pack.count}</strong> 個單字</span>
                      <span className="text-teal-500 font-bold hover:translate-x-1 transition-transform">進入單字表 ➡️</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* 🌟 2. 專屬單字表格 */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 頂部控制列 */}
              <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-teal-100/50 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActivePack(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                  >
                    ⬅️ 返回主題大廳
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-teal-800 flex items-center gap-2">
                      {activePack.level} · {activePack.category} 單字包
                      <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full font-bold">
                        當前: {packCards.length} 個
                      </span>
                    </h2>
                  </div>
                </div>
                
                {/* 搜尋過濾 */}
                <div className="relative w-full md:w-64">
                  <input 
                    type="text" 
                    placeholder="在此主題包內搜尋..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-teal-50/50 border border-teal-100/80 rounded-2xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all text-slate-600"
                  />
                  <span className="absolute left-3.5 top-2.5 text-xs opacity-50">🔍</span>
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-500 px-1.5 py-0.5 rounded-md"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>

              {/* 專屬主題單字表 */}
              <div className="flex-1 overflow-x-auto rounded-3xl border border-teal-100/50 shadow-sm bg-white">
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead className="bg-teal-50/80 text-teal-900 font-bold sticky top-0 backdrop-blur-md z-10 border-b border-teal-100">
                    <tr>
                      <th className="px-4 py-3.5">單字</th>
                      <th className="px-4 py-3.5">發音/音標</th>
                      <th className="px-4 py-3.5">中文翻譯</th>
                      <th className="px-3 py-3.5 text-center">級別</th>
                      <th className="px-3 py-3.5 text-center">主題</th>
                      <th className="px-3 py-3.5 text-center">複習間隔</th>
                      <th className="px-3 py-3.5 text-center">記對次數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packCards.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-16 text-slate-400 font-medium bg-white">
                          <span className="text-4xl block mb-2">🔍</span>
                          此主題包下暫無相符的單字～
                        </td>
                      </tr>
                    ) : (
                      packCards.map((card) => (
                        <tr 
                          key={card.id}
                          className="hover:bg-teal-50/10 transition-colors"
                        >
                          {/* 單字 */}
                          <td className="px-4 py-4 font-bold text-sm text-teal-850 tracking-tight">
                            {card.word}
                          </td>
                          
                          {/* 發音與音標 */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => playSpeech(card.word)}
                                className="p-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 active:scale-90 transition-all text-xs"
                                title="點擊發音"
                              >
                                🔊
                              </button>
                              <span className="text-slate-400 font-mono">{card.phonetic}</span>
                            </div>
                          </td>
                          
                          {/* 中文翻譯 */}
                          <td className="px-4 py-4 font-medium text-slate-800">
                            {card.translation}
                          </td>
                          
                          {/* 級別 */}
                          <td className="px-3 py-4 text-center whitespace-nowrap">
                            <span className="inline-block bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-teal-100/50 uppercase">
                              {card.level || 'A1'}
                            </span>
                          </td>
                          
                          {/* 主題 */}
                          <td className="px-3 py-4 text-center whitespace-nowrap">
                            <span className="inline-block bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-100/50">
                              {card.category || '生活'}
                            </span>
                          </td>
                          
                          {/* 複習間隔 */}
                          <td className="px-3 py-4 text-center font-bold text-teal-600 whitespace-nowrap">
                            {card.interval || 1} 天
                          </td>
                          
                          {/* 記對次數 */}
                          <td className="px-3 py-4 text-center font-bold text-slate-500 whitespace-nowrap">
                            {card.repetitions || 0} 次
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      )}

      <footer className="w-full max-w-4xl text-center py-1 text-xs text-slate-400 mt-2">
        所有學習數據皆已即時同步至 Supabase 雲端 ☁️
      </footer>
    </div>
  );
}

export default App;
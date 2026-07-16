import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';

function App() {
  const [allCards, setAllCards] = useState([]);      // 存放從雲端拉下來的所有單字原數據
  const [filteredCards, setFilteredCards] = useState([]); // 存放篩選過後的單字
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 篩選器的狀態
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // 控制發音的安全鎖
  const isFirstRender = useRef(true);
  const prevIndexRef = useRef(-1); // 💡 用來追蹤上一次的卡片索引，防止睡眠喚醒時重複播放

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
      setFilteredCards(data || []); // 初始顯示全部
      
      // 初始化索引記錄
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
    setCurrentIndex(0); // 切換分類時重置回第一張
    prevIndexRef.current = 0; // 重置索引追蹤
    setIsFlipped(false);
  }, [selectedLevel, selectedCategory]);

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

  // 🚨 修正：精準控制何時發音
  useEffect(() => {
    if (filteredCards.length > 0 && filteredCards[currentIndex]) {
      // 1. 如果是第一次加載，給予延遲播放
      if (isFirstRender.current) {
        const timer = setTimeout(() => {
          playSpeech(filteredCards[currentIndex].word);
          isFirstRender.current = false;
          prevIndexRef.current = currentIndex; // 記錄當前索引
        }, 300);
        return () => clearTimeout(timer);
      } 
      
      // 2. 如果是正常的卡片切換（索引改變了），才播放發音
      // 💡 睡眠喚醒觸發的重新渲染時，currentIndex 跟 prevIndexRef 會完全一樣，所以這裡會完美攔截、保持靜音！
      if (currentIndex !== prevIndexRef.current) {
        playSpeech(filteredCards[currentIndex].word);
        prevIndexRef.current = currentIndex; // 更新索引記錄
      }
    }
  }, [currentIndex, filteredCards]);

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

    // 1. 樂觀同步更新前端本地展示狀態
    const updatedCard = { ...currentCard, ...sm2Data };
    
    // 更新 filteredCards
    const updatedFiltered = filteredCards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    setFilteredCards(updatedFiltered);

    // 更新 allCards (保持原數據包同步，但不觸發 useEffect 重置)
    setAllCards((prev) => prev.map((c) => (c.id === currentCard.id ? updatedCard : c)));

    // 2. 同步寫入 Supabase 雲端
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

    // 3. 翻回正面
    setIsFlipped(false);

    // 4. 如果篩選後只有一張或沒有卡片，就不用切換了
    if (updatedFiltered.length <= 1) return;

    // 5. 依據記憶狀況排序，在當前過濾清單中尋找下一個最需要複習的單字
    const sortedList = updatedFiltered
      .map((card, index) => ({ originalIndex: index, ...card }))
      .sort((a, b) => {
        if (a.repetitions === 0 && b.repetitions > 0) return -1;
        if (b.repetitions === 0 && a.repetitions > 0) return 1;
        return a.interval - b.interval;
      });

    // 優先挑選排在最前面、且「不是當前這張卡片」的下一張
    let nextItem = sortedList.find(item => item.id !== currentCard.id);
    if (!nextItem) {
      nextItem = sortedList[0];
    }

    // 6. 安全、立即地切換到新卡片索引，這會更新 currentIndex
    setCurrentIndex(nextItem.originalIndex);
  };

  // 提取目前資料庫裡所有不重複的 Level 和 Category，動態生成篩選選項
  const levels = ['All', ...new Set(allCards.map(c => c.level).filter(Boolean))];
  const categories = ['All', ...new Set(allCards.map(c => c.category).filter(Boolean))];

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
      <header className="w-full max-w-md flex justify-between items-center py-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🐱</span>
          <h1 className="text-xl font-bold tracking-wider text-teal-800">貓咪閃卡學院</h1>
        </div>
        <div className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-semibold">
          ☁️ 雲端同步中
        </div>
      </header>

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

      <footer className="w-full max-w-md text-center py-1 text-xs text-slate-400">
        所有學習數據皆已即時同步至 Supabase 雲端 ☁️
      </footer>
    </div>
  );
}

export default App;
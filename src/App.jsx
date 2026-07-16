import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
// 引入我們剛才建立的雲端小郵差
import { supabase } from './supabaseClient';

function App() {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. 組件加載時，自動從 Supabase 雲端讀取單字數據
  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      // 從 supabase 的 'words' 表格中讀取所有單字
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error('讀取雲端數據失敗:', error.message);
      alert('無法連線到雲端資料庫，請檢查您的 .env 設定！');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 觸發 Q 彈彩色紙屑特效！
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2DD4BF', '#FBBF24', '#F43F5E', '#60A5FA', '#34D399']
    });
  };

  // 3. SM-2 核心演算法邏輯
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
      next_review: Date.now() + nextInterval * 60 * 1000, // 測試用，將天換算為分鐘
    };
  };

  // 4. 用戶評分後，更新狀態並同步寫入雲端
  const handleGrade = async (quality) => {
    if (quality === 5) {
      triggerConfetti();
    }

    const currentCard = cards[currentIndex];
    const sm2Data = calculateSM2(currentCard, quality);

    // 樂觀更新：先更新本地界面，讓用戶操作不卡頓
    const updatedCard = { ...currentCard, ...sm2Data };
    const newCards = cards.map((c) => (c.id === currentCard.id ? updatedCard : c));
    setCards(newCards);
    setIsFlipped(false);

    // 【雲端同步】將新的 SM-2 數據同步寫入 Supabase 資料庫！
    try {
      const { error } = await supabase
        .from('words')
        .update({
          interval: sm2Data.interval,
          repetitions: sm2Data.repetitions,
          easiness: sm2Data.easiness,
          next_review: sm2Data.next_review
        })
        .eq('id', currentCard.id); // 指定更新當前這張卡片的 id

      if (error) throw error;
      console.log('雲端數據同步成功！');
    } catch (error) {
      console.error('寫入雲端失敗:', error.message);
    }

    // 動態排序並切換下一張
    setTimeout(() => {
      const sortedIndices = newCards
        .map((c, index) => ({ index, ...c }))
        .sort((a, b) => {
          if (a.repetitions === 0 && b.repetitions > 0) return -1;
          if (b.repetitions === 0 && a.repetitions > 0) return 1;
          return a.interval - b.interval;
        });

      let nextIdx = sortedIndices[0].index;
      if (nextIdx === currentIndex && cards.length > 1) {
        nextIdx = sortedIndices[1].index;
      }
      setCurrentIndex(nextIdx);
    }, 250);
  };

  // 加載中畫面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl animate-bounce duration-1000 block">🐱</span>
          <p className="text-teal-800 font-semibold mt-4">正在連線雲端貓咪別墅...</p>
        </div>
      </div>
    );
  }

  // 無數據畫面
  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex items-center justify-center">
        <p className="text-slate-500">雲端別墅空空的，去 Supabase 補點單字吧！🐾</p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-between p-6 font-sans text-slate-700">
      
      {/* 頂部導航欄 */}
      <header className="w-full max-w-md flex justify-between items-center py-4">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🐱</span>
          <h1 className="text-xl font-bold tracking-wider text-teal-800">貓咪閃卡學院</h1>
        </div>
        <div className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-semibold">
          ☁️ 雲端同步已開啟
        </div>
      </header>

      {/* 主體內容區 */}
      <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-4">
        
        {/* 頂部卡片狀態 */}
        <div className="w-full mb-3 px-2 flex justify-between text-xs text-slate-400">
          <span>間隔: <strong className="text-teal-600">{currentCard.interval}天</strong></span>
          <span>易記度: <strong className="text-teal-600">{currentCard.easiness}</strong></span>
          <span>已記對: <strong className="text-teal-600">{currentCard.repetitions}次</strong></span>
        </div>

        {/* 卡片容器：3D翻轉 */}
        <div 
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-full h-80 cursor-pointer [perspective:1000px]"
        >
          <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
            
            {/* 卡片正面 */}
            <div className="absolute inset-0 w-full h-full bg-white rounded-3xl shadow-xl shadow-teal-100/50 flex flex-col items-center justify-between p-8 border-4 border-teal-200 [backface-visibility:hidden]">
              <div className="text-right w-full text-xs text-slate-400">點擊卡片翻面 🐾</div>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black text-teal-700 tracking-tight">{currentCard.word}</span>
                <span className="text-lg text-slate-400 mt-2 font-mono">{currentCard.phonetic}</span>
              </div>
              <div className="text-teal-500 font-medium flex items-center gap-1">
                <span>🐱 喵～點我揭曉答案！</span>
              </div>
            </div>

            {/* 卡片背面 */}
            <div className="absolute inset-0 w-full h-full bg-teal-50 rounded-3xl shadow-xl shadow-teal-100/50 flex flex-col items-center justify-between p-8 border-4 border-teal-300 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="text-right w-full text-xs text-teal-400">背面 🐾</div>
              <div className="flex flex-col items-center px-2">
                <span className="text-3xl font-bold text-teal-800 mb-4">{currentCard.translation}</span>
                <p className="text-sm font-medium text-slate-600 text-center leading-relaxed mb-1">
                  "{currentCard.sentence}"
                </p>
                <p className="text-xs text-slate-400 text-center">
                  ({currentCard.translationCn})
                </p>
              </div>
              <div className="text-xs text-teal-600 font-semibold bg-white px-3 py-1 rounded-full border border-teal-200">
                🐾 請為你的記憶程度評分
              </div>
            </div>

          </div>
        </div>

        {/* 下方 SM-2 互動評分按鈕組 */}
        <div className="w-full mt-6">
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

      </main>

      {/* 底部說明 */}
      <footer className="w-full max-w-md text-center py-2 text-xs text-slate-400">
        所有學習數據皆已即時同步至 Supabase 雲端 ☁️
      </footer>
    </div>
  );
}

export default App;
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';

const LEVEL_ORDER = [
  'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 
  'TOEFL', 'IELTS', 'GRE', 
  'Business', 'Medical', 'Academic', 'Coding'
];

function App() {
  // 核心數據狀態
  const [allCards, setAllCards] = useState([]);      
  const [filteredCards, setFilteredCards] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);    
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 四段式流控導航狀態機
  const [stage, setStage] = useState('splash'); 
  const [archivedCount, setArchivedCount] = useState(0); // 貓糧計數器 🐾

  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [currentView, setCurrentView] = useState('card');
  const [selectedLibPack, setSelectedLibPack] = useState(null); 

  // 考核模式狀態
  const [quizInput, setQuizInput] = useState(''); 
  const [quizStatus, setQuizStatus] = useState('waiting'); 
  const [quizPool, setQuizPool] = useState([]); 

  const utteranceRef = useRef(null);
  const nextBtnRef = useRef(null); 

  // 📱 手機端精準左右滑動手勢觸控點追蹤
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // 自動讀取雲端數據
  useEffect(() => {
    fetchCards();
  }, []);

  // 🔊 核心音訊跟隨監聽：只要單字切換或關卡變更，自動跟進最純正的真人發音 🎧
  useEffect(() => {
    if (stage === 'learn' && currentView === 'card' && filteredCards.length > 0 && filteredCards[currentIndex]) {
      playSpeech(filteredCards[currentIndex].word);
    }
  }, [currentIndex, filteredCards, currentView, stage]);

  // 💻 監聽電腦鍵盤左右方向鍵（← / →）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (stage === 'learn') {
        if (currentView === 'quiz' && quizStatus === 'wrong' && e.key === 'Enter') {
          e.preventDefault();
          nextQuizCard();
        }
        if (currentView === 'card' && filteredCards.length > 0) {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            handleNextCard();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePrevCard();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, currentView, quizStatus, quizPool, filteredCards, currentIndex]);

  useEffect(() => {
    const handleVoicesChanged = () => {
      if (window.speechSynthesis) window.speechSynthesis.getVoices();
    };
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('words').select('*').order('id', { ascending: true });
      if (error) throw error;
      const cards = data || [];
      const active = cards.filter(c => !c.is_archived);
      const archived = cards.filter(c => c.is_archived);
      
      setAllCards(active);
      setArchivedCount(archived.length); 
      setQuizPool(active);
      setFilteredCards(active);
    } catch (error) {
      console.error('雲端同步失敗:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const playSpeech = (text, e) => {
    if (e) e.stopPropagation();
    if (!text || !window.speechSynthesis) return;
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel(); 
    } catch (err) {}

    setTimeout(() => {
      try {
        utteranceRef.current = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en-US') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Ava'))) || voices.find(v => v.lang.includes('en-US'));
        if (preferredVoice) utteranceRef.current.voice = preferredVoice;
        utteranceRef.current.rate = 0.85;
        window.speechSynthesis.speak(utteranceRef.current);
      } catch (err) {}
    }, 20);
  };

  // 統一的換詞路由控制器，確保狀態完全清空
  const handleNextCard = () => {
    if (filteredCards.length <= 1) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
  };

  const handlePrevCard = () => {
    if (filteredCards.length <= 1) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
  };

  const triggerConfetti = () => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#2DD4BF', '#FBBF24', '#F43F5E'] });
  };

  const calculateSM2 = (card, quality) => {
    let nextInterval = 1;
    let nextRepetitions = card.repetitions || 0;
    let nextEasiness = card.easiness || 2.5;

    if (quality < 3) {
      nextRepetitions = 0; nextInterval = 1;
    } else {
      if (nextRepetitions === 0) nextInterval = 1;
      else if (nextRepetitions === 1) nextInterval = 6;
      else nextInterval = Math.round(card.interval * card.easiness);
      nextRepetitions += 1;
    }
    nextEasiness = card.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (nextEasiness < 1.3) nextEasiness = 1.3;

    return {
      interval: nextInterval, repetitions: nextRepetitions,
      easiness: Number(nextEasiness.toFixed(2)),
      next_review: Math.round(Date.now() / 1000) + nextInterval * 60, 
    };
  };

  const handleGrade = async (quality) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    if (quality === 5) triggerConfetti();

    const sm2Data = calculateSM2(currentCard, quality);
    const updatedCard = { ...currentCard, ...sm2Data };

    await supabase.from('words').update({
      interval: sm2Data.interval, repetitions: sm2Data.repetitions,
      easiness: sm2Data.easiness, next_review: sm2Data.next_review
    }).eq('id', currentCard.id);

    setAllCards(allCards.map(c => c.id === currentCard.id ? updatedCard : c));
    const updatedFiltered = filteredCards.map(c => c.id === currentCard.id ? updatedCard : c);
    setFilteredCards(updatedFiltered);
    setIsFlipped(false);

    if (updatedFiltered.length <= 1) return;
    setCurrentIndex((currentIndex + 1) % updatedFiltered.length);
  };

  const handleArchiveCard = async (cardId, e) => {
    if (e) e.stopPropagation();
    const confirmArchive = window.confirm("確定已永久掌握此單字？封印後它將化為一粒貓糧，徹底移出特訓隊列！🐾");
    if (!confirmArchive) return;

    await supabase.from('words').update({ is_archived: true }).eq('id', cardId);
    setArchivedCount(prev => prev + 1);

    const remainsAll = allCards.filter(c => c.id !== cardId);
    setAllCards(remainsAll);
    const remainsFiltered = filteredCards.filter(c => c.id !== cardId);
    setFilteredCards(remainsFiltered);
    setQuizPool(quizPool.filter(c => c.id !== cardId));

    setIsFlipped(false);
    if (currentIndex >= remainsFiltered.length && remainsFiltered.length > 0) {
      setCurrentIndex(0);
    }
    triggerConfetti();
  };

  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); setQuizStatus('waiting'); 
    if (latestPool.length === 0) return;

    const sortedPool = [...latestPool].sort((a, b) => (a.streak_correct || 0) - (b.streak_correct || 0));
    let nextItem = sortedPool[0];
    if (latestPool[currentIndex]) {
      nextItem = sortedPool.find(c => c.id !== latestPool[currentIndex].id) || sortedPool[0];
    }
    const newIdx = latestPool.findIndex(c => c.id === nextItem.id);
    setCurrentIndex(newIdx !== -1 ? newIdx : 0);
  };

  const handleQuizSubmit = async (e) => {
    e.preventDefault();
    const currentQuizCard = quizPool[currentIndex];
    if (!currentQuizCard) return;

    const isCorrect = quizInput.trim().toLowerCase() === currentQuizCard.word.trim().toLowerCase();

    if (isCorrect) {
      triggerConfetti();
      playSpeech(currentQuizCard.word);
      const newStreak = (currentQuizCard.streak_correct || 0) + 1;
      const sm2Data = calculateSM2(currentQuizCard, 5); 

      const updatedData = { streak_correct: newStreak, interval: sm2Data.interval * newStreak, repetitions: sm2Data.repetitions };
      await supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      const newPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(newPool);
      nextQuizCard(newPool);
    } else {
      setQuizStatus('wrong');
      const updatedData = { streak_correct: 0, interval: 1 };
      await supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setQuizPool(quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c));
    }
  };

  // 📱 全新改版：手機端手勢操作流（左右滑動換詞 + 徹底封鎖幽靈點擊與下拉刷新）
  const handleTouchStart = (e) => { 
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };
  const handleTouchMove = (e) => { 
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (stage !== 'learn' || currentView !== 'card' || filteredCards.length === 0) return;
    
    const deltaX = touchStartX.current - touchEndX.current;
    const deltaY = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 40; // 觸發滑動的像素閾值

    // 🌟 核心技術修復：只有當橫向位移大於縱向位移時，才判定為有效滑動換詞，完美避開下拉刷新的衝突
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      // 🔥 最關鍵的一行：藉由阻止觸控釋放的預設行為，徹底抹殺手機端 300ms 後發放的「幽靈點擊」，防止卡片意外二次反轉！
      e.preventDefault(); 
      
      if (deltaX > 0) {
        handleNextCard(); // 👈 向左滑動 -> 下一個
      } else {
        handlePrevCard(); // 👉 向右滑動 -> 上一個
      }
    }
    // 清空座標
    touchStartX.current = 0; touchEndX.current = 0;
    touchStartY.current = 0; touchEndY.current = 0;
  };

  const getCatVisuals = (count) => {
    if (count === 0) return { emoji: '😿', status: '精瘦無力', text: '美短和 8.5kg 的緬因正在後方嗷嗷待哺... 快去封印單字生成貓糧！' };
    if (count < 15) return { emoji: '🐱', status: '身材標準', text: '主子們剛剛享用了你背透的貓糧，滿意地拍了拍尾巴，身材非常優雅健康。' };
    if (count < 50) return { emoji: '😸', status: '微胖肚圓', text: '囤積的貓糧充足！主子們的肚子已經肉眼可見地圓滾滾了，奔跑速度下降 10%。' };
    return { emoji: '😹', status: '阿嬤養的豬', text: '哇！封印詞彙量驚人！主子們已經彻底胖成了阿嬤養的巨無霸，連沙發都快被擠爆了！' };
  };

  const getAvailableLevels = () => {
    const lvls = Array.from(new Set(allCards.map(c => c.level)));
    return LEVEL_ORDER.filter(l => lvls.includes(l));
  };

  const getAvailableCategories = (lvl) => {
    const matchCards = allCards.filter(c => c.level === lvl);
    return Array.from(new Set(matchCards.map(c => c.category)));
  };

  const getLibraryPacks = () => {
    const packsMap = {};
    allCards.forEach(card => {
      const key = `${card.level}-${card.category}`;
      if (!packsMap[key]) packsMap[key] = { level: card.level, category: card.category, count: 0 };
      packsMap[key].count += 1;
    });
    return Object.values(packsMap).sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  };

  const selectLevelDoor = (lvl) => {
    setSelectedLevel(lvl); setSelectedCategory('All'); setStage('category');
  };

  const selectCategoryPack = (cat) => {
    setSelectedCategory(cat);
    let temp = [...allCards];
    if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    
    setFilteredCards(temp); setQuizPool(temp); setCurrentIndex(0); setIsFlipped(false);
    setStage('learn');
  };

  const currentCard = filteredCards[currentIndex] || null;
  const currentQuizCard = quizPool[currentIndex] || null;
  const catInfo = getCatVisuals(archivedCount);

  // ==================== STAGE 1: 開屏開飯頁面 ====================
  if (stage === 'splash') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-center p-6 font-sans text-slate-700">
        <div className="bg-white rounded-3xl p-8 border-4 border-teal-300 shadow-2xl max-w-md w-full text-center card-academy">
          <div className="text-7xl block mb-4 animate-bounce select-none">{catInfo.emoji}</div>
          <h1 className="text-2xl font-black text-teal-800 tracking-wider">🐱 貓咪主子開飯簽到處</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cat Feeding Base</p>
          
          <div className="my-6 bg-teal-50/60 rounded-2xl p-4 border border-teal-100 text-left">
            <div className="flex justify-between items-center mb-2 border-b border-teal-100/50 pb-1.5">
              <span className="text-xs font-bold text-slate-400">當前儲備貓糧</span>
              <span className="bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">狀態: {catInfo.status}</span>
            </div>
            <p className="text-sm font-medium text-slate-600 text-center py-1">
              已背透封印：<strong className="text-teal-600 text-2xl font-black mx-1">{archivedCount}</strong> 粒貓糧 罐罐
            </p>
            <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed italic">"{catInfo.text}"</p>
          </div>
          <button onClick={() => setStage('level')} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-lg btn-bouncy">
            罐罐倒好了，推開學院大門 罐罐
          </button>
        </div>
      </div>
    );
  }

  // ==================== STAGE 2: 級別之門大廳 ====================
  if (stage === 'level') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-center p-6 font-sans text-slate-700">
        <div className="w-full max-w-2xl text-center mb-6">
          <h2 className="text-2xl font-black text-teal-800 tracking-wide">🏰 請選擇你今日要挑戰的「級別之門」</h2>
          <p className="text-xs text-slate-400 mt-1">推開對應的大門，解鎖專屬的詞彙領域：</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 w-full max-w-2xl px-2">
          {getAvailableLevels().map(lvl => {
            const count = allCards.filter(c => c.level === lvl).length;
            return (
              <div 
                key={lvl} onClick={() => selectLevelDoor(lvl)}
                className="bg-white border-4 border-teal-500/30 rounded-t-full shadow-lg p-6 h-56 flex flex-col justify-between items-center group cursor-pointer transition-all hover:-translate-y-2 hover:border-teal-500 hover:shadow-xl btn-bouncy relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-teal-500 to-teal-400 opacity-80" />
                <span className="text-4xl mt-4 group-hover:scale-110 transition-transform select-none">🚪</span>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-teal-800 tracking-wider font-mono">{lvl}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Level Door</p>
                </div>
                <span className="bg-teal-50 text-teal-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-teal-100">剩餘 {count} 詞</span>
              </div>
            );
          })}
        </div>
        <button onClick={() => setStage('splash')} className="mt-8 text-xs font-bold text-slate-400 hover:text-teal-600 transition-colors">🔙 返回開飯簽到艙</button>
      </div>
    );
  }

  // ==================== STAGE 3: 主題分類挑選 ====================
  if (stage === 'category') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-center p-6 font-sans text-slate-700">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border-4 border-teal-300 shadow-2xl text-center card-academy">
          <span className="text-5xl block mb-3 select-none">🍗</span>
          <h2 className="text-xl font-black text-teal-900 tracking-wide">級別 {selectedLevel} 傳送成功</h2>
          <p className="text-sm font-bold text-teal-600 mt-1">✨ 選擇你想要的分類吧：</p>
          
          <div className="my-6 flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
            <button 
              onClick={() => selectCategoryPack('All')}
              className="w-full bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border-2 border-slate-200 hover:border-teal-300 font-bold py-3.5 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center btn-bouncy"
            >
              <span>📦 學習全部主題（混戰模式）</span>
              <span className="text-xs text-slate-400 font-mono">共 {allCards.filter(c => c.level === selectedLevel).length} 詞</span>
            </button>

            {getAvailableCategories(selectedLevel).map(cat => {
              const count = allCards.filter(c => c.level === selectedLevel && c.category === cat).length;
              return (
                <button 
                  key={cat} onClick={() => selectCategoryPack(cat)}
                  className="w-full bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border-2 border-slate-200 hover:border-teal-300 font-bold py-3.5 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center btn-bouncy"
                >
                  <span>🗂️ 【{cat}】主題特訓包</span>
                  <span className="text-xs text-teal-600 font-mono font-black">{count} 詞 →</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setStage('level')} className="text-xs font-bold text-slate-400 hover:text-teal-600 transition-colors">🔙 返回更換級別大門</button>
        </div>
      </div>
    );
  }

  // ==================== STAGE 4: 正式核心學習大廳 ====================
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-between p-6 font-sans text-slate-700">
      
      {/* 頂部導航 */}
      <header className="w-full max-w-4xl flex justify-between items-center py-4 border-b border-teal-100/30">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStage('splash')}>
          <span className="text-3xl hover:scale-110 transition-transform select-none">{catInfo.emoji}</span>
          <div>
            <h1 className="text-xl font-black tracking-wider text-teal-800">貓咪閃卡學院</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {selectedLevel} - {selectedCategory === 'All' ? '全部' : selectedCategory} 大廳
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => { setCurrentView('card'); setIsFlipped(false); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all btn-bouncy ${currentView === 'card' ? 'bg-teal-600 text-white' : 'bg-white text-teal-700 border border-teal-100'}`}
          >
            🎴 傳統背卡
          </button>
          <button 
            onClick={() => { setCurrentView('quiz'); setQuizStatus('waiting'); setQuizInput(''); if(currentQuizCard) playSpeech(currentQuizCard.word); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all btn-bouncy ${currentView === 'quiz' ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 border border-amber-100'}`}
          >
            🎯 聽音拼寫考核
          </button>
          <button 
            onClick={() => { setCurrentView('library'); setSelectedLibPack(null); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all btn-bouncy ${currentView === 'library' ? 'bg-slate-600 text-white' : 'bg-white text-slate-700 border border-slate-100'}`}
          >
            📚 單字庫 ({allCards.length})
          </button>
        </div>
      </header>

      {/* A. 傳統背卡視窗 */}
      {currentView === 'card' && (
        <>
          <section className="w-full max-w-md flex justify-between items-center my-2 px-1">
            <div className="flex gap-1.5 items-center">
              <span className="text-xs font-bold text-slate-400">當前關卡:</span>
              <span className="bg-teal-600 text-white text-[10px] font-black font-mono px-2 py-0.5 rounded-md uppercase">{selectedLevel}</span>
              <span className="bg-teal-50 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-teal-100">{selectedCategory === 'All' ? '全部主題' : selectedCategory}</span>
            </div>
            <button onClick={() => setStage('level')} className="text-[11px] font-bold text-teal-600 hover:underline btn-bouncy">🏰 重新選門/換主題 →</button>
          </section>

          <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-1">
            {!currentCard ? (
              <div className="text-center py-12 bg-white/50 rounded-3xl w-full border border-dashed border-teal-200">
                <span className="text-4xl block mb-2">🎉</span>
                <p className="text-sm text-slate-400 font-medium">太厲害了！本包內的單字已全部化為貓糧！</p>
                <button onClick={() => setStage('level')} className="mt-4 bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-xl btn-bouncy">去推開其他級別大門 🚪</button>
              </div>
            ) : (
              <>
                <div className="w-full mb-2 px-2 flex justify-between text-xs text-slate-400 items-center">
                  <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">📋 進度: {currentIndex + 1} / {filteredCards.length} 詞</span>
                  <button 
                    onClick={(e) => handleArchiveCard(currentCard.id, e)} 
                    className="text-rose-500 hover:text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200 btn-bouncy"
                  >
                    🐾 掌握並產出貓糧 🥫
                  </button>
                  <span>複考: <strong className="text-teal-600">{currentCard?.interval || 1}天</strong></span>
                </div>

                {/* 🌟 核心卡片容器：增加 touchAction: 'none' 完全隔絕手機下拉頁面重新整理的干擾 */}
                <div 
                  style={{ touchAction: 'none' }}
                  onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                  onClick={() => { playSpeech(currentCard?.word); setIsFlipped(!isFlipped); }} 
                  className="w-full h-80 cursor-pointer [perspective:1000px] select-none"
                >
                  <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    {/* 正面 */}
                    <div className="absolute inset-0 w-full h-full bg-white rounded-3xl flex flex-col items-center justify-between p-8 border-4 border-teal-200 [backface-visibility:hidden] card-academy">
                      <div className="text-right w-full text-[11px] text-teal-600 font-bold bg-teal-50/50 px-2 py-0.5 rounded-full">📱 支援左右滑動切換單字 🐾</div>
                      <div className="flex flex-col items-center justify-center flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-5xl font-black text-teal-700 tracking-tight">{currentCard?.word}</span>
                          <button onClick={(e) => { playSpeech(currentCard?.word, e); }} className="p-2 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-100 btn-bouncy">🔊</button>
                        </div>
                        <span className="text-lg text-slate-400 mt-2 font-mono">{currentCard?.phonetic}</span>
                      </div>
                      <div className="text-teal-400 font-medium text-[11px]">🐱 點擊卡片任何地方翻面查看答案</div>
                    </div>
                    {/* 背面 */}
                    <div className="absolute inset-0 w-full h-full bg-teal-50 rounded-3xl flex flex-col items-center justify-between p-8 border-4 border-teal-300 [backface-visibility:hidden] [transform:rotateY(180deg)] card-academy pointer-events-none">
                      <div className="text-right w-full text-xs text-slate-400">答案揭曉 🐾</div>
                      <div className="flex flex-col items-center px-2">
                        <span className="text-3xl font-bold text-teal-800 mb-4">{currentCard?.translation}</span>
                        <p className="text-sm font-medium text-slate-600 text-center leading-relaxed mb-1">"{currentCard?.sentence}"</p>
                        <p className="text-xs text-slate-400 text-center">({currentCard?.translation_cn})</p>
                      </div>
                      <div className="text-xs text-teal-600 font-semibold bg-white px-3 py-1 rounded-full border border-teal-200">🐾 下方按鈕可隨時打分</div>
                    </div>
                  </div>
                </div>

                {/* 🛠️ 升級 3：新增高質感的左右切換手動按鈕控制列 */}
                <div className="w-full grid grid-cols-3 gap-3 mt-4">
                  <button onClick={(e) => { e.stopPropagation(); handlePrevCard(); }} className="bg-white hover:bg-teal-50 text-teal-700 font-extrabold py-2.5 px-2 rounded-xl border border-teal-200 text-xs shadow-sm btn-bouncy flex items-center justify-center gap-1">
                    ◀️ 上一個
                  </button>
                  <button onClick={() => setIsFlipped(!isFlipped)} className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2.5 px-2 rounded-xl shadow-sm text-xs btn-bouncy">
                    🔄 點擊翻面
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleNextCard(); }} className="bg-white hover:bg-teal-50 text-teal-700 font-extrabold py-2.5 px-2 rounded-xl border border-teal-200 text-xs shadow-sm btn-bouncy flex items-center justify-center gap-1">
                    下一個 ▶️
                  </button>
                </div>

                {/* 常駐評分大按鈕 */}
                <div className="w-full mt-3 z-10 relative flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-2.5">
                    <button onClick={(e) => { e.stopPropagation(); handleGrade(0); }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-3 px-1 rounded-2xl border border-rose-200 text-center btn-bouncy flex flex-col items-center"><span className="text-xl block mb-0.5">❌</span><span className="text-xs">遺忘了</span></button>
                    <button onClick={(e) => { e.stopPropagation(); handleGrade(3); }} className="bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold py-3 px-1 rounded-2xl border border-amber-200 text-center btn-bouncy flex flex-col items-center"><span className="text-xl block mb-0.5">😮</span><span className="text-xs">模糊糊</span></button>
                    <button onClick={(e) => { e.stopPropagation(); handleGrade(5); }} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-3 px-1 rounded-2xl border border-emerald-200 text-center btn-bouncy flex flex-col items-center"><span className="text-xl block mb-0.5">😻</span><span className="text-xs">秒記住</span></button>
                  </div>
                </div>

                {/* 🛠️ 升級 4：底部高對比操作提示區 */}
                <div className="mt-4 text-[11px] text-slate-400 font-medium text-center bg-white/60 px-4 py-2 rounded-xl border border-slate-200/50">
                  💡 提示：電腦端支援鍵盤 <span className="bg-slate-200 text-slate-800 px-1 rounded font-mono font-bold">←</span> 與 <span className="bg-slate-200 text-slate-800 px-1 rounded font-mono font-bold">→</span> 方向鍵發音換詞
                </div>
              </>
            )}
          </main>
        </>
      )}

      {/* B. 聽音拼寫考核視窗 */}
      {currentView === 'quiz' && (
        <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-4">
          {!currentQuizCard ? (
            <div className="text-center py-12 bg-white/50 rounded-3xl w-full border border-dashed border-teal-200">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="text-sm text-slate-400 font-medium">考核隊列空空如也，你太厲害了！</p>
            </div>
          ) : (
            <div className="w-full bg-white rounded-3xl p-8 border-4 border-amber-300 shadow-xl card-academy relative flex flex-col justify-between h-[26rem]">
              <div className="flex justify-between items-center w-full text-xs text-slate-400">
                <div className="flex gap-1.5">
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">🎯 連對: {currentQuizCard.streak_correct || 0} 次</span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">📦 剩餘: {quizPool.length} 詞</span>
                </div>
                <button onClick={(e) => handleArchiveCard(currentQuizCard.id, e)} className="text-rose-500 hover:text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full text-[10px] border border-rose-200 btn-bouncy">🐾 掌握並產出貓糧 🥫</button>
              </div>

              <div className="flex flex-col items-center justify-center my-4 flex-1 gap-2">
                <button type="button" onClick={() => playSpeech(currentQuizCard.word)} className="p-4 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 text-2xl border-2 border-amber-200 shadow-md animate-pulse btn-bouncy">🔊 點擊聽音拼寫</button>
                <div className="text-center mt-4">
                  <span className="text-2xl font-black text-slate-800">{currentQuizCard.translation}</span>
                  <p className="text-xs text-slate-400 mt-1 font-mono">級別: {currentQuizCard.level} | 場景: {currentQuizCard.category}</p>
                </div>
              </div>

              <form onSubmit={handleQuizSubmit} className="w-full flex flex-col gap-3">
                {quizStatus === 'waiting' ? (
                  <div className="flex gap-2">
                    <input 
                      type="text" placeholder="請拼寫英文單字..." value={quizInput} onChange={(e) => setQuizInput(e.target.value)}
                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 font-bold text-center tracking-wide" autoFocus
                    />
                    <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 rounded-xl text-sm btn-bouncy">提交</button>
                  </div>
                ) : (
                  <div className="text-center py-1 flex flex-col gap-3">
                    {quizStatus === 'wrong' && (
                      <div className="bg-rose-100 border border-rose-300 text-rose-800 font-bold py-3 rounded-xl text-sm px-2">
                        🙀 答錯連對歸零。正確答案是: <strong className="underline text-base ml-1 font-mono">{currentQuizCard.word}</strong>
                        <p className="text-xs font-normal text-slate-500 mt-1">"{currentQuizCard.sentence}" ({currentQuizCard.translation_cn})</p>
                        <button ref={nextBtnRef} type="button" onClick={() => nextQuizCard()} className="w-full mt-2 bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs btn-bouncy">看懂了，下一題 🐾 (Enter)</button>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          )}
        </main>
      )}

      {/* C. 📚 全域單字庫資料夾視窗 */}
      {currentView === 'library' && (
        <main className="w-full max-w-4xl flex-1 flex flex-col my-2 overflow-hidden">
          {!selectedLibPack ? (
            <>
              <div className="text-center py-4">
                <h2 className="text-xl font-black text-teal-800">📚 級別單字包資料夾大廳</h2>
                <p className="text-xs text-slate-400 mt-1">系統已自動為您的詞彙進行分組，請選擇資料夾進入管理：</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 max-h-[55vh]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {getLibraryPacks().map(pack => (
                    <div 
                      key={`${pack.level}-${pack.category}`} onClick={() => setSelectedLibPack(pack)}
                      className="bg-white rounded-2xl p-5 border-2 border-teal-100 hover:border-teal-400 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between items-start group btn-bouncy"
                    >
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🗂️</div>
                      <div>
                        <span className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full font-black uppercase font-mono">{pack.level}</span>
                        <h3 className="text-sm font-bold text-slate-800 mt-1 group-hover:text-teal-600">{pack.category} 特訓包</h3>
                      </div>
                      <div className="w-full border-t border-slate-100 mt-3 pt-2 text-right">
                        <span className="text-xs font-bold text-slate-400 group-hover:text-teal-500">共 <strong className="text-teal-600 font-black">{pack.count}</strong> 詞 →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="py-3 flex justify-between items-center border-b border-teal-100/50 mb-3">
                <button onClick={() => setSelectedLibPack(null)} className="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-teal-100 hover:bg-teal-100 btn-bouncy">🔙 返回資料夾大廳</button>
                <div className="text-right">
                  <span className="text-xs bg-teal-600 text-white font-black px-2 py-0.5 rounded-md uppercase font-mono mr-1">{selectedLibPack.level}</span>
                  <span className="text-sm font-black text-slate-800">【{selectedLibPack.category}】分組清單</span>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto rounded-3xl border border-teal-100/50 shadow-sm bg-white max-h-[45vh]">
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead className="bg-teal-50/80 text-teal-900 font-bold sticky top-0 border-b border-teal-100 z-10">
                    <tr>
                      <th className="px-4 py-3">單字</th>
                      <th className="px-4 py-3">中文翻譯</th>
                      <th className="px-3 py-3 text-center">考核連對</th>
                      <th className="px-3 py-3 text-center">複考間隔</th>
                      <th className="px-3 py-3 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allCards
                      .filter(card => card.level === selectedLibPack.level && card.category === selectedLibPack.category)
                      .map((card) => (
                        <tr key={card.id} className="hover:bg-teal-50/10">
                          <td className="px-4 py-3 font-bold text-teal-850 text-sm font-mono tracking-wide">{card.word}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{card.translation}</td>
                          <td className="px-3 py-3 text-center font-bold text-amber-600">{card.streak_correct || 0} 次</td>
                          <td className="px-3 py-3 text-center font-bold text-teal-600">{card.interval || 1}天</td>
                          <td className="px-3 py-3 text-center">
                            <button 
                              onClick={(e) => {
                                handleArchiveCard(card.id, e);
                                const remains = allCards.filter(c => c.id !== card.id && c.level === selectedLibPack.level && c.category === selectedLibPack.category);
                                if (remains.length === 0) setSelectedLibPack(null);
                              }} 
                              className="text-rose-500 hover:underline text-[11px] font-bold btn-bouncy"
                            >
                              永久封印 🐾
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      )}

      <footer className="w-full max-w-4xl text-center py-1 text-xs text-slate-400 mt-2">
        儲備貓糧與關卡數據已同步至雲端 ☁️ | 點擊左上角頭像可隨時回到開飯簽到艙
      </footer>
    </div>
  );
}

export default App;
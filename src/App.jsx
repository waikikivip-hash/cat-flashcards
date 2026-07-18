import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';

const LEVEL_ORDER = [
  'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 
  'TOEFL', 'IELTS', 'GRE', 
  'Business', 'Medical', 'Academic', 'Coding'
];

function App() {
  const [allCards, setAllCards] = useState([]);      
  const [filteredCards, setFilteredCards] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);    
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 篩選器的狀態
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // 控制視窗切換 ( 'learn' = 傳統背卡, 'quiz' = 聽音拼寫考核 🔥, 'library' = 單字庫 )
  const [currentView, setCurrentView] = useState('learn');

  // 單字庫分組管理專用狀態 🗂️
  const [selectedLibPack, setSelectedLibPack] = useState(null); // 記錄當前點開的資料夾，例如 {level: 'A1', category: '生活'}

  // 考核模式專用狀態
  const [quizInput, setQuizInput] = useState(''); 
  const [quizStatus, setQuizStatus] = useState('waiting'); 
  const [quizPool, setQuizPool] = useState([]); 

  const utteranceRef = useRef(null);
  const nextBtnRef = useRef(null); 

  // 1. 自動讀取雲端數據
  useEffect(() => {
    fetchCards();
  }, []);

  // 監聽鍵盤事件：當答錯時，敲擊回車鍵（Enter）自動進入下一題
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (currentView === 'quiz' && quizStatus === 'wrong' && e.key === 'Enter') {
        e.preventDefault();
        nextQuizCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, quizStatus, quizPool, currentIndex]);

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
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('is_archived', false) 
        .order('id', { ascending: true });

      if (error) throw error;
      const cards = data || [];
      setAllCards(cards);
      
      let temp = [...cards];
      if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
      if (selectedCategory !== 'All') temp = temp.filter(card => card.category === selectedCategory);
      setFilteredCards(temp); 
      setCurrentIndex(0);

      setQuizPool(cards);
    } catch (error) {
      console.error('讀取雲端數據失敗:', error.message);
      alert('無法連線到雲端資料庫，請檢查您的 .env 設定！');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelChange = (e) => {
    const lvl = e.target.value;
    setSelectedLevel(lvl);
    applyFilters(lvl, selectedCategory);
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setSelectedCategory(cat);
    applyFilters(selectedLevel, cat);
  };

  const applyFilters = (lvl, cat) => {
    if (allCards.length === 0) return;
    let temp = [...allCards];
    if (lvl !== 'All') temp = temp.filter(card => card.level === lvl);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    setFilteredCards(temp);
    setCurrentIndex(0); 
    setIsFlipped(false);
    if (temp.length > 0) playSpeech(temp[0].word);
  };

  // 🔊 發音函數
  const playSpeech = (text, e) => {
    if (e) e.stopPropagation();
    if (!text || !window.speechSynthesis) return;
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel(); 
    } catch (err) {
      console.error("重置語音通道失敗:", err);
    }

    setTimeout(() => {
      try {
        utteranceRef.current = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en-US') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Ava'))) || voices.find(v => v.lang.includes('en-US'));
        if (preferredVoice) utteranceRef.current.voice = preferredVoice;
        else utteranceRef.current.lang = 'en-US';
        utteranceRef.current.rate = 0.85;

        utteranceRef.current.onend = () => { utteranceRef.current = null; };
        utteranceRef.current.onerror = () => { utteranceRef.current = null; };
        window.speechSynthesis.speak(utteranceRef.current);
      } catch (err) {
        console.error("TTS 播放失敗:", err);
      }
    }, 20);
  };

  const triggerConfetti = () => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#2DD4BF', '#FBBF24', '#F43F5E'] });
  };

  // SM-2 演算法
  const calculateSM2 = (card, quality) => {
    let nextInterval = 1;
    let nextRepetitions = card.repetitions || 0;
    let nextEasiness = card.easiness || 2.5;

    if (quality < 3) {
      nextRepetitions = 0;
      nextInterval = 1;
    } else {
      if (nextRepetitions === 0) nextInterval = 1;
      else if (nextRepetitions === 1) nextInterval = 6;
      else nextInterval = Math.round(card.interval * card.easiness);
      nextRepetitions += 1;
    }

    nextEasiness = card.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (nextEasiness < 1.3) nextEasiness = 1.3;

    return {
      interval: nextInterval,
      repetitions: nextRepetitions,
      easiness: Number(nextEasiness.toFixed(2)),
      next_review: Math.round(Date.now() / 1000) + nextInterval * 60, 
    };
  };

  // 傳統背卡評分
  const handleGrade = async (quality) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    if (quality === 5) triggerConfetti();

    const sm2Data = calculateSM2(currentCard, quality);
    const updatedCard = { ...currentCard, ...sm2Data };

    await supabase.from('words').update({
      interval: sm2Data.interval,
      repetitions: sm2Data.repetitions,
      easiness: sm2Data.easiness,
      next_review: sm2Data.next_review
    }).eq('id', currentCard.id);

    const updatedAll = allCards.map(c => c.id === currentCard.id ? updatedCard : c);
    setAllCards(updatedAll);
    
    const updatedFiltered = filteredCards.map(c => c.id === currentCard.id ? updatedCard : c);
    setFilteredCards(updatedFiltered);
    setIsFlipped(false);

    if (updatedFiltered.length <= 1) return;
    setCurrentIndex((currentIndex + 1) % updatedFiltered.length);
  };

  // 手動永久移除/歸檔封印
  const handleArchiveCard = async (cardId, e) => {
    if (e) e.stopPropagation();
    const confirmArchive = window.confirm("確定已永久掌握此單字？封印後它將徹底移出複習庫與考核大廳！🐾");
    if (!confirmArchive) return;

    await supabase.from('words').update({ is_archived: true }).eq('id', cardId);

    const remainsAll = allCards.filter(c => c.id !== cardId);
    setAllCards(remainsAll);
    
    const remainsFiltered = filteredCards.filter(c => c.id !== cardId);
    setFilteredCards(remainsFiltered);
    
    const remainsQuiz = quizPool.filter(c => c.id !== cardId);
    setQuizPool(remainsQuiz);

    setIsFlipped(false);
    
    if (currentView === 'quiz') {
      setQuizInput('');
      setQuizStatus('waiting');
      if (currentIndex >= remainsQuiz.length && remainsQuiz.length > 0) {
        setCurrentIndex(0);
      }
      if (remainsQuiz.length > 0) {
        setTimeout(() => {
          if (remainsQuiz[0]) playSpeech(remainsQuiz[0].word);
        }, 200);
      }
    } else {
      if (currentIndex >= remainsFiltered.length && remainsFiltered.length > 0) {
        setCurrentIndex(0);
      }
    }
    triggerConfetti();
  };

  // 切換下一題的核心控制函數
  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput('');
    setQuizStatus('waiting'); 
    
    if (latestPool.length === 0) return;

    const sortedPool = [...latestPool].sort((a, b) => (a.streak_correct || 0) - (b.streak_correct || 0));
    
    let nextItem = sortedPool[0];
    if (latestPool[currentIndex]) {
      nextItem = sortedPool.find(c => c.id !== latestPool[currentIndex].id) || sortedPool[0];
    }
    
    const newIdx = latestPool.findIndex(c => c.id === nextItem.id);
    const targetIdx = newIdx !== -1 ? newIdx : 0;
    
    setCurrentIndex(targetIdx);

    if (latestPool[targetIdx]) {
      setTimeout(() => {
        playSpeech(latestPool[targetIdx].word);
      }, 50);
    }
  };

  // 聽音拼寫考核提交
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

      const updatedData = {
        streak_correct: newStreak,
        interval: sm2Data.interval * newStreak,
        repetitions: sm2Data.repetitions
      };

      await supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      
      const newAllCards = allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setAllCards(newAllCards);

      const newFiltered = filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setFilteredCards(newFiltered);

      const newPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(newPool);

      nextQuizCard(newPool);

    } else {
      setQuizStatus('wrong');
      const updatedData = { streak_correct: 0, interval: 1 };
      await supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };

      const newAllCards = allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setAllCards(newAllCards);

      const newFiltered = filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setFilteredCards(newFiltered);

      const newPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(newPool);

      setTimeout(() => {
        if (nextBtnRef.current) nextBtnRef.current.focus();
      }, 50);
    }
  };

  // 🗂️ 自動計算並生成「單字包資料夾」數據的函數
  const getPacks = () => {
    const packsMap = {};
    allCards.forEach(card => {
      const key = `${card.level}-${card.category}`;
      if (!packsMap[key]) {
        packsMap[key] = { level: card.level, category: card.category, count: 0 };
      }
      packsMap[key].count += 1;
    });
    // 依據級別順序排序，讓排版更漂亮
    return Object.values(packsMap).sort((a, b) => {
      return LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    });
  };

  const currentCard = filteredCards[currentIndex] || null;
  const currentQuizCard = quizPool[currentIndex] || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EBF8FF] to-[#E6FFFA] flex flex-col items-center justify-between p-6 font-sans text-slate-700">
      
      {/* 導航欄 */}
      <header className="w-full max-w-4xl flex justify-between items-center py-4 border-b border-teal-100/30">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🐱</span>
          <div>
            <h1 className="text-xl font-black tracking-wider text-teal-800">貓咪閃卡學院</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cat Flashcard Academy</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => { setCurrentView('learn'); setIsFlipped(false); }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all btn-bouncy ${currentView === 'learn' ? 'bg-teal-600 text-white' : 'bg-white text-teal-700 border border-teal-100'}`}
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

      {/* 1. 傳統背卡模式 */}
      {currentView === 'learn' && (
        <>
          <section className="w-full max-w-md bg-white/70 backdrop-blur-md p-3 rounded-2xl shadow-sm border border-teal-100/50 flex gap-2 my-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">難度級別</label>
              <select value={selectedLevel} onChange={handleLevelChange} className="w-full bg-teal-50 border border-teal-100 text-slate-600 rounded-xl px-2 py-1.5 text-xs focus:outline-none">
                <option value="All">全部級別</option>
                {Array.from(new Set(allCards.map(c => c.level))).map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">主題場景</label>
              <select value={selectedCategory} onChange={handleCategoryChange} className="w-full bg-teal-50 border border-teal-100 text-slate-600 rounded-xl px-2 py-1.5 text-xs focus:outline-none">
                <option value="All">全部場景</option>
                {Array.from(new Set(allCards.map(c => c.category))).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </section>

          <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-2">
            {!currentCard ? (
              <div className="text-center py-12 bg-white/50 rounded-3xl w-full border border-dashed border-teal-200">
                <span className="text-4xl block mb-2">🙀</span>
                <p className="text-sm text-slate-400 font-medium">資料庫裡空空的，快去添加單字吧～</p>
              </div>
            ) : (
              <>
                {/* ⚡ 升級 1：傳統背卡頂部增加當前組別的單字總量與進度顯示 */}
                <div className="w-full mb-2 px-2 flex justify-between text-xs text-slate-400 items-center">
                  <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                    📋 當前進度: {filteredCards.length > 0 ? currentIndex + 1 : 0} / {filteredCards.length} 詞
                  </span>
                  <button 
                    onClick={(e) => handleArchiveCard(currentCard.id, e)} 
                    className="text-rose-500 hover:text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full text-[10px] btn-bouncy"
                  >
                    🐾 永久掌握（封印）
                  </button>
                  <span>複考: <strong className="text-teal-600">{currentCard?.interval || 1}天</strong></span>
                </div>

                <div onClick={() => { playSpeech(currentCard?.word); setIsFlipped(!isFlipped); }} className="w-full h-80 cursor-pointer [perspective:1000px]">
                  <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    
                    {/* 正面 */}
                    <div className="absolute inset-0 w-full h-full bg-white rounded-3xl flex flex-col items-center justify-between p-8 border-4 border-teal-200 [backface-visibility:hidden] card-academy">
                      <div className="text-right w-full text-xs text-slate-400">點擊卡片翻面 🐾</div>
                      <div className="flex flex-col items-center justify-center flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-5xl font-black text-teal-700 tracking-tight">{currentCard?.word}</span>
                          <button onClick={(e) => playSpeech(currentCard?.word, e)} className="p-2 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-100 btn-bouncy">🔊</button>
                        </div>
                        <span className="text-lg text-slate-400 mt-2 font-mono">{currentCard?.phonetic}</span>
                      </div>
                      <div className="text-teal-500 font-medium">🐱 喵～點我揭曉答案！</div>
                    </div>

                    {/* 背面 */}
                    <div className="absolute inset-0 w-full h-full bg-teal-50 rounded-3xl flex flex-col items-center justify-between p-8 border-4 border-teal-300 [backface-visibility:hidden] [transform:rotateY(180deg)] card-academy pointer-events-none">
                      <div className="text-right w-full text-xs text-slate-400">背面 🐾</div>
                      <div className="flex flex-col items-center px-2">
                        <span className="text-3xl font-bold text-teal-800 mb-4">{currentCard?.translation}</span>
                        <p className="text-sm font-medium text-slate-600 text-center leading-relaxed mb-1">"{currentCard?.sentence}"</p>
                        <p className="text-xs text-slate-400 text-center">({currentCard?.translation_cn})</p>
                      </div>
                      <div className="text-xs text-teal-600 font-semibold bg-white px-3 py-1 rounded-full border border-teal-200">🐾 請為你的記憶程度評分</div>
                    </div>

                  </div>
                </div>

                {/* 評分按鈕 */}
                <div className="w-full mt-6 z-10 relative">
                  {isFlipped ? (
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={(e) => { e.stopPropagation(); handleGrade(0); }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-3 px-2 rounded-2xl border border-rose-200 text-center btn-bouncy"><span className="text-2xl block">❌</span><span className="text-xs">遺忘了</span></button>
                      <button onClick={(e) => { e.stopPropagation(); handleGrade(3); }} className="bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold py-3 px-2 rounded-2xl border border-amber-200 text-center btn-bouncy"><span className="text-2xl block">😮</span><span className="text-xs">模糊糊</span></button>
                      <button onClick={(e) => { e.stopPropagation(); handleGrade(5); }} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-3 px-2 rounded-2xl border border-emerald-200 text-center btn-bouncy"><span className="text-2xl block">😻</span><span className="text-xs">秒記住</span></button>
                    </div>
                  ) : (
                    <button onClick={() => setIsFlipped(true)} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-center text-lg flex items-center justify-center gap-2 btn-bouncy"><span>點擊卡片翻面 🐾</span></button>
                  )}
                </div>
              </>
            )}
          </main>
        </>
      )}

      {/* 2. 🔥 聽音拼寫考核模式 🔥 */}
      {currentView === 'quiz' && (
        <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-4">
          {!currentQuizCard ? (
            <div className="text-center py-12 bg-white/50 rounded-3xl w-full border border-dashed border-teal-200">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="text-sm text-slate-400 font-medium">考核隊列空空如也，你太厲害了！</p>
            </div>
          ) : (
            <div className="w-full bg-white rounded-3xl p-8 border-4 border-amber-300 shadow-xl card-academy relative flex flex-col justify-between h-[26rem]">
              
              {/* ⚡ 升級 2：考核模式頂部精準展示剩餘特訓單字數量 */}
              <div className="flex justify-between items-center w-full text-xs text-slate-400">
                <div className="flex gap-1.5">
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">🎯 連對: {currentQuizCard.streak_correct || 0} 次</span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">📦 剩餘: {quizPool.length} 詞</span>
                </div>
                <button 
                  onClick={(e) => handleArchiveCard(currentQuizCard.id, e)} 
                  className="text-rose-500 hover:text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-full text-[10px] btn-bouncy"
                >
                  🐾 永久掌握（封印）
                </button>
              </div>

              <div className="flex flex-col items-center justify-center my-4 flex-1 gap-2">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => playSpeech(currentQuizCard.word)} className="p-4 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 text-2xl border-2 border-amber-200 shadow-md animate-pulse btn-bouncy">
                    🔊 點擊聽音拼寫
                  </button>
                </div>
                
                <div className="text-center mt-4">
                  <span className="text-2xl font-black text-slate-800">{currentQuizCard.translation}</span>
                  <p className="text-xs text-slate-400 mt-1 font-mono">級別: {currentQuizCard.level} | 場景: {currentQuizCard.category}</p>
                </div>
              </div>

              {/* 輸入與反饋表單 */}
              <form onSubmit={handleQuizSubmit} className="w-full flex flex-col gap-3">
                {quizStatus === 'waiting' ? (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="請拼寫出你聽到的英文單字..." 
                      value={quizInput}
                      onChange={(e) => setQuizInput(e.target.value)}
                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 font-bold text-center tracking-wide"
                      autoFocus
                    />
                    <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 rounded-xl text-sm btn-bouncy">提交</button>
                  </div>
                ) : (
                  <div className="text-center py-1 flex flex-col gap-3">
                    {quizStatus === 'wrong' && (
                      <div className="bg-rose-100 border border-rose-300 text-rose-800 font-bold py-3 rounded-xl text-sm px-2">
                        🙀 喔不！答錯了，連對歸零。正確答案是: <strong className="underline text-base ml-1">{currentQuizCard.word}</strong>
                        <p className="text-xs font-normal text-slate-500 mt-1">"{currentQuizCard.sentence}" ({currentQuizCard.translation_cn})</p>
                        <button 
                          ref={nextBtnRef}
                          type="button" 
                          onClick={() => nextQuizCard()} 
                          className="w-full mt-2 bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs btn-bouncy focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        >
                          看懂了，下一題 🐾 (可直接敲回車)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </form>

            </div>
          )}
        </main>
      )}

      {/* 3. 📚 單字庫分組分包大廳模式（全面重構，告別雜亂！） */}
      {currentView === 'library' && (
        <main className="w-full max-w-4xl flex-1 flex flex-col my-2 overflow-hidden">
          
          {/* A. 尚未選擇資料夾：展示「精美單字包資料夾大廳」 🗂️ */}
          {!selectedLibPack ? (
            <>
              <div className="text-center py-4">
                <h2 className="text-xl font-black text-teal-800">📚 級別單字包資料夾大廳</h2>
                <p className="text-xs text-slate-400 mt-1">系統已自動為您的詞彙進行分組，請選擇資料夾進入管理：</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 max-h-[55vh]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {getPacks().map(pack => (
                    <div 
                      key={`${pack.level}-${pack.category}`}
                      onClick={() => setSelectedLibPack(pack)}
                      className="bg-white rounded-2xl p-5 border-2 border-teal-100 hover:border-teal-400 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between items-start group relative overflow-hidden btn-bouncy"
                    >
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🗂️</div>
                      <div>
                        <span className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">{pack.level}</span>
                        <h3 className="text-sm font-bold text-slate-800 mt-1 group-hover:text-teal-600">{pack.category} 特訓包</h3>
                      </div>
                      <div className="w-full border-t border-slate-100 mt-3 pt-2 text-right">
                        <span className="text-xs font-bold text-slate-400 group-hover:text-teal-500">共 <strong className="text-teal-600 font-black">{pack.count}</strong> 個單字 →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* B. 已選擇某個資料夾：單獨展示該分組內部的單字清單 📄 */
            <>
              <div className="py-3 flex justify-between items-center border-b border-teal-100/50 mb-3">
                <button 
                  onClick={() => setSelectedLibPack(null)}
                  className="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-teal-100 hover:bg-teal-100 transition-colors btn-bouncy flex items-center gap-1"
                >
                  🔙 返回資料夾大廳
                </button>
                <div className="text-right">
                  <span className="text-xs bg-teal-600 text-white font-black px-2 py-0.5 rounded-md uppercase mr-1">{selectedLibPack.level}</span>
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
                          <td className="px-4 py-3 font-bold text-teal-850 text-sm tracking-wide">{card.word}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{card.translation}</td>
                          <td className="px-3 py-3 text-center font-bold text-amber-600">{card.streak_correct || 0} 次</td>
                          <td className="px-3 py-3 text-center font-bold text-teal-600">{card.interval || 1}天</td>
                          <td className="px-3 py-3 text-center">
                            <button 
                              onClick={(e) => {
                                handleArchiveCard(card.id, e);
                                // 如果封印後該分組空了，自動退回大廳
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

      <footer className="w-full max-w-4xl text-center py-1 text-xs text-slate-400 mt-2">聽音拼寫與手動封印數據已即時同步至 Supabase 雲端 ☁️</footer>
    </div>
  );
}

export default App;
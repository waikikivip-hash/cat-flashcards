// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';
import { 
  LEVEL_ORDER, mapCategory, isCardDue, shuffleArray, 
  playErrorSound, calculateNextReview, getCatVisuals, cleanWord 
} from './utils';

import HomeView from './components/HomeView';
import LevelSelectionView from './components/LevelSelectionView';
import CategorySelectionView from './components/CategorySelectionView';
import Header from './components/Header';
import FlashcardView from './components/FlashcardView';
import DictationView from './components/DictationView';
import LibraryView from './components/LibraryView';

export default function App() {
  const [rawCards, setRawCards] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [filteredCards, setFilteredCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [archivedCount, setArchivedCount] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLibPack, setSelectedLibPack] = useState(null); 

  const [quizInput, setQuizInput] = useState('');
  const [quizStatus, setQuizStatus] = useState('waiting');
  const [quizPool, setQuizPool] = useState([]);

  const [stage, setStage] = useState('splash');
  const [currentView, setCurrentView] = useState('flashcard');
  const [hallLevel, setHallLevel] = useState('A1');
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [speakingText, setSpeakingText] = useState(null);

  const [pendingArchiveCard, setPendingArchiveCard] = useState(null);

  const utteranceRef = useRef(null);
  const quizInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  useEffect(() => {
    fetchCards();
    const handleVisibility = () => { 
      if (document.hidden && window.speechSynthesis) {
        window.speechSynthesis.cancel(); 
        setSpeakingText(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (currentView === 'dictation' && quizStatus === 'wrong' && e.key === 'Enter') {
        e.preventDefault();
        nextQuizCard();
      }
      if (currentView === 'flashcard' && filteredCards.length > 0 && !pendingArchiveCard) {
        if (e.key === 'ArrowRight') { e.preventDefault(); handleNextCard(); } 
        else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevCard(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, quizStatus, quizPool, filteredCards, currentIndex, pendingArchiveCard]);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      let allWordsData = [];
      let from = 0;
      const step = 1000; 
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase.from('words').select('*').order('id', { ascending: true }).range(from, from + step - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allWordsData = [...allWordsData, ...data];
          if (data.length < step) hasMore = false; else from += step;
        } else hasMore = false;
      }

      const cards = allWordsData.map((c) => ({ ...c, category: mapCategory(c.level, c.category) }));
      setRawCards(cards); 
      const active = cards.filter(c => !c.is_archived);
      const archived = cards.filter(c => c.is_archived);
      setAllCards(active);
      setArchivedCount(archived.length); 
      setQuizPool(active);
      setFilteredCards(active);
    } catch (error) {
      console.error('获取数据失败:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const playSpeech = (text, e, isWrong = false, customRate = null) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    setSpeakingText(null);

    setTimeout(() => {
      try {
        utteranceRef.current = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en-US') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Ava'))) || voices.find(v => v.lang.includes('en-US'));
        if (preferredVoice) utteranceRef.current.voice = preferredVoice;
        
        if (customRate !== null) {
          utteranceRef.current.rate = customRate;
        } else if (currentView === 'dictation') {
          utteranceRef.current.rate = isWrong ? 1.05 : 1.0; 
        } else {
          utteranceRef.current.rate = isWrong ? 1.05 : 0.75; 
        }

        utteranceRef.current.pitch = isWrong ? 1.35 : 1.0;
        utteranceRef.current.onstart = () => setSpeakingText(text);
        utteranceRef.current.onend = () => setSpeakingText(null);
        utteranceRef.current.onerror = () => setSpeakingText(null);

        window.speechSynthesis.speak(utteranceRef.current);
      } catch (err) {
        setSpeakingText(null);
      }
    }, 50);
  };

  const triggerFeedback = (msg) => {
    setFeedbackMsg(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedbackMsg(null), 1500);
  };

  const handleGrade = (quality) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    if (quality === 5) confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
    if (quality === 0) triggerFeedback('❌ 记忆重置，马上重新复习');
    else if (quality === 3) triggerFeedback('😮 计划不变，再接再厉');
    else if (quality === 5) triggerFeedback('😻 太棒了！已顺利进入下一复习阶段');

    const reviewData = calculateNextReview(currentCard, quality);
    const updatedCard = { ...currentCard, ...reviewData };

    supabase.from('words').update({
      interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review
    }).eq('id', currentCard.id).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));

    setAllCards(prev => prev.map(c => c.id === currentCard.id ? updatedCard : c));
    setRawCards(prev => prev.map(c => c.id === currentCard.id ? updatedCard : c)); 
    
    let updatedFiltered = filteredCards;
    if (quality >= 3) updatedFiltered = filteredCards.filter(c => c.id !== currentCard.id);
    else updatedFiltered = [...filteredCards.filter(c => c.id !== currentCard.id), updatedCard];

    setIsFlipped(false);
    setTimeout(() => {
      setFilteredCards(updatedFiltered);
      if (updatedFiltered.length === 0) return;
      const nextIdx = currentIndex % updatedFiltered.length;
      setCurrentIndex(nextIdx);
      // 主动点击打分后，朗读下一题
      if (updatedFiltered[nextIdx]) playSpeech(updatedFiltered[nextIdx].word);
    }, 250);
  };

  const handleArchiveCard = (cardId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    supabase.from('words').update({ is_archived: true }).eq('id', cardId).catch(() => {});
    setArchivedCount(prev => prev + 1);

    setAllCards(prev => prev.filter(c => c.id !== cardId));
    setRawCards(prev => prev.map(c => c.id === cardId ? { ...c, is_archived: true } : c)); 
    const remainsFiltered = filteredCards.filter(c => c.id !== cardId);
    
    setIsFlipped(false);
    setTimeout(() => {
      setFilteredCards(remainsFiltered);
      setQuizPool(prev => prev.filter(c => c.id !== cardId));
      if (remainsFiltered.length > 0) {
        const nextIdx = currentIndex % remainsFiltered.length;
        setCurrentIndex(nextIdx);
        // 主动封印后，朗读下一题
        if (currentView === 'flashcard' && remainsFiltered[nextIdx]) playSpeech(remainsFiltered[nextIdx].word);
      }
    }, 250);

    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
  };

  const confirmArchiveFromModal = () => {
    const card = pendingArchiveCard;
    setPendingArchiveCard(null);
    handleArchiveCard(card.id);
    const newPool = quizPool.filter(c => c.id !== card.id);
    setQuizPool(newPool);
    nextQuizCard(newPool);
  };

  const cancelArchiveFromModal = () => {
    const card = pendingArchiveCard;
    setPendingArchiveCard(null);
    const newPool = quizPool.filter(c => c.id !== card.id);
    setQuizPool(newPool);
    nextQuizCard(newPool);
  };

  // 🌟 核心抽题引擎：防死锁、防闪烁
  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); 
    setQuizStatus('waiting'); 

    // 强行保护键盘焦点
    setTimeout(() => {
      if (quizInputRef.current) {
        quizInputRef.current.focus();
        quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    if (!latestPool || latestPool.length === 0) return;

    const currentCardId = latestPool[currentIndex]?.id;
    let availableCards = latestPool.length > 1 ? latestPool.filter(c => c.id !== currentCardId) : latestPool;
    if (availableCards.length === 0) availableCards = latestPool;

    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    if (!randomCard) return;

    const foundIdx = latestPool.findIndex(c => c.id === randomCard.id);
    const safeIdx = foundIdx !== -1 ? foundIdx : 0;
    
    setCurrentIndex(safeIdx);
    
    // 🌟 切题时朗读新词！
    if (latestPool[safeIdx]) {
      playSpeech(latestPool[safeIdx].word);
    }
  };

  // 🌟 终极版无死锁考试提交：包含正确发音与平滑跳转
  const handleQuizSubmit = (e) => {
    e.preventDefault();
    if (quizStatus !== 'waiting') return; // 物理状态锁，取代之前崩溃的 ref 锁

    const currentQuizCard = quizPool[currentIndex];
    if (!currentQuizCard) return;

    const isCorrect = cleanWord(quizInput) === cleanWord(currentQuizCard.word);

    if (isCorrect) {
      // 1. 立刻切为正确绿屏，防二次提交
      setQuizStatus('correct'); 
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
      
      // 2. 朗读正确单词以示表扬
      playSpeech(currentQuizCard.word); 

      // 3. 计算复习天数并异步保存到云端
      const newStreak = (Number(currentQuizCard.streak_correct) || 0) + 1;
      const reviewData = calculateNextReview(currentQuizCard, 5) || { repetitions: 1, interval: 1, next_review: Math.floor(Date.now() / 1000) + 86400 }; 
      const updatedData = { streak_correct: newStreak, interval: Number(reviewData.interval) || 1, repetitions: Number(reviewData.repetitions) || 1, next_review: Number(reviewData.next_review) || (Math.floor(Date.now() / 1000) + 86400) };
      
      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => {});

      // 4. 更新前端本地缓存
      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      
      const updatedPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(updatedPool);
      
      // 5. 等待 800ms 后平滑进行下一题抽签
      setTimeout(() => {
        if (newStreak >= 3) {
          setPendingArchiveCard(updatedCard); 
          return;
        }
        const newPool = updatedPool.filter(c => c.id !== currentQuizCard.id);
        setQuizPool(newPool);
        nextQuizCard(newPool); // 自动切题（内部会再次发音新词）
      }, 800); 

    } else {
      // 答错逻辑保持不变
      setQuizStatus('wrong');
      playErrorSound(); 
      playSpeech(currentQuizCard.word, null, true); 
      
      const reviewData = calculateNextReview(currentQuizCard, 0); 
      const updatedData = { streak_correct: 0, interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review };

      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => {});

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setQuizPool(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
    }
  };

  const handleGoHome = (e) => {
    if (e) e.preventDefault();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeakingText(null);
    }
    setStage('splash'); setSelectedLevel('All'); setSelectedCategory('All');
    setCurrentView('flashcard'); setSelectedLibPack(null); setIsFlipped(false);
  };

  const handleNextCard = () => { 
    if (filteredCards.length > 1) { 
      setIsFlipped(false); 
      setTimeout(() => {
        const nextIdx = (currentIndex + 1) % filteredCards.length; 
        setCurrentIndex(nextIdx); 
        playSpeech(filteredCards[nextIdx].word); 
      }, isFlipped ? 250 : 0);
    }
  };

  const handlePrevCard = () => { 
    if (filteredCards.length > 1) { 
      setIsFlipped(false); 
      setTimeout(() => {
        const prevIdx = (currentIndex - 1 + filteredCards.length) % filteredCards.length; 
        setCurrentIndex(prevIdx); 
        playSpeech(filteredCards[prevIdx].word); 
      }, isFlipped ? 250 : 0);
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; touchStartY.current = e.targetTouches[0].clientY; };
  const handleTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; touchEndY.current = e.targetTouches[0].clientY; };
  const handleTouchEnd = (e) => {
    if (currentView !== 'flashcard' || filteredCards.length === 0) return;
    const deltaX = touchStartX.current - touchEndX.current;
    if (Math.abs(deltaX) > Math.abs(touchStartY.current - touchEndY.current) && Math.abs(deltaX) > 40) {
      e.preventDefault(); 
      if (deltaX > 0) handleNextCard(); else handlePrevCard(); 
    }
  };

  const getAvailableLevels = () => {
    const dbLvls = Array.from(new Set(rawCards.map(c => c.level)));
    return dbLvls.length === 0 ? LEVEL_ORDER : LEVEL_ORDER.filter(l => dbLvls.includes(l));
  };
  const getAvailableCategories = (lvl) => {
    const dbCats = Array.from(new Set(rawCards.filter(c => c.level === lvl).map(c => c.category)));
    return dbCats.length === 0 ? ['综合词汇'] : dbCats;
  };
  const getLibraryPacks = () => {
    const packsMap = {};
    rawCards.forEach(card => {
      const key = `${card.level}-${card.category}`;
      if (!packsMap[key]) packsMap[key] = { level: card.level, category: card.category, count: 0 };
      packsMap[key].count += 1;
    });
    return Object.values(packsMap).sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  };

  const selectLevelDoor = (lvl) => { 
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); setSpeakingText(null); }
    setSelectedLevel(lvl); setSelectedCategory('All'); setStage('category'); 
  };
  
  const selectCategoryPack = (cat) => {
    setSelectedCategory(cat);
    let temp = [...allCards]; 
    if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    
    let packCards = shuffleArray(temp);

    setFilteredCards(packCards); setQuizPool(packCards); setCurrentIndex(0); setIsFlipped(false); setStage('learn');
    // 彻底切断了初次进入时的自动发音
  };

  if (isLoading) return <div className="min-h-[100dvh] bg-[#F8FAFC] flex items-center justify-center font-bold text-slate-500">猫咪连接中...</div>;
  if (stage === 'splash') return <HomeView archivedCount={archivedCount} catInfo={getCatVisuals(archivedCount)} onStart={() => setStage('level')} />;
  if (stage === 'level') return <LevelSelectionView availableLevels={getAvailableLevels()} allCards={allCards} onSelectLevel={selectLevelDoor} onGoHome={handleGoHome} />;
  if (stage === 'category') return <CategorySelectionView selectedLevel={selectedLevel} availableCategories={getAvailableCategories(selectedLevel)} allCards={allCards} onSelectCategory={selectCategoryPack} onGoBack={() => setStage('level')} />;

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] overflow-y-auto relative">
      {stage === 'learn' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} activeTab={currentView === 'list' ? 'hall' : currentView} rawCardsCount={rawCards.length}
            onNavHome={handleGoHome} 
            onNavFlashcard={() => { setCurrentView('flashcard'); setIsFlipped(false); const shuffled = shuffleArray(filteredCards); setFilteredCards(shuffled); setCurrentIndex(0); }}
            onNavDictation={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); const shuffled = shuffleArray(quizPool); setQuizPool(shuffled); setCurrentIndex(0); }} 
            onNavLibrary={() => { setCurrentView('hall'); setSelectedLibPack(null); }}
          />
          
          {currentView === 'flashcard' && (
            <FlashcardView 
              selectedLevel={selectedLevel} selectedCategory={selectedCategory} currentCard={filteredCards[currentIndex] || null}
              currentIndex={currentIndex} totalCards={filteredCards.length} isFlipped={isFlipped} setIsFlipped={setIsFlipped}
              playSpeech={playSpeech} handlePrevCard={handlePrevCard} handleNextCard={handleNextCard} handleGrade={handleGrade}
              handleArchiveCard={handleArchiveCard} onChangePack={() => setStage('category')} onGoToLevels={() => setStage('level')}
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
              speakingText={speakingText}
            />
          )}

          {currentView === 'dictation' && (
            <DictationView 
              currentQuizCard={quizPool[currentIndex] || null} quizPoolLength={quizPool.length} quizInput={quizInput} setQuizInput={setQuizInput}
              quizStatus={quizStatus} playSpeech={playSpeech} handleQuizSubmit={handleQuizSubmit} handleArchiveCard={handleArchiveCard}
              nextQuizCard={nextQuizCard} onChangePack={() => setStage('category')} quizInputRef={quizInputRef} nextBtnRef={nextBtnRef}
              speakingText={speakingText}
            />
          )}

          {(currentView === 'hall' || currentView === 'list') && (
            <LibraryView 
              currentView={currentView} setCurrentView={setCurrentView} rawCards={rawCards} hallLevel={hallLevel} setHallLevel={setHallLevel}
              selectedLibPack={selectedLibPack} setSelectedLibPack={setSelectedLibPack} handleArchiveCard={handleArchiveCard}
              getAvailableLevels={getAvailableLevels} getLibraryPacks={getLibraryPacks} playSpeech={playSpeech}
              speakingText={speakingText}
            />
          )}
        </div>
      )}

      {pendingArchiveCard && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center border border-slate-100 animate-[pulse_0.3s_ease-out]">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-black text-slate-800 mb-2">连续答对 {pendingArchiveCard.streak_correct} 次！</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              您已非常熟悉 <strong className="text-[#0D9488] text-lg mx-1">{pendingArchiveCard.word}</strong><br/>是否将其永久封印？
            </p>
            <div className="flex gap-3">
              <button onClick={cancelArchiveFromModal} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                继续复习
              </button>
              <button onClick={confirmArchiveFromModal} className="flex-1 bg-[#0D9488] text-white py-3.5 rounded-xl font-black hover:bg-[#097A70] shadow-[0_4px_12px_rgba(13,148,136,0.3)] transition-all active:scale-95">
                封印 🐾
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="shrink-0 w-full text-center py-2 text-[10px] text-slate-400 bg-transparent mt-auto">
        储备猫粮已同步至云端 ☁️
      </footer>

      {feedbackMsg && (
        <div className="fixed top-[40px] left-1/2 -translate-x-1/2 z-[999] bg-[#0F172A]/90 backdrop-blur-md text-white font-bold py-3 px-6 rounded-full shadow-2xl select-none text-sm pointer-events-none whitespace-nowrap animate-bounce" style={{ transition: 'all 0.3s ease-in-out' }}>
          {feedbackMsg}
        </div>
      )}
    </div>
  );
}
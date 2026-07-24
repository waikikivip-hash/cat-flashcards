// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';
import { 
  LEVEL_ORDER, mapCategory, isCardDue, shuffleArray, 
  playErrorSound, calculateNextReview, getCatVisuals 
} from './utils';

// 引入拆分出来的积木
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

  const utteranceRef = useRef(null);
  const quizInputRef = useRef(null);
  const nextBtnRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const isTransitioningRef = useRef(false);

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

  // 🌟 已彻底移除初始化/切页面时的自动 playSpeech 监听，确保刚打开界面时绝对静音！

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (currentView === 'dictation' && quizStatus === 'wrong' && e.key === 'Enter') {
        e.preventDefault();
        nextQuizCard();
        setTimeout(() => {
          if (quizInputRef.current) {
            quizInputRef.current.focus();
            quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
      if (currentView === 'flashcard' && filteredCards.length > 0) {
        if (e.key === 'ArrowRight') { e.preventDefault(); handleNextCard(); } 
        else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevCard(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, quizStatus, quizPool, filteredCards, currentIndex]);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      let allWordsData = [];
      let from = 0;
      const step = 1000; 
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('words')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + step - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allWordsData = [...allWordsData, ...data];
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
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
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setSpeakingText(null);
      }
    } catch (err) {}

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
    }, 20);
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

    setAllCards(allCards.map(c => c.id === currentCard.id ? updatedCard : c));
    setRawCards(rawCards.map(c => c.id === currentCard.id ? updatedCard : c)); 
    
    let updatedFiltered = filteredCards;
    if (quality >= 3) {
      updatedFiltered = filteredCards.filter(c => c.id !== currentCard.id);
    } else {
      updatedFiltered = [...filteredCards.filter(c => c.id !== currentCard.id), updatedCard];
    }

    setIsFlipped(false);

    setTimeout(() => {
      setFilteredCards(updatedFiltered);

      if (updatedFiltered.length === 0) return;

      const nextIdx = currentIndex % updatedFiltered.length;
      setCurrentIndex(nextIdx);

      if (updatedFiltered[nextIdx]) {
        playSpeech(updatedFiltered[nextIdx].word);
      }
    }, 250);
  };

  const handleArchiveCard = (cardId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    supabase.from('words').update({ is_archived: true }).eq('id', cardId).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));
    setArchivedCount(prev => prev + 1);

    setAllCards(allCards.filter(c => c.id !== cardId));
    setRawCards(rawCards.map(c => c.id === cardId ? { ...c, is_archived: true } : c)); 
    const remainsFiltered = filteredCards.filter(c => c.id !== cardId);
    
    setIsFlipped(false);

    setTimeout(() => {
      setFilteredCards(remainsFiltered);
      setQuizPool(quizPool.filter(c => c.id !== cardId));
      if (remainsFiltered.length > 0) {
        const nextIdx = currentIndex % remainsFiltered.length;
        setCurrentIndex(nextIdx);
        if (remainsFiltered[nextIdx]) playSpeech(remainsFiltered[nextIdx].word);
      }
    }, 250);

    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
  };

  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); setQuizStatus('waiting'); 
    if (!latestPool || latestPool.length === 0) return;

    const currentCardId = latestPool[currentIndex]?.id;
    let availableCards = latestPool.length > 1 ? latestPool.filter(c => c.id !== currentCardId) : latestPool;
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    
    // 🌟 修复索引计算，杜绝 -1 || 0 陷阱
    const foundIdx = latestPool.findIndex(c => c.id === randomCard.id);
    const targetIdx = foundIdx !== -1 ? foundIdx : 0;
    
    setCurrentIndex(targetIdx);
    if (latestPool[targetIdx]) {
      playSpeech(latestPool[targetIdx].word);
    }
  };

  // 🌟 核心修复：增加 try-finally 全局异常捕捉，100% 保证解锁，彻底解决“答对卡死”Bug
  const handleQuizSubmit = (e) => {
    e.preventDefault();
    if (isTransitioningRef.current) return; 

    const currentQuizCard = quizPool[currentIndex];
    if (!currentQuizCard) return;

    const isCorrect = quizInput.trim().toLowerCase() === currentQuizCard.word.trim().toLowerCase();

    if (isCorrect) {
      isTransitioningRef.current = true; 
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
        
        const newStreak = Number(currentQuizCard.streak_correct) || 0;
        const reviewData = calculateNextReview(currentQuizCard, 5) || { repetitions: 1, interval: 1, next_review: Math.floor(Date.now()/1000)+86400 }; 
        const updatedData = { 
          streak_correct: newStreak + 1, 
          interval: Number(reviewData.interval) || 1, 
          repetitions: Number(reviewData.repetitions) || 1, 
          next_review: Number(reviewData.next_review) || (Math.floor(Date.now()/1000) + 86400) 
        };
        
        supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));

        const updatedCard = { ...currentQuizCard, ...updatedData };
        setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
        setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
        setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
        
        const updatedPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
        setQuizPool(updatedPool);
        
        setTimeout(() => {
          try {
            if (newStreak + 1 >= 3) {
              if (window.confirm(`🎉 连续答对 ${newStreak + 1} 次！\n您已非常熟悉【${currentQuizCard.word}】\n是否将其永久封印，不再复习？`)) {
                handleArchiveCard(currentQuizCard.id);
                return;
              }
            }

            const newPool = updatedPool.filter(c => c.id !== currentQuizCard.id);
            setQuizPool(newPool);
            nextQuizCard(newPool);
          } finally {
            isTransitioningRef.current = false; 
            setTimeout(() => {
              if (quizInputRef.current) {
                quizInputRef.current.focus();
                quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 50); 
          }
        }, 600);
      } catch (err) {
        console.error("提交异常防护:", err);
        isTransitioningRef.current = false; // 出错时也强行解锁，保证不卡死
      }
    } else {
      setQuizStatus('wrong');
      playErrorSound(); 
      playSpeech(currentQuizCard.word, null, true); 
      
      const reviewData = calculateNextReview(currentQuizCard, 0); 
      const updatedData = { streak_correct: 0, interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review };

      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setQuizPool(quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c));
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
  
  // 🌟 选包时只切换全量数据，不再自动急着发音
  const selectCategoryPack = (cat) => {
    setSelectedCategory(cat);
    let temp = [...allCards]; 
    if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    
    let packCards = shuffleArray(temp);

    setFilteredCards(packCards); setQuizPool(packCards); setCurrentIndex(0); setIsFlipped(false); setStage('learn');
  };

  if (isLoading) return <div className="min-h-[100dvh] bg-[#F8FAFC] flex items-center justify-center font-bold text-slate-500">猫咪连接中...</div>;
  if (stage === 'splash') return <HomeView archivedCount={archivedCount} catInfo={getCatVisuals(archivedCount)} onStart={() => setStage('level')} />;
  if (stage === 'level') return <LevelSelectionView availableLevels={getAvailableLevels()} allCards={allCards} onSelectLevel={selectLevelDoor} onGoHome={handleGoHome} />;
  if (stage === 'category') return <CategorySelectionView selectedLevel={selectedLevel} availableCategories={getAvailableCategories(selectedLevel)} allCards={allCards} onSelectCategory={selectCategoryPack} onGoBack={() => setStage('level')} />;

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] overflow-y-auto">
      {stage === 'learn' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          {/* 🌟 切换 Tab 时也保持静音，不急着自动发音 */}
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

      <footer className="shrink-0 w-full text-center py-2 text-[10px] text-slate-400 bg-white/50 backdrop-blur-sm border-t border-slate-200/60 mt-auto">
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
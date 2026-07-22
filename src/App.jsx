// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';
import { playErrorSound } from './utils';

// 引入拆分出来的积木
import HomeView from './components/HomeView';
import LevelSelectionView from './components/LevelSelectionView';
import CategorySelectionView from './components/CategorySelectionView';
import Header from './components/Header';
import FlashcardView from './components/FlashcardView';
import DictationView from './components/DictationView';
import LibraryView from './components/LibraryView';

const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'TOEFL', 'IELTS', 'GRE', 'Business', 'Medical', 'Academic', 'Coding'];
const INTERVAL_STAIRS = [1, 3, 7, 15, 30, 60, 90];

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const isCardDue = (card) => {
  if (!card || !card.next_review) return true; 
  const now = Math.floor(Date.now() / 1000);
  return card.next_review <= now;
};

const mapCategory = (level, cat) => {
  if (!cat) return '综合词汇';
  if (level === 'A0' || level === 'A1') {
    if (['生活', '饮食', '居家', '交通', '习惯', '购物'].includes(cat)) return '日常生活';
    if (['动作', '状态', '逻辑', '方位', '抽象'].includes(cat)) return '核心基础';
    if (['自然', '人物', '情感', '社会', '商业', '职场', '科技', '教育'].includes(cat)) return '社会认知';
    return '综合词汇';
  }
  if (level === 'A2') {
    if (['生活', '饮食', '居家', '交通', '习惯', '购物'].includes(cat)) return '生活与日常';
    if (['自然', '人物', '情感'].includes(cat)) return '自然与情感';
    if (['动作', '状态', '方位'].includes(cat)) return '动作与状态';
    if (['逻辑', '抽象'].includes(cat)) return '抽象与逻辑';
    if (['社会', '商业', '职场', '科技', '教育'].includes(cat)) return '社会与职场';
    return '综合词汇';
  }
  return cat;
};

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
    const handleVisibility = () => { if (document.hidden && window.speechSynthesis) window.speechSynthesis.cancel(); };
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
      const { data, error } = await supabase.from('words').select('*').order('id', { ascending: true });
      if (error) throw error;
      
      const cards = (data || []).map((c) => ({ ...c, category: mapCategory(c.level, c.category) }));
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

  const playSpeech = (text, e, isWrong = false) => {
    if (e && e.stopPropagation) e.stopPropagation();
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
        utteranceRef.current.rate = isWrong ? 1.05 : 0.85;  
        utteranceRef.current.pitch = isWrong ? 1.35 : 1.0;   
        window.speechSynthesis.speak(utteranceRef.current);
      } catch (err) {}
    }, 20);
  };

  const calculateNextReview = (card, quality) => {
    const now = Math.floor(Date.now() / 1000);
    let reps = card ? (card.repetitions || 0) : 0;
    if (quality < 3) return { repetitions: 0, interval: 1, next_review: now };
    const isEarlyReview = card && card.next_review && card.next_review > now;
    if (isEarlyReview && reps > 0) return { repetitions: reps, interval: card.interval || 1, next_review: card.next_review };
    if (quality === 3) {
      const currentInterval = card ? (card.interval || 1) : 1;
      return { repetitions: reps, interval: currentInterval, next_review: now + currentInterval * 86400 };
    }
    if (quality === 5) {
      const nextInterval = INTERVAL_STAIRS[Math.min(reps, INTERVAL_STAIRS.length - 1)];
      return { repetitions: reps + 1, interval: nextInterval, next_review: now + nextInterval * 86400 };
    }
  };

  const handleGrade = (quality) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    if (quality === 5) confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#A3C9B8', '#FBBF24', '#F43F5E'] });

    let msg = '';
    if (quality === 0) msg = '❌ 记忆重置，马上重新复习';
    else if (quality === 3) msg = '😮 计划不变，再接再厉';
    else if (quality === 5) msg = '😻 太棒了！已顺利进入下一复习阶段';

    if (msg) {
      setFeedbackMsg(msg);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMsg(null), 1500);
    }

    const reviewData = calculateNextReview(currentCard, quality);
    const updatedCard = { ...currentCard, ...reviewData };

    supabase.from('words').update({
      interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review
    }).eq('id', currentCard.id);

    setAllCards(allCards.map(c => c.id === currentCard.id ? updatedCard : c));
    setRawCards(rawCards.map(c => c.id === currentCard.id ? updatedCard : c)); 
    
    const updatedFiltered = filteredCards.filter(c => c.id !== currentCard.id);
    setFilteredCards(updatedFiltered);
    setIsFlipped(false);

    if (updatedFiltered.length === 0) return;
    const nextIdx = Math.floor(Math.random() * updatedFiltered.length);
    setCurrentIndex(nextIdx);
    playSpeech(updatedFiltered[nextIdx].word);
  };

  const handleArchiveCard = (cardId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    supabase.from('words').update({ is_archived: true }).eq('id', cardId);
    setArchivedCount(prev => prev + 1);

    setAllCards(allCards.filter(c => c.id !== cardId));
    setRawCards(rawCards.map(c => c.id === cardId ? { ...c, is_archived: true } : c)); 
    const remainsFiltered = filteredCards.filter(c => c.id !== cardId);
    setFilteredCards(remainsFiltered);
    setQuizPool(quizPool.filter(c => c.id !== cardId));

    setIsFlipped(false);
    if (remainsFiltered.length > 0) setCurrentIndex(Math.floor(Math.random() * remainsFiltered.length));
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#A3C9B8', '#FBBF24', '#F43F5E'] });
  };

  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); setQuizStatus('waiting'); 
    if (latestPool.length === 0) return;
    const currentCardId = latestPool[currentIndex]?.id;
    let availableCards = latestPool;
    if (latestPool.length > 1) availableCards = latestPool.filter(c => c.id !== currentCardId);
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    setCurrentIndex(latestPool.findIndex(c => c.id === randomCard.id) || 0);
  };

  const handleQuizSubmit = (e) => {
    e.preventDefault();
    if (isTransitioningRef.current) return; 

    const currentQuizCard = quizPool[currentIndex];
    if (!currentQuizCard) return;

    const isCorrect = quizInput.trim().toLowerCase() === currentQuizCard.word.trim().toLowerCase();

    if (isCorrect) {
      isTransitioningRef.current = true; 
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#A3C9B8', '#FBBF24', '#F43F5E'] });
      playSpeech(currentQuizCard.word);
      
      const newStreak = (currentQuizCard.streak_correct || 0) + 1;
      const reviewData = calculateNextReview(currentQuizCard, 5); 
      const updatedData = { streak_correct: newStreak, interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review };
      
      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      
      const updatedPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(updatedPool);
      
      setTimeout(() => {
        if (newStreak >= 3) {
          if (window.confirm(`🎉 连续答对 ${newStreak} 次！\n您已非常熟悉【${currentQuizCard.word}】\n是否将其永久封印，不再复习？`)) {
            handleArchiveCard(currentQuizCard.id);
            isTransitioningRef.current = false;
            return;
          }
        }

        const newPool = updatedPool.filter(c => c.id !== currentQuizCard.id);
        setQuizPool(newPool);
        nextQuizCard(newPool);
        
        isTransitioningRef.current = false; 
        setTimeout(() => {
          if (quizInputRef.current) {
            quizInputRef.current.focus();
            quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50); 
      }, 600);
    } else {
      setQuizStatus('wrong');
      playErrorSound(); 
      playSpeech(currentQuizCard.word, null, true); 
      
      const reviewData = calculateNextReview(currentQuizCard, 0); 
      const updatedData = { streak_correct: 0, interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review };

      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setQuizPool(quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c));
    }
  };

  const handleGoHome = (e) => {
    if (e) e.preventDefault();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setStage('splash'); setSelectedLevel('All'); setSelectedCategory('All');
    setCurrentView('flashcard'); setSelectedLibPack(null); setIsFlipped(false);
  };
  const handleNextCard = () => { if (filteredCards.length > 1) { setIsFlipped(false); const nextIdx = (currentIndex + 1) % filteredCards.length; setCurrentIndex(nextIdx); playSpeech(filteredCards[nextIdx].word); }};
  const handlePrevCard = () => { if (filteredCards.length > 1) { setIsFlipped(false); const prevIdx = (currentIndex - 1 + filteredCards.length) % filteredCards.length; setCurrentIndex(prevIdx); playSpeech(filteredCards[prevIdx].word); }};
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
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSelectedLevel(lvl); setSelectedCategory('All'); setStage('category'); 
  };
  const selectCategoryPack = (cat) => {
    setSelectedCategory(cat);
    let temp = [...allCards]; 
    if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    
    let dueCards = temp.filter(isCardDue);
    dueCards = shuffleArray(dueCards);

    setFilteredCards(dueCards); setQuizPool(dueCards); setCurrentIndex(0); setIsFlipped(false); setStage('learn');
    if (dueCards.length > 0) playSpeech(dueCards[0].word);
  };

  if (isLoading) return <div className="min-h-[100dvh] bg-[#F9F7F3] flex items-center justify-center font-bold text-gray-500">猫咪连接中...</div>;
  if (stage === 'splash') return <HomeView archivedCount={archivedCount} catInfo={{emoji:'😿', status:'努力赚罐罐', text:'快去背单词吧！'}} onStart={() => setStage('level')} />;
  if (stage === 'level') return <LevelSelectionView availableLevels={getAvailableLevels()} allCards={allCards} onSelectLevel={selectLevelDoor} onGoHome={handleGoHome} />;
  if (stage === 'category') return <CategorySelectionView selectedLevel={selectedLevel} availableCategories={getAvailableCategories(selectedLevel)} allCards={allCards} onSelectCategory={selectCategoryPack} onGoBack={() => setStage('level')} />;

  return (
    <div className="min-h-[100dvh] bg-[#F9F7F3] overflow-y-auto">
      {stage === 'learn' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} activeTab={currentView === 'list' ? 'hall' : currentView} rawCardsCount={rawCards.length}
            onNavHome={handleGoHome} 
            onNavFlashcard={() => { setCurrentView('flashcard'); setIsFlipped(false); const shuffled = shuffleArray(filteredCards); setFilteredCards(shuffled); setCurrentIndex(0); if(shuffled.length > 0) playSpeech(shuffled[0].word); }}
            onNavDictation={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); const shuffled = shuffleArray(quizPool); setQuizPool(shuffled); setCurrentIndex(0); if(shuffled.length > 0) playSpeech(shuffled[0].word); }} 
            onNavLibrary={() => { setCurrentView('hall'); setSelectedLibPack(null); }}
          />
          
          {currentView === 'flashcard' && (
            <FlashcardView 
              selectedLevel={selectedLevel} selectedCategory={selectedCategory} currentCard={filteredCards[currentIndex] || null}
              currentIndex={currentIndex} totalCards={filteredCards.length} isFlipped={isFlipped} setIsFlipped={setIsFlipped}
              playSpeech={playSpeech} handlePrevCard={handlePrevCard} handleNextCard={handleNextCard} handleGrade={handleGrade}
              handleArchiveCard={handleArchiveCard} onChangePack={() => setStage('category')} onGoToLevels={() => setStage('level')}
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            />
          )}

          {currentView === 'dictation' && (
            <DictationView 
              currentQuizCard={quizPool[currentIndex] || null} quizPoolLength={quizPool.length} quizInput={quizInput} setQuizInput={setQuizInput}
              quizStatus={quizStatus} playSpeech={playSpeech} handleQuizSubmit={handleQuizSubmit} handleArchiveCard={handleArchiveCard}
              nextQuizCard={nextQuizCard} onChangePack={() => setStage('category')} quizInputRef={quizInputRef} nextBtnRef={nextBtnRef}
            />
          )}

          {(currentView === 'hall' || currentView === 'list') && (
            <LibraryView 
              currentView={currentView} setCurrentView={setCurrentView} rawCards={rawCards} hallLevel={hallLevel} setHallLevel={setHallLevel}
              selectedLibPack={selectedLibPack} setSelectedLibPack={setSelectedLibPack} handleArchiveCard={handleArchiveCard}
              getAvailableLevels={getAvailableLevels} getLibraryPacks={getLibraryPacks}
              playSpeech={playSpeech}
            />
          )}
        </div>
      )}

      <footer className="shrink-0 w-full text-center py-2 text-[10px] text-slate-400 bg-[#F9F7F3] border-t border-slate-200/50 mt-auto">
        储备猫粮已同步至云端 ☁️
      </footer>

      {feedbackMsg && (
        <div 
          className="fixed top-[40px] left-1/2 -translate-x-1/2 z-[999] bg-[#222222]/90 backdrop-blur-md text-white font-bold py-3 px-6 rounded-full shadow-2xl select-none text-sm pointer-events-none whitespace-nowrap animate-bounce"
          style={{ transition: 'all 0.3s ease-in-out' }}
        >
          {feedbackMsg}
        </div>
      )}
    </div>
  );
}
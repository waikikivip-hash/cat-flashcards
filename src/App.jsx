// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';
import { 
  LEVEL_ORDER, mapCategory, isCardDue, shuffleArray, 
  playErrorSound, calculateNextReview, getCatVisuals 
} from './utils';

import HomeView from './components/HomeView';
import LevelSelectionView from './components/LevelSelectionView';
import CategorySelectionView from './components/CategorySelectionView';
import Header from './components/Header';
import FlashcardView from './components/FlashcardView';
import DictationView from './components/DictationView';
import LibraryView from './components/LibraryView';

// 🌟 智能提纯算法：去空格、去标点，防冤枉
const cleanWord = (w) => String(w || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

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

  // 🌟 自定义封印弹窗状态（取代原生的 window.confirm）
  const [pendingArchiveCard, setPendingArchiveCard] = useState(null);

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
    if (quality >= 3) updatedFiltered = filteredCards.filter(c => c.id !== currentCard.id);
    else updatedFiltered = [...filteredCards.filter(c => c.id !== currentCard.id), updatedCard];

    setIsFlipped(false);
    setTimeout(() => {
      setFilteredCards(updatedFiltered);
      if (updatedFiltered.length === 0) return;
      const nextIdx = currentIndex % updatedFiltered.length;
      setCurrentIndex(nextIdx);
      if (updatedFiltered[nextIdx]) playSpeech(updatedFiltered[nextIdx].word);
    }, 250);
  };

  const handleArchiveCard = (cardId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    supabase.from('words').update({ is_archived: true }).eq('id', cardId).catch(() => {});
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

  // --- 🌟 抽离出来的独立弹窗封印逻辑 ---
  const confirmArchiveFromModal = () => {
    const card = pendingArchiveCard;
    setPendingArchiveCard(null); // 关闭弹窗
    handleArchiveCard(card.id);  // 走正常封印流程
    
    const newPool = quizPool.filter(c => c.id !== card.id);
    setQuizPool(newPool);
    nextQuizCard(newPool);
  };

  const cancelArchiveFromModal = () => {
    const card = pendingArchiveCard;
    setPendingArchiveCard(null); // 仅关闭弹窗，不封印
    const newPool = quizPool.filter(c => c.id !== card.id);
    setQuizPool(newPool);
    nextQuizCard(newPool);
  };

  // --- 听音拼写核心逻辑 ---
  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); 
    setQuizStatus('waiting'); 
    
    // 强制锁解除 & 焦点保护
    isTransitioningRef.current = false;
    setTimeout(() => {
      if (quizInputRef.current) {
        quizInputRef.current.focus();
        quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    if (!latestPool || latestPool.length === 0) return;

    const currentCardId = latestPool[currentIndex]?.id;
    let availableCards = latestPool.length > 1 ? latestPool.filter(c => c.id !== currentCardId) : latestPool;
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    const targetIdx = latestPool.findIndex(c => c.id === randomCard.id);
    const safeIdx = targetIdx !== -1 ? targetIdx : 0;
    
    setCurrentIndex(safeIdx);
    if (latestPool[safeIdx]) {
      playSpeech(latestPool[safeIdx].word);
    }
  };

  const handleQuizSubmit = (e) => {
    e.preventDefault();
    if (isTransitioningRef.current) return; 

    const currentQuizCard = quizPool[currentIndex];
    if (!currentQuizCard) return;

    // 🌟 智能提纯对比：彻底免疫空格、连字符等标点错误
    const isCorrect = cleanWord(quizInput) === cleanWord(currentQuizCard.word);

    if (isCorrect) {
      isTransitioningRef.current = true; 
      setQuizStatus('correct'); // 🌟 激活绿屏动画状态！
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
      playSpeech(currentQuizCard.word); // 读一遍正确的词
      
      const newStreak = (Number(currentQuizCard.streak_correct) || 0) + 1;
      const reviewData = calculateNextReview(currentQuizCard, 5) || { repetitions: 1, interval: 1, next_review: Math.floor(Date.now() / 1000) + 86400 }; 
      const updatedData = { streak_correct: newStreak, interval: Number(reviewData.interval) || 1, repetitions: Number(reviewData.repetitions) || 1, next_review: Number(reviewData.next_review) || (Math.floor(Date.now() / 1000) + 86400) };
      
      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      
      const updatedPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(updatedPool);
      
      setTimeout(() => {
        try {
          if (newStreak >= 3) {
            // 🌟 唤起自定义弹窗，绝不阻塞 JS 线程
            setPendingArchiveCard(updatedCard);
            return;
          }
          const newPool = updatedPool.filter(c => c.id !== currentQuizCard.id);
          setQuizPool(newPool);
          nextQuizCard(newPool);
        } catch (err) {
          isTransitioningRef.current = false;
        }
      }, 800); // 留出充足时间看绿屏动画
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
  const handleNextCard = () => { if (filteredCards.length > 1) { setIsFlipped(false); setTimeout(() => { const nextIdx = (currentIndex + 1) % filteredCards.length; setCurrentIndex(nextIdx); playSpeech(filteredCards[nextIdx].word); }, isFlipped ? 250 : 0); }};
  const handlePrevCard = () => { if (filteredCards.length > 1) { setIsFlipped(false); setTimeout(() => { const prevIdx = (currentIndex - 1 + filteredCards.length) % filteredCards.length; setCurrentIndex(prevIdx); playSpeech(filteredCards[prevIdx].word); }, isFlipped ? 250 : 0); }};
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
    const dbCats = Array.from(new Set(rawCards.filter(c => c.level === lv
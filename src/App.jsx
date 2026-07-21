import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';

const LEVEL_ORDER = [
  'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 
  'TOEFL', 'IELTS', 'GRE', 
  'Business', 'Medical', 'Academic', 'Coding'
];

// 🌟 平缓复习阶梯：1天, 3天, 1周, 半月, 1月, 2月, 3月(封顶)
const INTERVAL_STAIRS = [1, 3, 7, 15, 30, 60, 90];

// 🌟 纯随机洗牌算法
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 🌟 判定单词是否到期需要复习
const isCardDue = (card) => {
  if (!card.next_review) return true; // 没背过的新词
  const now = Math.floor(Date.now() / 1000);
  return card.next_review <= now;
};

// 前端分类映射字典
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

// 字符级别精确对比算法
function getDiff(str1, str2) {
  const s1 = (str1 || '').trim();
  const s2 = (str2 || '').trim();
  const s1Low = s1.toLowerCase();
  const s2Low = s2.toLowerCase();
  
  const dp = Array(s1.length + 1).fill(0).map(() => Array(s2.length + 1).fill(0));
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1Low[i - 1] === s2Low[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let i = s1.length, j = s2.length;
  const diff = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s1Low[i - 1] === s2Low[j - 1]) {
      diff.unshift({ char: s1[i - 1], type: 'match' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ char: s2[j - 1], type: 'insert' });
      j--;
    } else {
      diff.unshift({ char: s1[i - 1], type: 'delete' });
      i--;
    }
  }
  return diff;
}

const playErrorSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.setValueAtTime(110, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (err) {}
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

  // 🌟 生命周期与强制闭麦
  useEffect(() => {
    fetchCards();
    
    // 监听切到后台，强制静音，防止诡异发声
    const handleVisibility = () => {
      if (document.hidden && window.speechSynthesis) {
        window.speechSynthesis.cancel();
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
        setTimeout(() => {
          if (quizInputRef.current) {
            quizInputRef.current.focus();
            quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
      if (currentView === 'flashcard' && filteredCards.length > 0) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextCard();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevCard();
        }
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
      
      const cards = (data || []).map((c) => ({
        ...c,
        category: mapCategory(c.level, c.category)
      }));
      
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

  // 🌟 冷却期平缓阶梯算法
  const calculateNextReview = (card, quality) => {
    const now = Math.floor(Date.now() / 1000);
    let reps = card.repetitions || 0;

    if (quality < 3) return { repetitions: 0, interval: 1, next_review: now };

    const isEarlyReview = card.next_review && card.next_review > now;
    if (isEarlyReview && reps > 0) {
      return { repetitions: reps, interval: card.interval || 1, next_review: card.next_review };
    }

    if (quality === 3) {
      const currentInterval = card.interval || 1;
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
      interval: reviewData.interval, 
      repetitions: reviewData.repetitions,
      next_review: reviewData.next_review
    }).eq('id', currentCard.id);

    setAllCards(allCards.map(c => c.id === currentCard.id ? updatedCard : c));
    setRawCards(rawCards.map(c => c.id === currentCard.id ? updatedCard : c)); 
    
    // 从当前队列中移除已打分的卡片，只留下没背完的
    const updatedFiltered = filteredCards.filter(c => c.id !== currentCard.id);
    setFilteredCards(updatedFiltered);
    setIsFlipped(false);

    if (updatedFiltered.length === 0) return;
    
    // 随机抽取下一张卡片发音
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
    if (remainsFiltered.length > 0) {
      const nextIdx = Math.floor(Math.random() * remainsFiltered.length);
      setCurrentIndex(nextIdx);
    }
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#A3C9B8', '#FBBF24', '#F43F5E'] });
  };

  // 🌟 全新真随机出题机制
  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); setQuizStatus('waiting'); 
    if (latestPool.length === 0) return;

    const currentCardId = latestPool[currentIndex]?.id;
    let availableCards = latestPool;
    
    if (latestPool.length > 1) {
      availableCards = latestPool.filter(c => c.id !== currentCardId);
    }
    
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    const newIdx = latestPool.findIndex(c => c.id === randomCard.id);
    
    setCurrentIndex(newIdx !== -1 ? newIdx : 0);
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
      
      const updatedData = { 
        streak_correct: newStreak, 
        interval: reviewData.interval, 
        repetitions: reviewData.repetitions,
        next_review: reviewData.next_review
      };
      
      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      
      // 答对了就从今日考池里暂时移出，除非全部背完
      const newPool = quizPool.filter(c => c.id !== currentQuizCard.id);
      setQuizPool(newPool);
      
      setTimeout(() => {
        // 🌟 核心：连续答对3次触发自动封印询问
        if (newStreak >= 3) {
          if (window.confirm(`🎉 连续答对 ${newStreak} 次！\n您已非常熟悉【${currentQuizCard.word}】\n是否将其永久封印，不再复习？`)) {
            handleArchiveCard(currentQuizCard.id);
            isTransitioningRef.current = false;
            return;
          }
        }

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
      const updatedData = { 
        streak_correct: 0, 
        interval: reviewData.interval, 
        repetitions: reviewData.repetitions,
        next_review: reviewData.next_review
      };

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
    setStage('splash');
    setSelectedLevel('All');
    setSelectedCategory('All');
    setCurrentView('flashcard');
    setSelectedLibPack(null);
    setIsFlipped(false);
  };

  const handleNextCard = () => { 
    if (filteredCards.length > 1) { 
      setIsFlipped(false); 
      const nextIdx = (currentIndex + 1) % filteredCards.length;
      setCurrentIndex(nextIdx); 
      playSpeech(filteredCards[nextIdx].word);
    }
  };

  const handlePrevCard = () => { 
    if (filteredCards.length > 1) { 
      setIsFlipped(false); 
      const prevIdx = (currentIndex - 1 + filteredCards.length) % filteredCards.length;
      setCurrentIndex(prevIdx); 
      playSpeech(filteredCards[prevIdx].word);
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
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSelectedLevel(lvl); setSelectedCategory('All'); setStage('category'); 
  };

  const selectCategoryPack = (cat) => {
    setSelectedCategory(cat);
    let temp = [...allCards]; 
    if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    
    // 🌟 核心：过滤掉未到期的单词，只复习该复习的！
    let dueCards = temp.filter(isCardDue);
    
    // 🌟 洗牌打乱顺序
    dueCards = shuffleArray(dueCards);

    setFilteredCards(dueCards); 
    setQuizPool(dueCards); 
    setCurrentIndex(0); 
    setIsFlipped(false); 
    setStage('learn');

    if (dueCards.length > 0) {
      playSpeech(dueCards[0].word);
    }
  };

  const Header = ({ activeTab }) => (
    <header className="w-full max-w-4xl flex justify-between items-center mb-6 sm:mb-8 shrink-0 px-2 sm:px-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="text-3xl cursor-pointer hover:scale-110 transition-transform select-none" onClick={handleGoHome}>🐱</div>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 leading-tight">猫咪闪卡学院</h1>
          <p className="text-[10px] sm:text-xs text-gray-400">{selectedLevel} · {selectedCategory === 'All' ? '全部' : selectedCategory}</p>
        </div>
      </div>
      <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-100 overflow-x-auto">
        <button 
          onClick={() => { 
            setCurrentView('flashcard'); setIsFlipped(false); 
            const shuffled = shuffleArray(filteredCards);
            setFilteredCards(shuffled); setCurrentIndex(0);
            if(shuffled.length > 0) playSpeech(shuffled[0].word);
          }} 
          className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 ${activeTab === 'flashcard' ? 'bg-[#EBF5F0] text-[#4A9A74]' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <span>🎴</span> 传统背卡
        </button>
        <button 
          onClick={() => { 
            setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); 
            const shuffled = shuffleArray(quizPool);
            setQuizPool(shuffled); setCurrentIndex(0);
            if(shuffled.length > 0) playSpeech(shuffled[0].word);
          }} 
          className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 ${activeTab === 'dictation' ? 'bg-[#EBF5F0] text-[#4A9A74]' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <span>🎯</span> 听音拼写
        </button>
        <button 
          onClick={() => { setCurrentView('hall'); setSelectedLibPack(null); }} 
          className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 ml-1 shrink-0 ${activeTab === 'hall' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <span>📚</span> 单词大厅 ({rawCards.length})
        </button>
      </div>
    </header>
  );

  const currentCard = filteredCards[currentIndex] || null;
  const currentQuizCard = quizPool[currentIndex] || null;

  if (isLoading) return <div className="min-h-[100dvh] bg-[#F9F7F3] flex items-center justify-center font-bold text-gray-500">猫咪连接中...</div>;

  return (
    <div className="min-h-[100dvh] bg-[#F9F7F3] overflow-y-auto">
      
      {stage === 'splash' && (
        <div className="min-h-[100dvh] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-sm p-8 w-full max-w-md flex flex-col items-center">
            <div className="text-5xl mb-3 animate-bounce">😿</div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-1">🐱 猫咪主子开饭签到处</h1>
            <p className="text-[10px] text-gray-400 mb-8 uppercase tracking-[0.2em]">Cat Feeding Base</p>
            <div className="w-full border border-gray-100 rounded-2xl p-5 mb-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm text-gray-500 font-medium">当前储备猫粮</span>
                <span className="text-xs bg-[#EBF5F0] text-[#4A9A74] px-3 py-1 rounded-full font-medium">状态: 努力赚罐罐</span>
              </div>
              <div className="text-center mb-6">
                <span className="text-gray-500 text-sm">已背熟封印：</span>
                <span className="text-4xl font-black text-[#A3C9B8] mx-1">{archivedCount}</span>
                <span className="text-gray-500 text-sm">粒猫粮 罐罐</span>
              </div>
            </div>
            <button onClick={() => setStage('level')} className="w-full bg-[#A3C9B8] text-[#2D4A3E] font-bold text-sm py-4 rounded-xl hover:bg-[#8FBBAA] transition-colors shadow-sm">
              罐罐倒好了，推开学院大门
            </button>
          </div>
        </div>
      )}

      {stage === 'level' && (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
          <div className="text-center mb-10 mt-10">
            <h2 className="text-xl font-bold text-gray-800 mb-2">🏰 请选择你今日要挑战的「级别之门」</h2>
            <p className="text-xs text-gray-400">推开对应的大门，解锁专属的词汇领域：</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 w-full max-w-3xl px-2 mb-12">
            {getAvailableLevels().map((lvl) => {
              const count = allCards.filter(c => c.level === lvl).length;
              return (
                <div key={lvl} onClick={() => selectLevelDoor(lvl)} className="bg-white rounded-t-full rounded-b-2xl shadow-sm border border-gray-50 w-36 sm:w-44 py-10 flex flex-col items-center cursor-pointer hover:-translate-y-2 transition-transform">
                  <div className="text-4xl mb-4">🚪</div>
                  <h3 className="text-2xl font-bold text-gray-800">{lvl}</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-6">Level Door</p>
                  <div className="bg-[#F0F4F8] text-[#5C728A] text-xs px-3 py-1 rounded-full font-medium">包含 {count} 词</div>
                </div>
              );
            })}
          </div>
          <button onClick={handleGoHome} className="text-gray-400 text-sm flex items-center gap-2 hover:text-gray-600 transition-colors pb-10">
            🔙 返回开饭签到处
          </button>
        </div>
      )}

      {stage === 'category' && (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-sm p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🍗</div>
              <h2 className="text-xl font-bold text-gray-800">级别 {selectedLevel} 传送成功</h2>
              <p className="text-xs text-gray-400 mt-1">✨ 请选择你想要的分类吧：</p>
            </div>
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-1">
              <button onClick={() => selectCategoryPack('All')} className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border-l-4 border-[#A3C9B8]">
                <span className="text-sm font-bold text-gray-700">📦 学习全部主题</span>
                <span className="text-xs text-gray-400">待复习 {allCards.filter(c => c.level === selectedLevel && isCardDue(c)).length} 词</span>
              </button>
              {getAvailableCategories(selectedLevel).map((cat, idx) => {
                const dueCount = allCards.filter(c => c.level === selectedLevel && c.category === cat && isCardDue(c)).length;
                return (
                  <button key={idx} onClick={() => selectCategoryPack(cat)} className="w-full flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:bg-[#F9F7F3] transition-colors">
                    <span className="text-sm font-bold text-gray-700">🗂️ {cat}</span>
                    <span className="text-xs text-[#A3C9B8] font-bold">待复习 {dueCount} 词 →</span>
                  </button>
                );
              })}
            </div>
            <div className="text-center">
              <button onClick={() => setStage('level')} className="text-gray-400 text-xs hover:text-gray-600 transition-colors">🔙 返回更换级别大门</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'learn' && currentView === 'flashcard' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header activeTab="flashcard" />
          <div className="w-full max-w-2xl flex-1 flex flex-col justify-center pb-8 sm:pb-12">
            <div className="flex justify-between items-center mb-3 px-2 shrink-0">
              <div className="flex gap-2 items-center">
                <span className="bg-white text-gray-500 border border-gray-100 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm">当前关卡: <strong className="text-[#A3C9B8] ml-1">{selectedLevel}</strong></span>
                <button onClick={() => setStage('category')} className="text-[#A3C9B8] text-[10px] sm:text-xs font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-50 hover:bg-gray-50 transition-colors">🔙 换包</button>
              </div>
            </div>

            {!currentCard ? (
              <div className="bg-white rounded-[32px] shadow-sm p-12 text-center my-auto min-h-[320px] flex flex-col items-center justify-center">
                <span className="text-5xl mb-4">🎉</span>
                <p className="text-gray-500 font-bold mb-4">今日该主题复习任务已全部完成！</p>
                <button onClick={() => setStage('level')} className="bg-[#A3C9B8] text-[#2D4A3E] px-6 py-2 rounded-xl font-bold">去选其他大门</button>
              </div>
            ) : (
              <>
                <div className="w-full bg-[#EBF5F0] border border-[#D5EAE2] rounded-xl p-3 sm:p-4 mb-4 flex items-center justify-between shadow-sm shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🧠</span>
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold text-[#4A9A74]">艾宾浩斯记忆追踪</p>
                      <p className="text-[9px] sm:text-[10px] text-gray-500">下次复习: <strong className="text-[#4A9A74]">{currentCard?.interval || 1}天后</strong></p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] sm:text-xs bg-white text-[#4A9A74] px-3 py-1.5 rounded-md font-bold border border-[#D5EAE2]">
                      待背剩余: {filteredCards.length}
                    </span>
                    <button onClick={(e) => handleArchiveCard(currentCard.id, e)} className="text-[10px] sm:text-xs bg-[#FFEBEB] text-[#D84C4C] px-2.5 py-1.5 rounded-md border border-[#FFDFDF] font-bold hover:bg-[#FFDFDF] transition-colors">封印🐾</button>
                  </div>
                </div>

                <div 
                  style={{ touchAction: 'none', perspective: '1000px' }}
                  onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                  onClick={() => { playSpeech(currentCard?.word); setIsFlipped(!isFlipped); }}
                  className="w-full aspect-[4/5] sm:aspect-[1.618/1] max-h-[50vh] min-h-[300px] bg-transparent mb-6 sm:mb-8 flex flex-col relative cursor-pointer shrink-0"
                >
                  <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                    <div className="absolute inset-0 w-full h-full bg-white rounded-[32px] shadow-sm p-8 sm:p-12 flex flex-col items-center justify-center [backface-visibility:hidden]">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-5xl sm:text-7xl font-extrabold text-gray-800">{currentCard?.word}</h2>
                        <button onClick={(e) => playSpeech(currentCard?.word, e)} className="text-gray-300 hover:text-gray-500 text-3xl sm:text-4xl transition-colors">🔊</button>
                      </div>
                      <p className="text-xl sm:text-2xl text-gray-400 font-light mt-2">{currentCard?.phonetic}</p>
                      <div className="absolute bottom-6 text-xs text-[#D4A017] font-medium bg-[#FFF8E1] px-4 py-1.5 rounded-full">🐱 点击卡片任意地方翻面</div>
                    </div>
                    <div className="absolute inset-0 w-full h-full bg-[#EBF5F0] rounded-[32px] shadow-sm p-8 sm:p-12 flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <h2 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-4">{currentCard?.translation}</h2>
                      <p className="text-sm sm:text-lg text-gray-600 font-medium mb-2">"{currentCard?.sentence}"</p>
                      <p className="text-xs sm:text-sm text-gray-400">({currentCard?.translation_cn})</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0 mx-auto w-full max-w-[90%] sm:max-w-md">
                  <button onClick={(e) => { e.stopPropagation(); handleGrade(0); }} className="bg-[#FFEBEB] text-[#D84C4C] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#FFDFDF] transition-colors shadow-sm">
                    <span className="text-2xl sm:text-3xl">❌</span>
                    <span className="text-xs sm:text-sm font-bold">遗忘了</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleGrade(3); }} className="bg-[#FFF8E1] text-[#D4A017] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#FFF2CC] transition-colors shadow-sm">
                    <span className="text-2xl sm:text-3xl">😲</span>
                    <span className="text-xs sm:text-sm font-bold">记不清</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleGrade(5); }} className="bg-[#EBF5F0] text-[#4A9A74] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#DDF0E6] transition-colors shadow-sm">
                    <span className="text-2xl sm:text-3xl">😻</span>
                    <span className="text-xs sm:text-sm font-bold">秒记住</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {stage === 'learn' && currentView === 'dictation' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header activeTab="dictation" />
          
          <div className="w-full max-w-3xl flex-1 flex flex-col justify-center pb-8 sm:pb-12">
            {!currentQuizCard ? (
              <div className="w-full bg-white rounded-[32px] shadow-sm p-12 text-center">
                <span className="text-5xl block mb-4">🎉</span>
                <p className="text-gray-500 font-bold mb-4">考核队列空空如也，太厉害了！</p>
                <button onClick={() => setStage('category')} className="bg-[#A3C9B8] text-[#2D4A3E] px-6 py-2 rounded-xl font-bold">换个主题继续</button>
              </div>
            ) : (
              <div className="w-full aspect-[4/5] sm:aspect-[1.618/1] max-h-[65vh] min-h-[350px] bg-white rounded-[32px] shadow-sm p-6 sm:p-10 flex flex-col items-center relative shrink-0">
                <button onClick={() => setStage('category')} className="absolute top-6 left-6 text-gray-400 text-xs sm:text-sm flex items-center gap-1 hover:text-gray-600 transition-colors bg-gray-50 px-3 py-1.5 rounded-full">
                  🔙 换包
                </button>
                
                <div className="w-full flex justify-end items-center mb-6">
                  <div className="flex gap-2">
                    <span className="bg-gray-50 text-gray-500 border border-gray-100 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm">
                      🎯 连对: <strong className="text-[#D4A017] ml-1">{currentQuizCard.streak_correct || 0}</strong>
                    </span>
                    <span className="bg-[#EBF5F0] text-[#4A9A74] border border-[#D5EAE2] text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold flex items-center shadow-sm">
                      ⏳ 剩余题目: {quizPool.length}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-center justify-center flex-1 w-full overflow-y-auto">
                  <p className="text-[11px] sm:text-xs text-[#D4A017] font-bold mb-4 tracking-wider bg-[#FFF8E1] px-4 py-1.5 rounded-full">👇 请听音并拼写</p>
                  <button onClick={() => playSpeech(currentQuizCard.word)} className="w-20 h-20 sm:w-28 sm:h-28 bg-[#EBF5F0] text-[#4A9A74] rounded-full flex items-center justify-center text-4xl sm:text-5xl shadow-[0_6px_0_#A3C9B8] hover:translate-y-1 hover:shadow-[0_2px_0_#A3C9B8] transition-all animate-pulse mb-6">
                    🔊
                  </button>
                  <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">{currentQuizCard.translation}</h2>
                  <p className="text-xs text-gray-400 font-mono">级别: {currentQuizCard.level}  |  场景: {currentQuizCard.category}</p>
                </div>
                
                <div className="w-full mt-auto pt-6 border-t border-gray-50">
                  <form onSubmit={handleQuizSubmit} className="w-full flex flex-col gap-3">
                    {quizStatus === 'waiting' ? (
                      <div className="w-full flex gap-2 sm:gap-3 max-w-xl mx-auto">
                        <input 
                          ref={quizInputRef}
                          type="text" 
                          placeholder="输入英文..." 
                          value={quizInput} 
                          onChange={(e) => setQuizInput(e.target.value)}
                          className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 sm:py-4 text-lg sm:text-xl font-bold text-center tracking-widest focus:outline-none focus:border-[#A3C9B8] shadow-inner"
                          autoCapitalize="none" autoComplete="off" spellCheck="false" inputMode="text" autoCorrect="off" autoFocus
                        />
                        <button type="submit" className="bg-[#A3C9B8] text-[#2D4A3E] px-6 sm:px-10 py-3 sm:py-4 rounded-xl font-bold hover:bg-[#8FBBAA] transition-colors shadow-sm text-lg">
                          提交
                        </button>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center max-w-xl mx-auto">
                        <div className="bg-[#FFEBEB] w-full rounded-2xl p-4 sm:p-5 text-left border border-[#FFDFDF] shadow-sm">
                          <div className="text-xs text-[#D84C4C] font-bold mb-2 text-center">🙀 答错了，连对归零</div>
                          <div className="bg-white rounded-xl p-3 sm:p-4 text-xs font-mono shadow-sm">
                            <div className="flex items-center gap-2 py-1.5 border-b border-dashed border-gray-100">
                              <span className="text-[10px] sm:text-xs text-gray-400 w-14 shrink-0 font-sans font-bold">你的拼写:</span>
                              <div className="flex flex-wrap text-sm sm:text-base tracking-wide">
                                {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                                  if (d.type === 'insert') return null;
                                  const spanClass = d.type === 'match' ? 'text-green-600 font-bold' : 'text-red-500 line-through bg-red-50 font-bold px-0.5 rounded';
                                  return <span key={idx} className={spanClass}>{d.char}</span>;
                                })}
                                {quizInput.trim() === '' && <span className="text-red-400 italic text-[10px] font-sans">(未输入)</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 py-1.5 mt-1">
                              <span className="text-[10px] sm:text-xs text-gray-400 w-14 shrink-0 font-sans font-bold">正确答案:</span>
                              <div className="flex flex-wrap text-sm sm:text-base tracking-wide items-center gap-2">
                                {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                                  if (d.type === 'delete') return null;
                                  const spanClass = d.type === 'match' ? 'text-green-600 font-bold' : 'text-[#D4A017] bg-[#FFF8E1] underline font-bold px-0.5 rounded';
                                  return <span key={idx} className={spanClass}>{d.char}</span>;
                                })}
                                <button type="button" onClick={(e) => playSpeech(currentQuizCard.word, e, true)} className="ml-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-colors">🔊</button>
                              </div>
                            </div>
                          </div>
                          <button ref={nextBtnRef} type="button" onClick={() => nextQuizCard()} className="w-full mt-3 bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 sm:py-4 rounded-xl text-sm transition-colors shadow-sm">
                            看懂了，下一题 🐾
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'hall' && (
        <div className="min-h-screen p-6 flex flex-col items-center">
          <Header activeTab="hall" />
          <div className="w-full max-w-4xl relative">
            <button onClick={() => setCurrentView('home')} className="absolute top-0 left-0 text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">
              🔙 返回签到处
            </button>
            <div className="text-center mb-8 mt-2">
              <h2 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2 mb-4">📚 单词大厅</h2>
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs text-gray-400 tracking-wider">选择词汇级别</span>
                <div className="bg-white rounded-full p-1 shadow-sm flex flex-wrap justify-center border border-gray-100">
                  {getAvailableLevels().map((level) => (
                    <button 
                      key={level} onClick={() => setHallLevel(level)}
                      className={`px-6 py-2 text-sm rounded-full font-bold transition-colors ${hallLevel === level ? 'bg-[#A3C9B8] text-[#2D4A3E] shadow-sm' : 'text-gray-400 hover:text-gray-600 bg-transparent'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-center text-xs text-gray-400 mb-6 tracking-wider">选择细分主题项目</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pb-10">
              {getLibraryPacks().filter(p => p.level === hallLevel).map((pack) => (
                <div 
                  key={`${pack.level}-${pack.category}`} 
                  onClick={() => { setSelectedLibPack(pack); setCurrentView('list'); }}
                  className="bg-white rounded-3xl shadow-sm border border-gray-50 py-8 flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform"
                >
                  <div className="text-4xl mb-4">📦</div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">{pack.category}</h3>
                  <span className="text-xs text-[#A3C9B8] font-medium">共 {pack.count} 词</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentView === 'list' && selectedLibPack && (
        <div className="min-h-screen p-6 flex flex-col items-center">
          <Header activeTab="hall" />
          <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <button onClick={() => setCurrentView('hall')} className="text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 border border-gray-200 px-4 py-1.5 rounded-full">
                🔙 返回单词大厅
              </button>
              <span className="bg-[#EBF5F0] text-[#4A9A74] text-xs font-bold px-4 py-1.5 rounded-full uppercase">
                {selectedLibPack.level} · {selectedLibPack.category}
              </span>
            </div>
            
            <div className="flex-1 overflow-x-auto p-2 sm:p-6">
              <div className="min-w-[400px]">
                <div className="grid grid-cols-4 text-center text-sm font-bold text-gray-500 mb-4 pb-2 border-b border-gray-50">
                  <div className="col-span-1">单词</div>
                  <div className="col-span-1">中文</div>
                  <div className="col-span-1">连对/复习</div>
                  <div className="col-span-1">操作</div>
                </div>
                {rawCards.filter((card) => card.level === selectedLibPack.level && card.category === selectedLibPack.category).map((card) => (
                  <div key={card.id} className="grid grid-cols-4 text-center items-center py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="font-bold text-gray-800 text-base font-mono">
                      {card.word} {card.is_archived && <span className="block text-[10px] text-gray-400 font-sans mt-0.5">已封印</span>}
                    </div>
                    <div className="text-gray-600 text-sm">{card.translation}</div>
                    <div className="text-xs text-gray-500"><span className="text-[#D4A017]">{card.streak_correct||0}次</span> / <span className="text-[#4A9A74]">{card.interval||1}天</span></div>
                    <div>
                      <button 
                        onClick={(e) => {
                          handleArchiveCard(card.id, e);
                          const remains = rawCards.filter((c) => c.id !== card.id && c.level === selectedLibPack.level && c.category === selectedLibPack.category);
                          if (remains.length === 0) setCurrentView('hall');
                        }} 
                        className="text-[#D84C4C] text-xs bg-[#FFEBEB] px-3 py-1.5 rounded-full font-bold hover:bg-[#FFDFDF] transition-colors"
                      >
                        封印 🐾
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
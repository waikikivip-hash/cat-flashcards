import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';

// ==========================================
// 1. 核心算法与工具类 (绝无省略)
// ==========================================

const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'TOEFL', 'IELTS', 'GRE', 'Business', 'Medical', 'Academic', 'Coding'];
const INTERVAL_STAIRS = [1, 3, 7, 15, 30, 60, 90];

const cleanWord = (w) => String(w || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(String(text || ''));

const shuffleArray = (array) => {
  const arr = [...(array || [])];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const isCardDue = (card) => {
  if (!card || !card.next_review) return true;
  return Number(card.next_review) <= Math.floor(Date.now() / 1000);
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

function getDiff(str1, str2) {
  const s1 = String(str1 || '').trim();
  const s2 = String(str2 || '').trim();
  const s1Low = s1.toLowerCase();
  const s2Low = s2.toLowerCase();
  
  const dp = Array(s1.length + 1).fill(0).map(() => Array(s2.length + 1).fill(0));
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      dp[i][j] = s1Low[i - 1] === s2Low[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
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

// 🌟 修复：AudioContext 内存泄漏问题，引入全局单例模式
let audioCtxSingleton = null;

const playErrorSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    
    // 如果单例不存在或已经被关闭，则重新创建
    if (!audioCtxSingleton || audioCtxSingleton.state === 'closed') {
      audioCtxSingleton = new AudioCtx();
    }
    
    // 唤醒处于 suspended (挂起) 状态的 AudioContext (常见于浏览器自动静音策略)
    if (audioCtxSingleton.state === 'suspended') {
      audioCtxSingleton.resume();
    }
    
    const ctx = audioCtxSingleton;
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
  } catch (err) {
    console.warn("播放错误音效失败:", err);
  }
};const calculateNextReview = (card, quality) => {
  const now = Math.floor(Date.now() / 1000);
  let reps = Number(card?.repetitions) || 0;
  if (isNaN(reps) || reps < 0) reps = 0;

  if (quality < 3) return { repetitions: 0, interval: 1, next_review: now };

  const nextReviewTime = Number(card?.next_review) || 0;
  const isEarlyReview = nextReviewTime > now;
  if (isEarlyReview && reps > 0) return { repetitions: reps, interval: Number(card?.interval) || 1, next_review: nextReviewTime };

  if (quality === 3) {
    const currentInterval = Number(card?.interval) || 1;
    return { repetitions: reps, interval: currentInterval, next_review: now + currentInterval * 86400 };
  }

  const safeIndex = Math.min(Math.max(0, reps), INTERVAL_STAIRS.length - 1);
  const nextInterval = INTERVAL_STAIRS[safeIndex] || 1;
  return { repetitions: reps + 1, interval: nextInterval, next_review: now + nextInterval * 86400 };
};

const getCatVisuals = (count) => {
  if (count === 0) return { emoji: '😿', status: '精瘦无力', text: '美短和缅因正在后方嗷嗷待哺... 快去封印单词生成猫粮！' };
  if (count < 15) return { emoji: '🐱', status: '身材标准', text: '主子们刚刚享用了你背熟的猫粮，身材非常优雅健康。' };
  if (count < 50) return { emoji: '😸', status: '微胖肚圆', text: '囤积的猫粮充足！主子们的肚子已经肉眼可见地圆滚滚了！' };
  return { emoji: '😹', status: '姥姥养的猪', text: '哇！封印词汇量惊人！主子们已经彻底胖成了姥姥养的巨无霸！' };
};

// ==========================================
// 2. 独立功能组件：声波按钮 (语法严格闭合版)
// ==========================================
function SoundWaveButton({ onClick, className = '', size = 'medium', isSpeaking = false }) {
  const [waveState, setWaveState] = useState('idle');

  useEffect(() => {
    if (isSpeaking) {
      setWaveState('active');
    } else if (waveState === 'active') {
      setWaveState('fading');
      const timer = setTimeout(() => setWaveState('idle'), 800);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking]);

  const sizeClasses = {
    small: 'w-9 h-7 sm:w-11 sm:h-8 px-1',
    medium: 'w-14 h-9 sm:w-18 sm:h-10 px-2',
    large: 'w-48 sm:w-60 h-14 sm:h-18 px-3'
  }[size] || 'w-14 h-9 px-2';

  const strokeClass = {
    active: size === 'large' ? 'stroke-[3.5px]' : 'stroke-[2.5px]',
    fading: size === 'large' ? 'stroke-[2.2px]' : 'stroke-[1.8px]',
    idle: 'stroke-[2px]'
  }[waveState];

  const opacityClass = {
    active: 'opacity-100 transition-opacity duration-300 ease-in',
    fading: 'opacity-70 transition-all duration-800 ease-out',
    idle: 'opacity-85 transition-all duration-800 ease-out'
  }[waveState];

  return (
    <button
      type="button"
      onClick={(e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (onClick) onClick(e);
      }}
      className={`relative rounded-full bg-white border border-slate-200/80 shadow-sm hover:shadow transition-all active:scale-95 flex items-center justify-center overflow-hidden shrink-0 select-none group ${sizeClasses} ${className}`}
    >
      <style>{`
        @keyframes pitchWave1 { 0% { transform: translateX(0px) scaleY(0.5); } 25% { transform: translateX(-25px) scaleY(1.6); } 50% { transform: translateX(-50px) scaleY(0.7); } 75% { transform: translateX(-75px) scaleY(1.4); } 100% { transform: translateX(-100px) scaleY(0.5); } }
        @keyframes pitchWave2 { 0% { transform: translateX(-100px) scaleY(0.7); } 33% { transform: translateX(-66px) scaleY(1.3); } 66% { transform: translateX(-33px) scaleY(0.6); } 100% { transform: translateX(0px) scaleY(0.7); } }
        @keyframes pitchWave3 { 0% { transform: translateX(0px) scaleY(0.4); } 50% { transform: translateX(-40px) scaleY(1.7); } 100% { transform: translateX(-80px) scaleY(0.4); } }
        .wave-pitch-1 { animation: pitchWave1 0.75s infinite ease-in-out; }
        .wave-pitch-2 { animation: pitchWave2 0.95s infinite ease-in-out; }
        .wave-pitch-3 { animation: pitchWave3 0.65s infinite ease-in-out; }
        .wave-idle-1 { animation: pitchWave1 4.0s infinite linear; }
        .wave-idle-2 { animation: pitchWave2 4.5s infinite linear; }
        .wave-idle-3 { animation: pitchWave3 3.5s infinite linear; }
      `}</style>
      <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 300 60" className="w-[150%] h-full shrink-0 overflow-visible">
          <path d="M 0 30 Q 25 10, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30" fill="none" stroke="#0D9488" strokeLinecap="round" className={`origin-center ${waveState === 'active' ? 'wave-pitch-1' : 'wave-idle-1'} ${strokeClass} ${opacityClass}`} />
          <path d="M 0 30 Q 25 50, 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30" fill="none" stroke="#F59E0B" strokeLinecap="round" className={`origin-center ${waveState === 'active' ? 'wave-pitch-2' : 'wave-idle-2'} ${strokeClass} ${opacityClass}`} />
          <path d="M 0 30 Q 25 20, 50 40 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30 T 350 30 T 400 30" fill="none" stroke="#38BDF8" strokeLinecap="round" className={`origin-center ${waveState === 'active' ? 'wave-pitch-3' : 'wave-idle-3'} ${strokeClass} ${opacityClass}`} />
        </svg>
      </div>
    </button>
  );
}// ==========================================
// 3. 主程序组件 (状态与生命周期)
// ==========================================
export default function App() {
  // --- 状态定义区 ---
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
  
  // 自定义封印弹窗状态，彻底废弃会导致卡死的 window.confirm
  const [pendingArchiveCard, setPendingArchiveCard] = useState(null);

  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listVisibleCount, setListVisibleCount] = useState(20);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalVisibleCount, setGlobalVisibleCount] = useState(20);

  // --- Refs 引用区 ---
  const utteranceRef = useRef(null);
  const quizInputRef = useRef(null);
  const nextBtnRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const isTransitioningRef = useRef(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // --- 生命周期 (Effects) ---
  
  // 初始化获取数据，并监听页面可见性以随时切断幽灵发音
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

  // 全局键盘事件监听 (处理回车切题与左右方向键切卡)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (currentView === 'dictation' && quizStatus === 'wrong' && e.key === 'Enter') {
        e.preventDefault();
        nextQuizCard();
        // 键盘按回车切题后，强制重新锁定焦点，防掉落
        setTimeout(() => {
          if (quizInputRef.current) {
            quizInputRef.current.focus();
            quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
      if (currentView === 'flashcard' && filteredCards.length > 0 && !pendingArchiveCard) {
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
  }, [currentView, quizStatus, quizPool, filteredCards, currentIndex, pendingArchiveCard]);// --- 核心业务逻辑函数 (绝无删减) ---

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

    // 延迟 50ms 防止 Safari 吞音
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
      if (updatedFiltered[nextIdx]) playSpeech(updatedFiltered[nextIdx].word);
    }, 250);
  };

  const handleArchiveCard = (cardId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    supabase.from('words').update({ is_archived: true }).eq('id', cardId).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));
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

  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); setQuizStatus('waiting'); 
    isTransitioningRef.current = false; // 强行解锁

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
    if (latestPool[safeIdx]) {
      playSpeech(latestPool[safeIdx].word);
    }
  };

  const handleQuizSubmit = (e) => {
    e.preventDefault();
    if (quizStatus !== 'waiting') return; 
    if (isTransitioningRef.current) return; 

    const currentQuizCard = quizPool[currentIndex];
    if (!currentQuizCard) return;

    const isCorrect = cleanWord(quizInput) === cleanWord(currentQuizCard.word);

    if (isCorrect) {
      isTransitioningRef.current = true; 
      try {
        setQuizStatus('correct'); // 激爽绿屏！
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0D9488', '#FBBF24', '#F43F5E'] });
        playSpeech(currentQuizCard.word); 
        
        const newStreak = (Number(currentQuizCard.streak_correct) || 0) + 1;
        const reviewData = calculateNextReview(currentQuizCard, 5) || { repetitions: 1, interval: 1, next_review: Math.floor(Date.now() / 1000) + 86400 }; 
        const updatedData = { streak_correct: newStreak, interval: Number(reviewData.interval) || 1, repetitions: Number(reviewData.repetitions) || 1, next_review: Number(reviewData.next_review) || (Math.floor(Date.now() / 1000) + 86400) };
        
        supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));

        const updatedCard = { ...currentQuizCard, ...updatedData };
        setAllCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
        setRawCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
        setFilteredCards(prev => prev.map(c => c.id === currentQuizCard.id ? updatedCard : c));
        
        const updatedPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
        setQuizPool(updatedPool);
        
        setTimeout(() => {
          try {
            if (newStreak >= 3) {
              setPendingArchiveCard(updatedCard); 
              return;
            }
            const newPool = updatedPool.filter(c => c.id !== currentQuizCard.id);
            setQuizPool(newPool);
            nextQuizCard(newPool); 
          } finally {
            isTransitioningRef.current = false; 
            setTimeout(() => {
              if (quizInputRef.current && quizStatus !== 'correct') { 
                quizInputRef.current.focus();
                quizInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 50); 
          }
        }, 800); 

      } catch (err) {
        console.error("提交异常防护:", err);
        isTransitioningRef.current = false;
      }
    } else {
      setQuizStatus('wrong');
      playErrorSound(); 
      playSpeech(currentQuizCard.word, null, true); 
      
      const reviewData = calculateNextReview(currentQuizCard, 0); 
      const updatedData = { streak_correct: 0, interval: reviewData.interval, repetitions: reviewData.repetitions, next_review: reviewData.next_review };

      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id).catch(() => triggerFeedback('⚠️ 网络断开，离线修改中'));

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
    
    let dueCards = shuffleArray(temp.filter(isCardDue));
    if (dueCards.length === 0) dueCards = temp; 

    setFilteredCards(dueCards); setQuizPool(dueCards); setCurrentIndex(0); setIsFlipped(false); setStage('learn');
  };

  const filterListCards = (cards, queryText) => {
    const query = String(queryText || '').trim().toLowerCase();
    if (!query) return [];
    const isCn = containsChinese(query);
    return (cards || []).filter((card) => {
      if (!card) return false;
      const word = String(card.word || '').toLowerCase();
      const translation = String(card.translation || '').toLowerCase();
      const translationCn = String(card.translation_cn || '').toLowerCase();
      return isCn ? (translation.includes(query) || translationCn.includes(query)) : word.startsWith(query);
    });
  };// ==========================================
  // 5. 完整的 UI 路由渲染层 (绝无删减)
  // ==========================================

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#F8FAFC] flex items-center justify-center font-bold text-slate-500">
        猫咪连接中...
      </div>
    );
  }

  if (stage === 'splash') {
    const catInfo = getCatVisuals(archivedCount);
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans text-slate-700 overflow-hidden">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200/80 shadow-[0_12px_32px_rgba(15,23,42,0.06)] max-w-md w-full text-center">
          <div className="text-7xl block mb-4 animate-bounce select-none">{catInfo.emoji}</div>
          <h1 className="text-2xl font-black text-slate-800 tracking-wider">🐱 猫咪主子开饭签到处</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cat Feeding Base</p>
          <div className="my-6 bg-slate-50/80 rounded-2xl p-4 border border-slate-100 shadow-inner text-left">
            <div className="flex justify-between items-center mb-2 border-b border-slate-200/80 pb-1.5">
              <span className="text-xs font-bold text-slate-500">当前储备猫粮</span>
              <span className="bg-[#F0FDF4] text-[#166534] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#DCFCE7]">状态: {catInfo.status}</span>
            </div>
            <p className="text-sm font-medium text-slate-600 text-center py-1">
              已背熟封印：<strong className="text-[#0D9488] text-2xl font-black mx-1">{archivedCount}</strong> 粒猫粮 罐罐
            </p>
            <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed italic">"{catInfo.text}"</p>
          </div>
          <button 
            onClick={() => setStage('level')} 
            className="w-full bg-[#0D9488] hover:bg-[#097A70] text-white font-black py-4 px-6 rounded-2xl shadow-[0_4px_12px_rgba(13,148,136,0.25)] active:scale-[0.98] transition-all text-lg tracking-wide"
          >
            罐罐倒好了，推开学院大门
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'level') {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-slate-700 overflow-hidden">
        <div className="w-full max-w-2xl text-center mb-6 mt-10">
          <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-wide">🏰 请选择你今日要挑战的「级别之门」</h2>
          <p className="text-xs text-slate-500">推开对应的大门，解锁专属的词汇领域：</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 w-full max-w-3xl px-2 mb-12">
          {getAvailableLevels().map((lvl) => {
            const count = allCards.filter(c => c.level === lvl).length;
            return (
              <div 
                key={lvl} 
                onClick={() => selectLevelDoor(lvl)} 
                className="bg-white rounded-t-full rounded-b-3xl shadow-sm border border-slate-200/80 w-36 sm:w-44 py-10 flex flex-col items-center cursor-pointer hover:-translate-y-2 hover:border-[#0D9488] hover:shadow-md transition-all relative overflow-hidden group"
              >
                <div className="absolute top-0 inset-x-0 h-3 bg-[#0D9488] opacity-80" />
                <span className="text-4xl mb-4 group-hover:scale-110 transition-transform select-none">🚪</span>
                <h3 className="text-2xl font-black text-slate-800 tracking-wider font-mono mb-1">{lvl}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Level Door</p>
                <div className="bg-slate-50 text-slate-600 border border-slate-200/80 text-xs px-3 py-1 rounded-full font-bold">包含 {count} 词</div>
              </div>
            );
          })}
        </div>
        <button 
          onClick={handleGoHome} 
          className="text-slate-400 text-sm font-bold flex items-center gap-2 hover:text-slate-600 transition-colors pb-10"
        >
          🔙 返回开饭签到处
        </button>
      </div>
    );
  }

  if (stage === 'category') {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans text-slate-700 overflow-hidden">
        <div className="bg-white rounded-[2rem] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-100 p-8 w-full max-w-md text-center">
          <span className="text-5xl block mb-3 select-none">🍗</span>
          <h2 className="text-xl font-black text-slate-800 tracking-wide">级别 {selectedLevel} 传送成功</h2>
          <p className="text-sm font-bold text-[#0D9488] mt-1">✨ 请选择你想要的分类吧：</p>
          
          <div className="my-6 flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
            <button 
              onClick={() => selectCategoryPack('All')} 
              className="w-full flex justify-between items-center p-4 bg-slate-50 border-2 border-slate-200/80 hover:border-[#0D9488] hover:bg-white rounded-xl text-sm transition-all text-left shadow-sm"
            >
              <span className="text-sm font-black text-slate-700">📦 学习全部主题</span>
              <span className="text-xs text-slate-500 font-bold">待复习 {allCards.filter(c => c.level === selectedLevel && isCardDue(c)).length} 词</span>
            </button>
            {getAvailableCategories(selectedLevel).map((cat, idx) => {
              const dueCount = allCards.filter(c => c.level === selectedLevel && c.category === cat && isCardDue(c)).length;
              return (
                <button 
                  key={idx} 
                  onClick={() => selectCategoryPack(cat)} 
                  className="w-full flex justify-between items-center p-4 bg-white border border-slate-200/80 hover:border-[#0D9488] hover:shadow-md rounded-xl text-sm transition-all text-left shadow-sm"
                >
                  <span className="text-sm font-bold text-slate-700">🗂️ {cat}</span>
                  <span className="text-xs text-[#0D9488] font-black">待复习 {dueCount} 词 →</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setStage('level')} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">🔙 返回更换级别大门</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] overflow-y-auto relative font-sans text-slate-700">
      
      {stage === 'learn' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          
          {/* ================= 统一头部导航 ================= */}
          <header className="w-full max-w-4xl flex justify-between items-center mb-6 sm:mb-8 shrink-0 px-2 sm:px-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-3xl cursor-pointer hover:scale-110 transition-transform select-none" onClick={handleGoHome}>🐱</div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-wide leading-tight">猫咪闪卡学院</h1>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium">{selectedLevel} · {selectedCategory === 'All' ? '全部' : selectedCategory}</p>
              </div>
            </div>
            <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-200/80 overflow-x-auto">
              <button 
                onClick={() => { setCurrentView('flashcard'); setIsFlipped(false); const shuffled = shuffleArray(filteredCards); setFilteredCards(shuffled); setCurrentIndex(0); }} 
                className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 transition-colors ${currentView === 'flashcard' ? 'bg-[#EBF5F0] text-[#0D9488]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <span>🎴</span> 传统背卡
              </button>
              <button 
                onClick={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); const shuffled = shuffleArray(quizPool); setQuizPool(shuffled); setCurrentIndex(0); }} 
                className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 transition-colors ${currentView === 'dictation' ? 'bg-[#EBF5F0] text-[#0D9488]' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <span>🎯</span> 听音拼写
              </button>
              <button 
                onClick={() => { setCurrentView('hall'); setSelectedLibPack(null); }} 
                className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 ml-1 shrink-0 transition-colors ${(currentView === 'hall' || currentView === 'list') ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <span>📚</span> 单词大厅 ({rawCards.length})
              </button>
            </div>
          </header>

          {/* ================= 传统背卡视图 ================= */}
          {currentView === 'flashcard' && (() => {
            const currentCard = filteredCards[currentIndex] || null;
            return (
              <div className="w-full max-w-2xl flex-1 flex flex-col justify-center pb-8 sm:pb-12 px-4">
                <div className="flex justify-between items-center mb-3 px-2 shrink-0">
                  <div className="flex gap-2 items-center">
                    <span className="bg-white text-slate-600 border border-slate-200/80 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm font-bold">当前关卡: <strong className="text-[#0D9488] ml-1">{selectedLevel}</strong></span>
                    <button onClick={() => setStage('category')} className="text-[#0D9488] text-[10px] sm:text-xs font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200/80 hover:bg-slate-50 transition-colors">🔙 换包</button>
                  </div>
                </div>

                {!currentCard ? (
                  <div className="bg-white border border-slate-200/80 rounded-[32px] shadow-sm p-12 text-center my-auto min-h-[320px] flex flex-col items-center justify-center">
                    <span className="text-5xl mb-4">🎉</span>
                    <p className="text-slate-600 font-bold mb-4">今日该主题复习任务已全部完成！</p>
                    <button onClick={() => setStage('level')} className="bg-[#0D9488] text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-[#097A70] transition-colors">去选其他大门</button>
                  </div>
                ) : (
                  <>
                    <div className="w-full bg-[#F0FDF4] border border-[#DCFCE7] rounded-2xl p-3 sm:p-4 mb-4 flex items-center justify-between shadow-sm shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧠</span>
                        <div>
                          <p className="text-[10px] sm:text-xs font-bold text-[#166534]">艾宾浩斯记忆追踪</p>
                          <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium">下次复习: <strong className="text-[#166534]">{currentCard?.interval || 1}天后</strong></p>
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs bg-white text-[#166534] px-3 py-1.5 rounded-md font-black border border-[#DCFCE7]">
                        待背剩余: {filteredCards.length}
                      </span>
                    </div>

                    <div 
                      style={{ touchAction: 'none', perspective: '1000px' }}
                      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                      onClick={() => {
                        if (isFlipped) {
                          if (window.speechSynthesis) window.speechSynthesis.cancel();
                          setIsFlipped(false);
                        } else {
                          playSpeech(currentCard?.word);
                          setIsFlipped(true);
                        }
                      }}
                      className="w-full aspect-[4/5] sm:aspect-[1.618/1] max-h-[50vh] min-h-[320px] bg-transparent mb-6 sm:mb-8 flex flex-col relative cursor-pointer shrink-0"
                    >
                      <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                        
                        <div className="absolute inset-0 w-full h-full bg-white rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-100 p-8 sm:p-12 flex flex-col items-center justify-center relative overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                          <button onClick={(e) => handleArchiveCard(currentCard.id, e)} className="absolute top-5 right-5 text-[10px] sm:text-xs bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-3 py-1 rounded-full border border-slate-200/60 font-bold transition-colors z-10 shadow-sm">封印 🐾</button>
                          <div className="flex flex-col items-center justify-center flex-1 my-auto w-full">
                            <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
                              <h2 className="text-5xl sm:text-7xl font-black text-[#0F172A] tracking-tight">{currentCard?.word}</h2>
                              <SoundWaveButton onClick={(e) => playSpeech(currentCard?.word, e)} size="medium" isSpeaking={speakingText === currentCard?.word} />
                            </div>
                            <p className="text-xl sm:text-2xl text-slate-400 font-light mt-1">{currentCard?.phonetic}</p>
                          </div>
                          <div className="absolute bottom-6 text-xs text-[#D97706] font-bold bg-[#FFFBEB] border border-[#FEF3C7] px-4 py-1.5 rounded-full">🐱 点击卡片任意地方翻面</div>
                        </div>
                        
                        <div className="absolute inset-0 w-full h-full bg-slate-50/90 rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-200/80 p-8 sm:p-12 flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          <div className="flex flex-col items-center justify-center flex-1 my-auto w-full">
                            <h2 className="text-4xl sm:text-5xl font-black text-[#0F172A] mb-6">{currentCard?.translation}</h2>
                            <div className="flex items-center justify-center gap-3 mb-2 max-w-full px-2">
                              <p className="text-sm sm:text-lg text-slate-700 font-medium break-words leading-relaxed text-center flex-1">"{currentCard?.sentence}"</p>
                              <SoundWaveButton onClick={(e) => playSpeech(currentCard?.sentence, e)} size="small" isSpeaking={speakingText === currentCard?.sentence} />
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400 mt-2">({currentCard?.translation_cn})</p>
                          </div>
                        </div>

                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0 mx-auto w-full max-w-[90%] sm:max-w-md">
                      <button onClick={(e) => { e.stopPropagation(); handleGrade(0); }} className="bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#FEE2E2] transition-colors shadow-sm">
                        <span className="text-2xl sm:text-3xl">❌</span><span className="text-xs sm:text-sm font-bold">遗忘了</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleGrade(3); }} className="bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#FEF3C7] transition-colors shadow-sm">
                        <span className="text-2xl sm:text-3xl">😲</span><span className="text-xs sm:text-sm font-bold">记不清</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleGrade(5); }} className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#A7F3D0]/60 transition-colors shadow-sm">
                        <span className="text-2xl sm:text-3xl">😻</span><span className="text-xs sm:text-sm font-bold">秒记住</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* ================= 听音拼写视图 ================= */}
          {currentView === 'dictation' && (() => {
            const currentQuizCard = quizPool[currentIndex] || null;
            return (
              <div className="w-full max-w-3xl flex-1 flex flex-col justify-center pb-8 sm:pb-12 px-4">
                {!currentQuizCard ? (
                  <div className="w-full bg-white rounded-[32px] border border-slate-200/80 shadow-sm p-12 text-center">
                    <span className="text-5xl block mb-4">🎉</span>
                    <p className="text-slate-600 font-bold mb-4">考核队列空空如也，太厉害了！</p>
                    <button onClick={() => setStage('category')} className="bg-[#0D9488] text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-[#097A70] transition-colors">换个主题继续</button>
                  </div>
                ) : (
                  <div className="w-full bg-white rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-100 p-6 sm:p-8 flex flex-col items-center relative shrink-0 min-h-[380px] overflow-visible">
                    <button onClick={() => setStage('category')} className="absolute top-6 left-6 text-slate-500 text-xs sm:text-sm flex items-center gap-1 hover:text-slate-700 transition-colors bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-full z-10 shadow-sm font-bold">
                      🔙 换包
                    </button>
                    
                    <div className="w-full flex justify-end items-center mb-4 shrink-0">
                      <div className="flex gap-2">
                        <span className="bg-slate-50 text-slate-600 border border-slate-200/80 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm font-bold">
                          🎯 连对: <strong className="text-[#D97706] ml-1">{currentQuizCard.streak_correct || 0}</strong>
                        </span>
                        <span className="bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold flex items-center shadow-sm">
                          ⏳ 剩余题目: {quizPool.length}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center flex-1 w-full my-auto py-2">
                      <p className="text-[11px] sm:text-xs text-[#D97706] font-bold mb-3 tracking-wider bg-[#FFFBEB] border border-[#FEF3C7] px-4 py-1.5 rounded-full">👇 请听音并拼写</p>
                      <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3 tracking-wide text-center">{currentQuizCard.translation}</h2>
                      <SoundWaveButton onClick={() => playSpeech(currentQuizCard.word)} size="medium" className="my-1" isSpeaking={speakingText === currentQuizCard.word} />
                      <p className="text-xs text-slate-400 font-mono mt-3">级别: {currentQuizCard.level}  |  场景: {currentQuizCard.category}</p>
                    </div>
                    
                    <div className="w-full mt-auto pt-4 border-t border-slate-100 shrink-0">
                      <form onSubmit={handleQuizSubmit} className="w-full flex flex-col gap-3">
                        {quizStatus === 'waiting' && (
                          <div className="w-full flex gap-2 sm:gap-3 max-w-xl mx-auto">
                            <input 
                              ref={quizInputRef} type="text" placeholder="输入英文..." value={quizInput} onChange={(e) => setQuizInput(e.target.value)}
                              className="flex-1 bg-slate-50/80 border-2 border-slate-200 rounded-xl px-4 py-3 sm:py-4 text-lg sm:text-xl font-bold text-center tracking-widest text-[#0F172A] focus:outline-none focus:border-[#0D9488] focus:bg-white shadow-inner placeholder:text-slate-300"
                              autoCapitalize="none" autoComplete="off" spellCheck="false" inputMode="text" autoCorrect="off" autoFocus
                            />
                            <button type="submit" className="bg-[#0D9488] text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl font-black hover:bg-[#097A70] transition-all shadow-[0_4px_12px_rgba(13,148,136,0.25)] active:scale-[0.98] text-lg shrink-0">
                              提交
                            </button>
                          </div>
                        )}

                        {quizStatus === 'correct' && (
                          <div className="w-full flex flex-col items-center max-w-xl mx-auto animate-pulse">
                            <div className="bg-[#F0FDF4] w-full rounded-2xl p-4 sm:p-5 text-center border border-[#DCFCE7] shadow-sm flex flex-col items-center justify-center">
                              <span className="text-4xl block mb-2">🎉</span>
                              <div className="text-2xl sm:text-3xl text-[#166534] font-black tracking-widest uppercase">{currentQuizCard?.word}</div>
                            </div>
                          </div>
                        )}

                        {quizStatus === 'wrong' && (
                          <div className="w-full flex flex-col items-center max-w-xl mx-auto">
                            <div className="bg-[#FEF2F2] w-full rounded-2xl p-4 sm:p-5 text-left border border-[#FEE2E2] shadow-sm">
                              <div className="text-xs text-[#DC2626] font-bold mb-2 text-center">🙀 答错了，连对归零</div>
                              <div className="bg-white rounded-xl p-3 sm:p-4 text-xs font-mono shadow-sm">
                                <div className="flex items-center gap-2 py-1.5 border-b border-dashed border-slate-100">
                                  <span className="text-[10px] sm:text-xs text-slate-400 w-14 shrink-0 font-sans font-bold">你的拼写:</span>
                                  <div className="flex flex-wrap text-sm sm:text-base tracking-widest">
                                    {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                                      if (d.type === 'insert') return null;
                                      return <span key={idx} className={d.type === 'match' ? 'text-[#059669] font-black' : 'text-[#DC2626] line-through bg-rose-50 font-black px-1 rounded'}>{d.char}</span>;
                                    })}
                                    {quizInput.trim() === '' && <span className="text-rose-400 italic text-[10px] font-sans">(未输入)</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 py-1.5 mt-1">
                                  <span className="text-[10px] sm:text-xs text-slate-400 w-14 shrink-0 font-sans font-bold">正确答案:</span>
                                  <div className="flex flex-wrap text-sm sm:text-base tracking-widest items-center gap-1.5">
                                    {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                                      if (d.type === 'delete') return null;
                                      return <span key={idx} className={d.type === 'match' ? 'text-[#059669] font-bold' : 'text-[#D97706] bg-[#FFFBEB] underline font-bold px-1 rounded'}>{d.char}</span>;
                                    })}
                                    <SoundWaveButton onClick={(e) => playSpeech(currentQuizCard.word, e, true)} size="small" isSpeaking={speakingText === currentQuizCard.word} />
                                  </div>
                                </div>
                              </div>
                              <button type="button" onClick={() => nextQuizCard()} className="w-full mt-3 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 sm:py-3.5 rounded-xl text-sm transition-colors shadow-sm">
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
          )})}

          {/* ================= 单词大厅与列表视图 ================= */}
          {(currentView === 'hall' || currentView === 'list') && (() => {
            const filterCardsByQuery = (cards, queryText) => {
              const query = String(queryText || '').trim().toLowerCase();
              if (!query) return [];
              const isCn = containsChinese(query);
              return (cards || []).filter((card) => {
                if (!card) return false;
                const word = String(card.word || '').toLowerCase();
                const translation = String(card.translation || '').toLowerCase();
                const translationCn = String(card.translation_cn || '').toLowerCase();
                return isCn ? (translation.includes(query) || translationCn.includes(query)) : word.startsWith(query);
              });
            };

            if (currentView === 'hall') {
              const globalSearchResults = filterCardsByQuery(rawCards, globalSearchQuery);
              const displayResults = globalSearchResults.slice(0, globalVisibleCount);
              return (
                <div className="w-full max-w-5xl relative pb-8 flex-1 px-4">
                  <button onClick={() => setCurrentView('home')} className="absolute top-0 left-4 text-slate-500 text-sm flex items-center gap-1 hover:text-slate-700 bg-white border border-slate-200 px-4 py-1.5 rounded-full shadow-sm z-10 font-bold">
                    🔙 返回签到处
                  </button>
                  <div className="text-center mb-6 mt-2 pt-10 sm:pt-0">
                    <h2 className="text-lg font-black text-slate-800 flex items-center justify-center gap-2 mb-4">📚 单词大厅</h2>
                    <div className="w-full max-w-xl mx-auto mb-6 px-2">
                      <div className="relative">
                        <input type="text" placeholder="🔍 全局搜索：英文搜首字母，中文搜词意..." value={globalSearchQuery} onChange={(e) => { setGlobalSearchQuery(e.target.value); setGlobalVisibleCount(20); }} className="w-full px-5 py-3 bg-white border-2 border-[#0D9488]/30 rounded-2xl text-sm sm:text-base focus:outline-none focus:border-[#0D9488] shadow-sm font-medium text-slate-800 placeholder:text-slate-400 transition-colors" />
                        {globalSearchQuery && <button onClick={() => setGlobalSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center">✕</button>}
                      </div>
                    </div>
                    {!globalSearchQuery && (
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-xs text-slate-400 tracking-wider font-bold">选择词汇级别</span>
                        <div className="bg-white rounded-full p-1 shadow-sm flex flex-wrap justify-center border border-slate-200/80">
                          {getAvailableLevels().map((lvl) => <button key={lvl} onClick={() => setHallLevel(lvl)} className={`px-6 py-2 text-sm rounded-full font-black transition-all ${hallLevel === lvl ? 'bg-[#0D9488] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{lvl}</button>)}
                        </div>
                      </div>
                    )}
                  </div>
                  {globalSearchQuery ? (
                    <div className="w-full space-y-4 px-2">
                      <div className="text-xs text-slate-500 font-bold px-2 flex justify-between items-center">
                        <span>搜到 {globalSearchResults.length} 个相关单词：</span><span className="text-slate-400">展示级别与全部属性</span>
                      </div>
                      {displayResults.map((card) => (
                        <div key={card.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex gap-2 items-center">
                              <span className="bg-[#0D9488] text-white font-black px-2.5 py-0.5 rounded-md uppercase font-mono">{card.level}</span>
                              <span className="bg-[#F0FDF4] text-[#166534] font-bold px-2.5 py-0.5 rounded-md border border-[#DCFCE7]">{card.category}</span>
                              {card.is_archived && <span className="bg-slate-100 text-slate-400 font-bold px-2 py-0.5 rounded-md text-[10px]">已封印 🐾</span>}
                            </div>
                            <div className="text-slate-400 text-[11px]">连对: <strong className="text-[#D97706]">{card.streak_correct || 0}</strong>次 | 间隔: <strong className="text-[#059669]">{card.interval || 1}</strong>天</div>
                          </div>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-2xl font-black text-slate-800 font-mono">{card.word}</h3>
                                <span className="text-sm text-slate-400 font-light">{card.phonetic}</span>
                                <SoundWaveButton onClick={(e) => playSpeech(card.word, e)} size="small" isSpeaking={speakingText === card.word} />
                              </div>
                              <p className="text-base font-bold text-[#059669] mt-1">{card.translation}</p>
                            </div>
                            <button onClick={(e) => handleArchiveCard(card.id, e)} className={`text-xs px-3 py-1.5 rounded-full font-bold ${card.is_archived ? 'bg-slate-100 text-slate-400 cursor-default' : 'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60'}`}>{card.is_archived ? '已归档' : '封印 🐾'}</button>
                          </div>
                          {card.sentence && (
                            <div className="bg-slate-50/80 rounded-xl p-3 text-xs border border-slate-100">
                              <div className="flex justify-between items-center gap-2">
                                <p className="text-slate-700 font-medium italic">"{card.sentence}"</p>
                                <SoundWaveButton onClick={(e) => playSpeech(card.sentence, e)} size="small" isSpeaking={speakingText === card.sentence} />
                              </div>
                              {card.translation_cn && <p className="text-slate-400 mt-1">({card.translation_cn})</p>}
                            </div>
                          )}
                        </div>
                      ))}
                      {globalSearchResults.length === 0 && <div className="text-center py-12 text-slate-400 font-bold text-sm bg-white rounded-2xl border border-slate-200/80">没有找到符合 “{globalSearchQuery}” 的单词 😿</div>}
                      {globalSearchResults.length > globalVisibleCount && <div className="text-center py-4"><button onClick={() => setGlobalVisibleCount(prev => prev + 20)} className="bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] px-6 py-2 rounded-full text-sm font-bold hover:bg-[#DCFCE7]">查看更多结果 👇</button></div>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pb-10">
                      {getLibraryPacks().filter(p => p.level === hallLevel).map((pack) => (
                        <div key={`${pack.level}-${pack.category}`} onClick={() => { setSelectedLibPack(pack); setListSearchQuery(''); setListVisibleCount(20); setCurrentView('list'); }} className="bg-white rounded-3xl shadow-sm border border-slate-200/70 hover:border-[#0D9488] py-8 flex flex-col items-center cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
                          <div className="text-4xl mb-4">📦</div>
                          <h3 className="text-lg font-bold text-slate-800 mb-2">{pack.category}</h3>
                          <span className="text-xs text-[#0D9488] font-bold">共 {pack.count} 词</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            );
          }
          if (currentView === 'list' && selectedLibPack) {
            const targetList = (rawCards || []).filter((card) => card && card.level === selectedLibPack.level && card.category === selectedLibPack.category);
            const searchedList = listSearchQuery.trim() ? filterCardsByQuery(targetList, listSearchQuery) : targetList;
            const displayList = searchedList.slice(0, listVisibleCount);

            return (
              <div className="w-full max-w-5xl bg-white border border-slate-200/80 rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.05)] overflow-hidden flex flex-col min-h-[500px] mb-8 mx-4">
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-100 shrink-0 gap-3">
                  <div className="flex w-full sm:w-auto justify-between items-center gap-2">
                    <button onClick={() => setCurrentView('hall')} className="text-slate-600 text-sm flex items-center gap-1 border border-slate-200 px-4 py-1.5 rounded-full shrink-0 bg-white hover:bg-slate-50 transition-colors shadow-sm font-bold">🔙 返回大厅</button>
                    <span className="bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] text-xs font-black px-4 py-1.5 rounded-full uppercase shrink-0">{selectedLibPack.level} · {selectedLibPack.category}</span>
                  </div>
                  <input type="text" placeholder="🔍 搜包内单词/词意..." value={listSearchQuery} onChange={(e) => { setListSearchQuery(e.target.value); setListVisibleCount(20); }} className="w-full sm:w-56 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:border-[#0D9488] text-slate-800" />
                </div>
                <div className="flex-1 overflow-x-auto p-2 sm:p-6">
                  <div className="min-w-[500px]">
                    <div className="grid grid-cols-5 text-center text-sm font-bold text-slate-400 mb-4 pb-2 border-b border-slate-100">
                      <div className="col-span-1 text-left pl-4">单词</div><div className="col-span-1">发音</div><div className="col-span-1">中文</div><div className="col-span-1">连对/复习</div><div className="col-span-1">操作</div>
                    </div>
                    {displayList.map((card) => (
                      <div key={card.id} className="grid grid-cols-5 text-center items-center py-3 border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <div className="font-bold text-slate-800 text-base font-mono text-left pl-4">{card.word} {card.is_archived && <span className="block text-[10px] text-slate-400 font-sans">已封印</span>}</div>
                        <div className="flex justify-center items-center"><SoundWaveButton onClick={() => playSpeech(card.word)} size="small" isSpeaking={speakingText === card.word} /></div>
                        <div className="text-slate-700 text-sm font-medium">{card.translation}</div>
                        <div className="text-xs text-slate-400"><span className="text-[#D97706] font-bold">{card.streak_correct||0}次</span> / <span className="text-[#059669] font-bold">{card.interval||1}天</span></div>
                        <div><button onClick={(e) => { handleArchiveCard(card.id, e); if (rawCards.filter(c => c && c.id !== card.id && c.level === selectedLibPack.level && c.category === selectedLibPack.category).length === 0) setCurrentView('hall'); }} className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${card.is_archived ? 'bg-gray-100 text-gray-400 cursor-default' : 'text-slate-400 bg-slate-50 hover:text-rose-500 hover:bg-rose-50 border border-slate-200/60'}`}>{card.is_archived ? '已归档' : '封印 🐾'}</button></div>
                      </div>
                    ))}
                    {searchedList.length === 0 && <div className="text-center py-10 text-slate-400 font-bold text-sm">没有找到相关单词 😿</div>}
                    {searchedList.length > listVisibleCount && <div className="text-center py-6 border-t border-slate-100"><button onClick={() => setListVisibleCount(prev => prev + 20)} className="bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] px-6 py-2 rounded-full text-sm font-bold hover:bg-[#DCFCE7]">加载更多 👇</button></div>}
                  </div>
                </div>
              </div>
            );
          }
          })()}
        </div>
      )}

      {/* 🌟 防卡死封印交互弹窗 */}
      {pendingArchiveCard && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center border border-slate-100 animate-[pulse_0.3s_ease-out]">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-black text-slate-800 mb-2">连续答对 {pendingArchiveCard.streak_correct} 次！</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">您已非常熟悉 <strong className="text-[#0D9488] text-lg mx-1">{pendingArchiveCard.word}</strong><br/>是否将其永久封印？</p>
            <div className="flex gap-3">
              <button onClick={cancelArchiveFromModal} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold hover:bg-slate-200 transition-colors">继续复习</button>
              <button onClick={confirmArchiveFromModal} className="flex-1 bg-[#0D9488] text-white py-3.5 rounded-xl font-black hover:bg-[#097A70] shadow-[0_4px_12px_rgba(13,148,136,0.3)] transition-all active:scale-95">封印 🐾</button>
            </div>
          </div>
        </div>
      )}

      <footer className="shrink-0 w-full text-center py-2 text-[10px] text-slate-400 bg-transparent mt-auto">储备猫粮已同步至云端 ☁️</footer>

      {feedbackMsg && (
        <div className="fixed top-[40px] left-1/2 -translate-x-1/2 z-[999] bg-[#0F172A]/90 backdrop-blur-md text-white font-bold py-3 px-6 rounded-full shadow-2xl select-none text-sm pointer-events-none whitespace-nowrap animate-bounce" style={{ transition: 'all 0.3s ease-in-out' }}>
          {feedbackMsg}
        </div>
      )}
    </div>
  );
}
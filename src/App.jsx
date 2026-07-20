import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from './supabaseClient';
import { playErrorSound } from './utils';

// 引入刚刚拆分出来的 6 个积木组件
import HomeView from './components/HomeView';
import LevelSelectionView from './components/LevelSelectionView';
import CategorySelectionView from './components/CategorySelectionView';
import Header from './components/Header';
import FlashcardView from './components/FlashcardView';
import DictationView from './components/DictationView';

const LEVEL_ORDER = [
  'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 
  'TOEFL', 'IELTS', 'GRE', 
  'Business', 'Medical', 'Academic', 'Coding'
];

// 前端分类映射字典：将细碎的标签智能打包成大主题
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
  // --- 1. 核心状态 ---
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

  // --- 2. 引用 (Refs) ---
  const utteranceRef = useRef(null);
  const quizInputRef = useRef(null);
  const nextBtnRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const isTransitioningRef = useRef(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // --- 3. 生命周期 (Effects) ---
  useEffect(() => {
    fetchCards();
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentView === 'flashcard' && filteredCards.length > 0 && filteredCards[currentIndex]) {
      playSpeech(filteredCards[currentIndex].word);
    }
  }, [currentIndex, filteredCards, currentView]);

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

  // --- 4. 核心功能函数 ---
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
        utteranceRef.current.rate = isWrong ? 1.05 : 0.85;  
        utteranceRef.current.pitch = isWrong ? 1.35 : 1.0;   
        window.speechSynthesis.speak(utteranceRef.current);
      } catch (err) {}
    }, 20);
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

  const handleGrade = (quality) => {
    const currentCard = filteredCards[currentIndex];
    if (!currentCard) return;

    if (quality === 5) confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#A3C9B8', '#FBBF24', '#F43F5E'] });

    let msg = '';
    if (quality === 0) msg = '❌ 记忆重置，稍后马上复习';
    else if (quality === 3) msg = '😮 间隔微调，再接再厉';
    else if (quality === 5) msg = '😻 太棒了！已大幅延长复习间隔';

    if (msg) {
      setFeedbackMsg(msg);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMsg(null), 1500);
    }

    const sm2Data = calculateSM2(currentCard, quality);
    const updatedCard = { ...currentCard, ...sm2Data };

    supabase.from('words').update({
      interval: sm2Data.interval, repetitions: sm2Data.repetitions,
      easiness: sm2Data.easiness, next_review: sm2Data.next_review
    }).eq('id', currentCard.id);

    setAllCards(allCards.map(c => c.id === currentCard.id ? updatedCard : c));
    setRawCards(rawCards.map(c => c.id === currentCard.id ? updatedCard : c)); 
    const updatedFiltered = filteredCards.map(c => c.id === currentCard.id ? updatedCard : c);
    setFilteredCards(updatedFiltered);
    setIsFlipped(false);

    if (updatedFiltered.length <= 1) return;
    setCurrentIndex((currentIndex + 1) % updatedFiltered.length);
  };

  const handleArchiveCard = (cardId, e) => {
    if (e) e.stopPropagation();
    const confirmArchive = window.confirm("确定已永久掌握此单词？封印后它将化为猫粮！🐾");
    if (!confirmArchive) return;

    supabase.from('words').update({ is_archived: true }).eq('id', cardId);
    setArchivedCount(prev => prev + 1);

    setAllCards(allCards.filter(c => c.id !== cardId));
    setRawCards(rawCards.map(c => c.id === cardId ? { ...c, is_archived: true } : c)); 
    const remainsFiltered = filteredCards.filter(c => c.id !== cardId);
    setFilteredCards(remainsFiltered);
    setQuizPool(quizPool.filter(c => c.id !== cardId));

    setIsFlipped(false);
    if (currentIndex >= remainsFiltered.length && remainsFiltered.length > 0) setCurrentIndex(0);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#A3C9B8', '#FBBF24', '#F43F5E'] });
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
      const sm2Data = calculateSM2(currentQuizCard, 5); 
      const updatedData = { streak_correct: newStreak, interval: sm2Data.interval * newStreak, repetitions: sm2Data.repetitions };
      
      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      const newPool = quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c);
      setQuizPool(newPool);
      
      setTimeout(() => {
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
      
      const updatedData = { streak_correct: 0, interval: 1 };
      supabase.from('words').update(updatedData).eq('id', currentQuizCard.id);

      const updatedCard = { ...currentQuizCard, ...updatedData };
      setAllCards(allCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setRawCards(rawCards.map(c => c.id === currentQuizCard.id ? updatedCard : c)); 
      setFilteredCards(filteredCards.map(c => c.id === currentQuizCard.id ? updatedCard : c));
      setQuizPool(quizPool.map(c => c.id === currentQuizCard.id ? updatedCard : c));
    }
  };

  // 辅助跳转与提取函数
  const handleGoHome = (e) => {
    if (e) e.preventDefault();
    setStage('splash');
    setSelectedLevel('All');
    setSelectedCategory('All');
    setCurrentView('flashcard');
    setSelectedLibPack(null);
    setIsFlipped(false);
  };
  const handleNextCard = () => { if (filteredCards.length > 1) { setIsFlipped(false); setCurrentIndex((prev) => (prev + 1) % filteredCards.length); }};
  const handlePrevCard = () => { if (filteredCards.length > 1) { setIsFlipped(false); setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length); }};
  const nextQuizCard = (latestPool = quizPool) => {
    setQuizInput(''); setQuizStatus('waiting'); 
    if (latestPool.length === 0) return;
    const sortedPool = [...latestPool].sort((a, b) => (a.streak_correct || 0) - (b.streak_correct || 0));
    let nextItem = sortedPool[0];
    if (latestPool[currentIndex]) nextItem = sortedPool.find(c => c.id !== latestPool[currentIndex].id) || sortedPool[0];
    const newIdx = latestPool.findIndex(c => c.id === nextItem.id);
    setCurrentIndex(newIdx !== -1 ? newIdx : 0);
  };
  const getCatVisuals = (count) => {
    if (count === 0) return { emoji: '😿', status: '精瘦无力', text: '美短和缅因正在后方嗷嗷待哺... 快去封印单词生成猫粮！' };
    if (count < 15) return { emoji: '🐱', status: '身材标准', text: '主子们刚刚享用了你背熟的猫粮，身材非常优雅健康。' };
    if (count < 50) return { emoji: '😸', status: '微胖肚圆', text: '囤积的猫粮充足！主子们的肚子已经肉眼可见地圆滚滚了！' };
    return { emoji: '😹', status: '姥姥养的猪', text: '哇！封印词汇量惊人！主子们已经彻底胖成了姥姥养的巨无霸！' };
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
  const selectLevelDoor = (lvl) => { setSelectedLevel(lvl); setSelectedCategory('All'); setStage('category'); };
  const selectCategoryPack = (cat) => {
    setSelectedCategory(cat);
    let temp = [...allCards]; 
    if (selectedLevel !== 'All') temp = temp.filter(card => card.level === selectedLevel);
    if (cat !== 'All') temp = temp.filter(card => card.category === cat);
    setFilteredCards(temp); setQuizPool(temp); setCurrentIndex(0); setIsFlipped(false); setStage('learn');
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

  // --- 5. 渲染视图分配 ---
  if (isLoading) return <div className="min-h-[100dvh] bg-[#F9F7F3] flex items-center justify-center font-bold text-gray-500">猫咪连接中...</div>;
  if (stage === 'splash') return <HomeView archivedCount={archivedCount} catInfo={getCatVisuals(archivedCount)} onStart={() => setStage('level')} />;
  if (stage === 'level') return <LevelSelectionView availableLevels={getAvailableLevels()} allCards={allCards} onSelectLevel={selectLevelDoor} onGoHome={handleGoHome} />;
  if (stage === 'category') return <CategorySelectionView selectedLevel={selectedLevel} availableCategories={getAvailableCategories(selectedLevel)} allCards={allCards} onSelectCategory={selectCategoryPack} onGoBack={() => setStage('level')} />;

  return (
    <div className="min-h-[100dvh] bg-[#F9F7F3] overflow-y-auto">
      
      {currentView === 'flashcard' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} activeTab="flashcard" rawCardsCount={rawCards.length}
            onNavHome={handleGoHome} onNavFlashcard={() => { setCurrentView('flashcard'); setIsFlipped(false); }}
            onNavDictation={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); }} onNavLibrary={() => { setCurrentView('hall'); setSelectedLibPack(null); }}
          />
          <FlashcardView 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} currentCard={filteredCards[currentIndex] || null}
            currentIndex={currentIndex} totalCards={filteredCards.length} isFlipped={isFlipped} setIsFlipped={setIsFlipped}
            playSpeech={playSpeech} handlePrevCard={handlePrevCard} handleNextCard={handleNextCard} handleGrade={handleGrade}
            handleArchiveCard={handleArchiveCard} onChangePack={() => setStage('category')} onGoToLevels={() => setStage('level')}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          />
        </div>
      )}

      {currentView === 'dictation' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} activeTab="dictation" rawCardsCount={rawCards.length}
            onNavHome={handleGoHome} onNavFlashcard={() => { setCurrentView('flashcard'); setIsFlipped(false); }}
            onNavDictation={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); }} onNavLibrary={() => { setCurrentView('hall'); setSelectedLibPack(null); }}
          />
          <DictationView 
            currentQuizCard={quizPool[currentIndex] || null} quizPoolLength={quizPool.length} quizInput={quizInput} setQuizInput={setQuizInput}
            quizStatus={quizStatus} playSpeech={playSpeech} handleQuizSubmit={handleQuizSubmit} handleArchiveCard={handleArchiveCard}
            nextQuizCard={nextQuizCard} onChangePack={() => setStage('category')} quizInputRef={quizInputRef} nextBtnRef={nextBtnRef}
          />
        </div>
      )}

      {/* --- 单词库主厅视图 (暂未拆分) --- */}
      {currentView === 'hall' && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} activeTab="hall" rawCardsCount={rawCards.length}
            onNavHome={handleGoHome} onNavFlashcard={() => { setCurrentView('flashcard'); setIsFlipped(false); }}
            onNavDictation={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); }} onNavLibrary={() => { setCurrentView('hall'); setSelectedLibPack(null); }}
          />
          <div className="w-full max-w-4xl relative pb-8">
            <button onClick={handleGoHome} className="absolute top-0 left-0 text-gray-500 text-sm flex items-center gap-1 hover:text-gray-700 bg-white border border-gray-200 px-4 py-1.5 rounded-full shadow-sm">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
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
              {getLibraryPacks().filter(p => p.level === hallLevel).length === 0 && (
                <div className="col-span-full text-center text-sm font-bold text-gray-400 mt-10">该级别下暂无单词包 🐾</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- 单词库列表视图 (暂未拆分) --- */}
      {currentView === 'list' && selectedLibPack && (
        <div className="min-h-[100dvh] p-4 sm:p-6 flex flex-col items-center">
          <Header 
            selectedLevel={selectedLevel} selectedCategory={selectedCategory} activeTab="hall" rawCardsCount={rawCards.length}
            onNavHome={handleGoHome} onNavFlashcard={() => { setCurrentView('flashcard'); setIsFlipped(false); }}
            onNavDictation={() => { setCurrentView('dictation'); setQuizStatus('waiting'); setQuizInput(''); }} onNavLibrary={() => { setCurrentView('hall'); setSelectedLibPack(null); }}
          />
          <div className="w-full max-w-4xl bg-white rounded-[32px] shadow-sm overflow-hidden flex flex-col min-h-[500px] mb-8">
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

      <footer className="shrink-0 w-full text-center py-2 text-[10px] text-slate-400 bg-white/30 backdrop-blur-sm border-t border-slate-200/50 mt-auto">
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
// src/components/FlashcardView.jsx
import React from 'react';
import SoundWaveButton from './SoundWaveButton';

export default function FlashcardView({
  selectedLevel, selectedCategory, currentCard, currentIndex, totalCards,
  isFlipped, setIsFlipped, playSpeech, handlePrevCard, handleNextCard, handleGrade,
  handleArchiveCard, onChangePack, onGoToLevels, onTouchStart, onTouchMove, onTouchEnd,
  speakingText
}) {
  const handleCardClick = () => {
    if (isFlipped) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsFlipped(false);
    } else {
      playSpeech(currentCard?.word);
      setIsFlipped(true);
    }
  };

  return (
    <div className="w-full max-w-2xl flex-1 flex flex-col justify-center pb-8 sm:pb-12">
      <div className="flex justify-between items-center mb-3 px-2 shrink-0">
        <div className="flex gap-2 items-center">
          <span className="bg-white text-slate-600 border border-slate-200/80 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm font-bold">当前关卡: <strong className="text-[#0D9488] ml-1">{selectedLevel}</strong></span>
          <button onClick={onChangePack} className="text-[#0D9488] text-[10px] sm:text-xs font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200/80 hover:bg-slate-50 transition-colors">🔙 换包</button>
        </div>
      </div>

      {!currentCard ? (
        <div className="bg-white border border-slate-200/80 rounded-[32px] shadow-sm p-12 text-center my-auto min-h-[320px] flex flex-col items-center justify-center">
          <span className="text-5xl mb-4">🎉</span>
          <p className="text-slate-600 font-bold mb-4">今日该主题复习任务已全部完成！</p>
          <button onClick={onGoToLevels} className="bg-[#0D9488] text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-[#097A70] transition-colors">去选其他大门</button>
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
              待背剩余: {totalCards}
            </span>
          </div>

          <div 
            style={{ touchAction: 'none', perspective: '1000px' }}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            onClick={handleCardClick}
            className="w-full aspect-[4/5] sm:aspect-[1.618/1] max-h-[50vh] min-h-[320px] bg-transparent mb-6 sm:mb-8 flex flex-col relative cursor-pointer shrink-0"
          >
            <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
              
              {/* 正面：纯净纯白 + 悬浮浮雕暗影 */}
              <div 
                className="absolute inset-0 w-full h-full bg-white rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-100 p-8 sm:p-12 flex flex-col items-center justify-center relative overflow-hidden"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <button 
                  onClick={(e) => handleArchiveCard(currentCard.id, e)} 
                  className="absolute top-5 right-5 text-[10px] sm:text-xs bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 px-3 py-1 rounded-full border border-slate-200/60 font-bold transition-colors z-10 shadow-sm"
                >
                  封印 🐾
                </button>

                <div className="flex flex-col items-center justify-center flex-1 my-auto">
                  <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
                    <h2 className="text-5xl sm:text-7xl font-black text-[#0F172A] tracking-tight">{currentCard?.word}</h2>
                    <SoundWaveButton onClick={(e) => playSpeech(currentCard?.word, e)} size="medium" isSpeaking={speakingText === currentCard?.word} />
                  </div>
                  <p className="text-xl sm:text-2xl text-slate-400 font-light mt-1">{currentCard?.phonetic}</p>
                </div>

                <div className="absolute bottom-6 text-xs text-[#D97706] font-bold bg-[#FFFBEB] border border-[#FEF3C7] px-4 py-1.5 rounded-full">🐱 点击卡片任意地方翻面</div>
              </div>

              {/* 背面 */}
              <div className="absolute inset-0 w-full h-full bg-slate-50/90 rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-200/80 p-8 sm:p-12 flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="flex flex-col items-center justify-center flex-1 my-auto w-full">
                  <h2 className="text-4xl sm:text-5xl font-black text-[#0F172A] mb-6">{currentCard?.translation}</h2>
                  <div className="flex items-center justify-center gap-3 mb-2 max-w-full px-2">
                    <p className="text-sm sm:text-lg text-slate-700 font-medium break-words leading-relaxed text-center flex-1">
                      "{currentCard?.sentence}"
                    </p>
                    <SoundWaveButton onClick={(e) => playSpeech(currentCard?.sentence, e)} size="small" isSpeaking={speakingText === currentCard?.sentence} />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2">({currentCard?.translation_cn})</p>
                </div>
              </div>

            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0 mx-auto w-full max-w-[90%] sm:max-w-md">
            <button onClick={(e) => { e.stopPropagation(); handleGrade(0); }} className="bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#FEE2E2] transition-colors shadow-sm">
              <span className="text-2xl sm:text-3xl">❌</span>
              <span className="text-xs sm:text-sm font-bold">遗忘了</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleGrade(3); }} className="bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#FEF3C7] transition-colors shadow-sm">
              <span className="text-2xl sm:text-3xl">😲</span>
              <span className="text-xs sm:text-sm font-bold">记不清</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleGrade(5); }} className="bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] rounded-2xl py-4 sm:py-5 flex flex-col items-center gap-1 sm:gap-2 hover:bg-[#A7F3D0]/60 transition-colors shadow-sm">
              <span className="text-2xl sm:text-3xl">😻</span>
              <span className="text-xs sm:text-sm font-bold">秒记住</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
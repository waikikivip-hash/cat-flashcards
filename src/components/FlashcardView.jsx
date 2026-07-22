// src/components/FlashcardView.jsx
import React from 'react';
import SoundWaveButton from './SoundWaveButton';

export default function FlashcardView({
  selectedLevel, selectedCategory, currentCard, currentIndex, totalCards,
  isFlipped, setIsFlipped, playSpeech, handlePrevCard, handleNextCard, handleGrade,
  handleArchiveCard, onChangePack, onGoToLevels, onTouchStart, onTouchMove, onTouchEnd,
  isSpeaking
}) {
  return (
    <div className="w-full max-w-2xl flex-1 flex flex-col justify-center pb-8 sm:pb-12">
      <div className="flex justify-between items-center mb-3 px-2 shrink-0">
        <div className="flex gap-2 items-center">
          <span className="bg-white text-gray-500 border border-gray-100 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm">当前关卡: <strong className="text-[#A3C9B8] ml-1">{selectedLevel}</strong></span>
          <button onClick={onChangePack} className="text-[#A3C9B8] text-[10px] sm:text-xs font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-50 hover:bg-gray-50 transition-colors">🔙 换包</button>
        </div>
      </div>

      {!currentCard ? (
        <div className="bg-white rounded-[32px] shadow-sm p-12 text-center my-auto min-h-[320px] flex flex-col items-center justify-center">
          <span className="text-5xl mb-4">🎉</span>
          <p className="text-gray-500 font-bold mb-4">今日该主题复习任务已全部完成！</p>
          <button onClick={onGoToLevels} className="bg-[#A3C9B8] text-[#2D4A3E] px-6 py-2 rounded-xl font-bold">去选其他大门</button>
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
                待背剩余: {totalCards}
              </span>
              <button onClick={(e) => handleArchiveCard(currentCard.id, e)} className="text-[10px] sm:text-xs bg-[#FFEBEB] text-[#D84C4C] px-2.5 py-1.5 rounded-md border border-[#FFDFDF] font-bold hover:bg-[#FFDFDF] transition-colors">封印🐾</button>
            </div>
          </div>

          <div 
            style={{ touchAction: 'none', perspective: '1000px' }}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            onClick={() => { playSpeech(currentCard?.word); setIsFlipped(!isFlipped); }}
            className="w-full aspect-[4/5] sm:aspect-[1.618/1] max-h-[50vh] min-h-[300px] bg-transparent mb-6 sm:mb-8 flex flex-col relative cursor-pointer shrink-0"
          >
            <div className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
              {/* 正面：光学居中且发音键完美平齐 */}
              <div 
                className="absolute inset-0 w-full h-full bg-white rounded-[32px] shadow-sm p-8 sm:p-12 flex flex-col items-center justify-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <h2 className="text-5xl sm:text-7xl font-extrabold text-gray-800">{currentCard?.word}</h2>
                  <SoundWaveButton onClick={(e) => playSpeech(currentCard?.word, e)} size="medium" isSpeaking={isSpeaking} />
                </div>
                <p className="text-xl sm:text-2xl text-gray-400 font-light mt-2">{currentCard?.phonetic}</p>
                <div className="absolute bottom-6 text-xs text-[#D4A017] font-medium bg-[#FFF8E1] px-4 py-1.5 rounded-full">🐱 点击卡片任意地方翻面</div>
              </div>

              {/* 背面 */}
              <div className="absolute inset-0 w-full h-full bg-[#EBF5F0] rounded-[32px] shadow-sm p-8 sm:p-12 flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <h2 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-6">{currentCard?.translation}</h2>
                <div className="flex items-center justify-center gap-3 mb-2 max-w-full px-2">
                  <p className="text-sm sm:text-lg text-gray-600 font-medium break-words leading-relaxed text-center flex-1">
                    "{currentCard?.sentence}"
                  </p>
                  <SoundWaveButton onClick={(e) => playSpeech(currentCard?.sentence, e)} size="small" isSpeaking={isSpeaking} />
                </div>
                <p className="text-xs sm:text-sm text-gray-400 mt-2">({currentCard?.translation_cn})</p>
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
  );
}
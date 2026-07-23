// src/components/DictationView.jsx
import React from 'react';
import { getDiff } from '../utils';
import SoundWaveButton from './SoundWaveButton';

export default function DictationView({
  currentQuizCard, quizPoolLength, quizInput, setQuizInput, quizStatus,
  playSpeech, handleQuizSubmit, handleArchiveCard, nextQuizCard,
  onChangePack, quizInputRef, nextBtnRef, speakingText
}) {
  return (
    <div className="w-full max-w-3xl flex-1 flex flex-col justify-center pb-8 sm:pb-12">
      {!currentQuizCard ? (
        <div className="w-full bg-white rounded-[32px] shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">🎉</span>
          <p className="text-gray-500 font-bold mb-4">考核队列空空如也，太厉害了！</p>
          <button onClick={onChangePack} className="bg-[#A3C9B8] text-[#2D4A3E] px-6 py-2 rounded-xl font-bold">换个主题继续</button>
        </div>
      ) : (
        <div className="w-full bg-white rounded-[32px] shadow-sm p-6 sm:p-8 flex flex-col items-center relative shrink-0 min-h-[380px] overflow-visible">
          <button onClick={onChangePack} className="absolute top-6 left-6 text-gray-400 text-xs sm:text-sm flex items-center gap-1 hover:text-gray-600 transition-colors bg-gray-50 px-3 py-1.5 rounded-full z-10">
            🔙 换包
          </button>
          
          <div className="w-full flex justify-end items-center mb-4 shrink-0">
            <div className="flex gap-2">
              <span className="bg-gray-50 text-gray-500 border border-gray-100 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm">
                🎯 连对: <strong className="text-[#D4A017] ml-1">{currentQuizCard.streak_correct || 0}</strong>
              </span>
              <span className="bg-[#EBF5F0] text-[#4A9A74] border border-[#D5EAE2] text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold flex items-center shadow-sm">
                ⏳ 剩余题目: {quizPoolLength}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1 w-full my-auto py-2">
            <p className="text-[11px] sm:text-xs text-[#D4A017] font-bold mb-3 tracking-wider bg-[#FFF8E1] px-4 py-1.5 rounded-full">👇 请听音并拼写</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-800 mb-3 tracking-wide text-center">{currentQuizCard.translation}</h2>
            
            <SoundWaveButton 
              onClick={() => playSpeech(currentQuizCard.word)} 
              size="medium" 
              className="my-1" 
              isSpeaking={speakingText === currentQuizCard.word}
            />

            <p className="text-xs text-gray-400 font-mono mt-3">级别: {currentQuizCard.level}  |  场景: {currentQuizCard.category}</p>
          </div>
          
          <div className="w-full mt-auto pt-4 border-t border-gray-50 shrink-0">
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
                  <button type="submit" className="bg-[#A3C9B8] text-[#2D4A3E] px-6 sm:px-10 py-3 sm:py-4 rounded-xl font-black hover:bg-[#8FBBAA] transition-all shadow-[0_3px_0_#7eb5af] active:shadow-none active:translate-y-0.5 text-lg shrink-0">
                    提交
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center max-w-xl mx-auto">
                  <div className="bg-[#FFF5F5] w-full rounded-2xl p-4 sm:p-5 text-left border border-[#FFE3E3] shadow-sm">
                    <div className="text-xs text-[#D84C4C] font-bold mb-2 text-center">🙀 答错了，连对归零</div>
                    
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-xs font-mono shadow-sm">
                      <div className="flex items-center gap-2 py-1.5 border-b border-dashed border-gray-100">
                        <span className="text-[10px] sm:text-xs text-gray-400 w-14 shrink-0 font-sans font-bold">你的拼写:</span>
                        <div className="flex flex-wrap text-sm sm:text-base tracking-widest">
                          {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                            if (d.type === 'insert') return null;
                            const spanClass = d.type === 'match' ? 'text-green-600 font-bold' : 'text-red-500 line-through bg-red-50 font-bold px-1 rounded';
                            return <span key={idx} className={spanClass}>{d.char}</span>;
                          })}
                          {quizInput.trim() === '' && <span className="text-red-400 italic text-[10px] font-sans">(未输入)</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 py-1.5 mt-1">
                        <span className="text-[10px] sm:text-xs text-gray-400 w-14 shrink-0 font-sans font-bold">正确答案:</span>
                        <div className="flex flex-wrap text-sm sm:text-base tracking-widest items-center gap-1.5">
                          {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                            if (d.type === 'delete') return null;
                            const spanClass = d.type === 'match' ? 'text-green-600 font-bold' : 'text-[#D4A017] bg-[#FFF8E1] underline font-bold px-1 rounded';
                            return <span key={idx} className={spanClass}>{d.char}</span>;
                          })}
                          <SoundWaveButton 
                            onClick={(e) => playSpeech(currentQuizCard.word, e, true)} 
                            size="small" 
                            isSpeaking={speakingText === currentQuizCard.word} 
                          />
                        </div>
                      </div>
                    </div>

                    <button 
                      ref={nextBtnRef} 
                      type="button" 
                      onClick={() => nextQuizCard()} 
                      className="w-full mt-3 bg-[#2D4A3E] hover:bg-[#233b31] text-white font-bold py-3 sm:py-3.5 rounded-xl text-sm transition-colors shadow-sm"
                    >
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
  );
}
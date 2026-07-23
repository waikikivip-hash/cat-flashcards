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
        <div className="w-full bg-white rounded-[32px] border border-slate-200/80 shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">🎉</span>
          <p className="text-slate-600 font-bold mb-4">考核队列空空如也，太厉害了！</p>
          <button onClick={onChangePack} className="bg-[#0D9488] text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-[#097A70] transition-colors">换个主题继续</button>
        </div>
      ) : (
        <div className="w-full bg-white rounded-[32px] shadow-[0_12px_32px_rgba(15,23,42,0.06)] border border-slate-100 p-6 sm:p-8 flex flex-col items-center relative shrink-0 min-h-[380px] overflow-visible">
          <button onClick={onChangePack} className="absolute top-6 left-6 text-slate-500 text-xs sm:text-sm flex items-center gap-1 hover:text-slate-700 transition-colors bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-full z-10 shadow-sm font-bold">
            🔙 换包
          </button>
          
          <div className="w-full flex justify-end items-center mb-4 shrink-0">
            <div className="flex gap-2">
              <span className="bg-slate-50 text-slate-600 border border-slate-200/80 text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm font-medium">
                🎯 连对: <strong className="text-[#D97706] ml-1">{currentQuizCard.streak_correct || 0}</strong>
              </span>
              <span className="bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold flex items-center shadow-sm">
                ⏳ 剩余题目: {quizPoolLength}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1 w-full my-auto py-2">
            <p className="text-[11px] sm:text-xs text-[#D97706] font-bold mb-3 tracking-wider bg-[#FFFBEB] border border-[#FEF3C7] px-4 py-1.5 rounded-full">👇 请听音并拼写</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3 tracking-wide text-center">{currentQuizCard.translation}</h2>
            
            <SoundWaveButton 
              onClick={() => playSpeech(currentQuizCard.word)} 
              size="medium" 
              className="my-1" 
              isSpeaking={speakingText === currentQuizCard.word}
            />

            <p className="text-xs text-slate-400 font-mono mt-3">级别: {currentQuizCard.level}  |  场景: {currentQuizCard.category}</p>
          </div>
          
          <div className="w-full mt-auto pt-4 border-t border-slate-100 shrink-0">
            <form onSubmit={handleQuizSubmit} className="w-full flex flex-col gap-3">
              {quizStatus === 'waiting' ? (
                <div className="w-full flex gap-2 sm:gap-3 max-w-xl mx-auto">
                  <input 
                    ref={quizInputRef}
                    type="text" 
                    placeholder="输入英文..." 
                    value={quizInput} 
                    onChange={(e) => setQuizInput(e.target.value)}
                    className="flex-1 bg-slate-50/80 border-2 border-slate-200 rounded-xl px-4 py-3 sm:py-4 text-lg sm:text-xl font-bold text-center tracking-widest text-[#0F172A] focus:outline-none focus:border-[#0D9488] focus:bg-white shadow-inner placeholder:text-slate-300"
                    autoCapitalize="none" autoComplete="off" spellCheck="false" inputMode="text" autoCorrect="off" autoFocus
                  />
                  <button type="submit" className="bg-[#0D9488] text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl font-black hover:bg-[#097A70] transition-all shadow-[0_4px_12px_rgba(13,148,136,0.25)] active:scale-[0.98] text-lg shrink-0">
                    提交
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center max-w-xl mx-auto">
                  <div className="bg-[#FEF2F2] w-full rounded-2xl p-4 sm:p-5 text-left border border-[#FEE2E2] shadow-sm">
                    <div className="text-xs text-[#DC2626] font-bold mb-2 text-center">🙀 答错了，连对归零</div>
                    
                    <div className="bg-white rounded-xl p-3 sm:p-4 text-xs font-mono shadow-sm">
                      <div className="flex items-center gap-2 py-1.5 border-b border-dashed border-slate-100">
                        <span className="text-[10px] sm:text-xs text-slate-400 w-14 shrink-0 font-sans font-bold">你的拼写:</span>
                        <div className="flex flex-wrap text-sm sm:text-base tracking-widest">
                          {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                            if (d.type === 'insert') return null;
                            const spanClass = d.type === 'match' ? 'text-[#059669] font-black' : 'text-[#DC2626] line-through bg-rose-50 font-black px-1 rounded';
                            return <span key={idx} className={spanClass}>{d.char}</span>;
                          })}
                          {quizInput.trim() === '' && <span className="text-rose-400 italic text-[10px] font-sans">(未输入)</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 py-1.5 mt-1">
                        <span className="text-[10px] sm:text-xs text-slate-400 w-14 shrink-0 font-sans font-bold">正确答案:</span>
                        <div className="flex flex-wrap text-sm sm:text-base tracking-widest items-center gap-1.5">
                          {getDiff(quizInput, currentQuizCard.word).map((d, idx) => {
                            if (d.type === 'delete') return null;
                            const spanClass = d.type === 'match' ? 'text-[#059669] font-black' : 'text-[#D97706] bg-[#FFFBEB] underline font-black decoration-[#F59E0B] decoration-2 px-1 rounded';
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
                      className="w-full mt-3 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 sm:py-3.5 rounded-xl text-sm transition-colors shadow-sm"
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
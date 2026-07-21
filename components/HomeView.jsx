// src/components/HomeView.jsx
import React from 'react';

export default function HomeView({ archivedCount, catInfo, onStart }) {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-[#f4f1ea] flex flex-col items-center justify-center p-6 font-sans text-slate-700 overflow-hidden">
      <div className="bg-[#fcfaf5] rounded-[2rem] p-8 border border-[#e8e4dc] shadow-[0_8px_30px_rgba(0,0,0,0.04)] max-w-md w-full text-center">
        <div className="text-7xl block mb-4 animate-bounce select-none">{catInfo.emoji}</div>
        <h1 className="text-2xl font-black text-slate-800 tracking-wider">🐱 猫咪主子开饭签到处</h1>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cat Feeding Base</p>
        
        <div className="my-6 bg-white rounded-2xl p-4 border border-[#e8e4dc] shadow-sm text-left">
          <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1.5">
            <span className="text-xs font-bold text-slate-400">当前储备猫粮</span>
            <span className="bg-[#a4d5cf] text-[#1b433e] text-[10px] font-black px-2.5 py-0.5 rounded-full">状态: {catInfo.status}</span>
          </div>
          <p className="text-sm font-medium text-slate-600 text-center py-1">
            已背熟封印：<strong className="text-[#a4d5cf] text-2xl font-black mx-1">{archivedCount}</strong> 粒猫粮 罐罐
          </p>
          <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed italic">"{catInfo.text}"</p>
        </div>
        
        <button 
          onClick={onStart} 
          className="w-full bg-[#a4d5cf] hover:bg-[#92c5bf] text-[#1b433e] font-black py-4 px-6 rounded-2xl shadow-[0_4px_0_#7eb5af] active:shadow-none active:translate-y-1 transition-all text-lg tracking-wide"
        >
          罐罐倒好了，推开学院大门
        </button>
      </div>
    </div>
  );
}
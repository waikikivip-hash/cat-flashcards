// src/utils.js

// 🛠️ 字符级别精确对比算法
export function getDiff(str1, str2) {
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

// 🛠️ 基于 Web Audio API 的免加载错误提示音
export const playErrorSound = () => {
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
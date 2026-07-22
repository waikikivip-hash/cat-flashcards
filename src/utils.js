// src/utils.js

export const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'TOEFL', 'IELTS', 'GRE', 'Business', 'Medical', 'Academic', 'Coding'];
export const INTERVAL_STAIRS = [1, 3, 7, 15, 30, 60, 90];

// 判断文本是否包含中文
export const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(String(text || ''));

// 洗牌算法
export const shuffleArray = (array) => {
  const arr = [...(array || [])];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 判定单词是否到期
export const isCardDue = (card) => {
  if (!card || !card.next_review) return true;
  return card.next_review <= Math.floor(Date.now() / 1000);
};

// 前端分类映射字典
export const mapCategory = (level, cat) => {
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

// 字符比对算法
export function getDiff(str1, str2) {
  const s1 = String(str1 || '').trim();
  const s2 = String(str2 || '').trim();
  const s1Low = s1.toLowerCase();
  const s2Low = s2.toLowerCase();
  
  const dp = Array(s1.length + 1).fill(0).map(() => Array(s2.length + 1).fill(0));
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      dp[i][j] = s1Low[i - 1] === s2Low[j - 1] 
        ? dp[i - 1][j - 1] + 1 
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
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

// 错误音效
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

// 艾宾浩斯复习计算
export const calculateNextReview = (card, quality) => {
  const now = Math.floor(Date.now() / 1000);
  let reps = card ? (card.repetitions || 0) : 0;
  if (quality < 3) return { repetitions: 0, interval: 1, next_review: now };
  const isEarlyReview = card && card.next_review && card.next_review > now;
  if (isEarlyReview && reps > 0) return { repetitions: reps, interval: card.interval || 1, next_review: card.next_review };
  if (quality === 3) {
    const currentInterval = card ? (card.interval || 1) : 1;
    return { repetitions: reps, interval: currentInterval, next_review: now + currentInterval * 86400 };
  }
  if (quality === 5) {
    const nextInterval = INTERVAL_STAIRS[Math.min(reps, INTERVAL_STAIRS.length - 1)];
    return { repetitions: reps + 1, interval: nextInterval, next_review: now + nextInterval * 86400 };
  }
};

// 猫咪状态文案
export const getCatVisuals = (count) => {
  if (count === 0) return { emoji: '😿', status: '精瘦无力', text: '美短和缅因正在后方嗷嗷待哺... 快去封印单词生成猫粮！' };
  if (count < 15) return { emoji: '🐱', status: '身材标准', text: '主子们刚刚享用了你背熟的猫粮，身材非常优雅健康。' };
  if (count < 50) return { emoji: '😸', status: '微胖肚圆', text: '囤积的猫粮充足！主子们的肚子已经肉眼可见地圆滚滚了！' };
  return { emoji: '😹', status: '姥姥养的猪', text: '哇！封印词汇量惊人！主子们已经彻底胖成了姥姥养的巨无霸！' };
};
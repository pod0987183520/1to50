// ==========================================
// 1. 遊戲核心變數與 DOM 宣告
// ==========================================
let currentTarget = 1;                  
let startTime = null;                    
let timerInterval = null;              
let gameActive = false;                
const totalNumbers = 50;               

// Google Apps Script 後端 API 網址
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzFXNURbzrMozLkwZ5HlJDiTN9arH5Ihel2gGT2E4I7pjEzQ-RFmU3Cn8eE50LsCyXugQ/exec';

const DOM = {
    grid: document.getElementById('gameGrid'),
    timer: document.getElementById('timerDisplay'),
    hint: document.getElementById('hintDisplay'),
    resultModal: document.getElementById('resultModal'),
    finalScore: document.getElementById('finalScore'),
    praiseMsg: document.getElementById('praiseMessage'),
    rankMsg: document.getElementById('rankMessage'),
    historyModal: document.getElementById('historyModal'),
    historyList: document.getElementById('historyList')
};

// ==========================================
// 2. 基礎工具、排行邏輯與情緒價值
// ==========================================

// 輔助函式：數字轉國字
function convertToChinese(num) {
    const chinese = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return (num >= 0 && num <= 10) ? chinese[num] : num.toString();
}

// 👑 雙軌排行演算法 (強固防禦版：絕不因舊資料崩潰)
function calculateRankInHistory(currentScore, timestamp) {
    const currentSeconds = parseFloat(currentScore);
    let history = [];
    
    try {
        const stored = localStorage.getItem('game_1to50_history');
        history = JSON.parse(stored);
        if (!Array.isArray(history)) history = [];
    } catch (e) {
        history = [];
    }

    const currentRecord = { score: currentSeconds, timestamp: timestamp };
    const cleanHistory = history.filter(item => item && typeof item === 'object' && !isNaN(parseFloat(item.score)));
    const allRecords = [...cleanHistory, currentRecord];

    // --- 軌道 1：本日成績 ---
    const todayStart = new Date(timestamp).setHours(0, 0, 0, 0);
    const todayRecords = allRecords.filter(item => item.timestamp && item.timestamp >= todayStart);
    
    if (todayRecords.length === 0) todayRecords.push(currentRecord);
    todayRecords.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
    
    const todayRank = todayRecords.findIndex(item => item.timestamp === timestamp) + 1;
    const todayBest = parseFloat(todayRecords[0].score);

    let todayHtml = `<div style="background-color: #ebf8ff; padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #bee3f8; color: #2b6cb0;">`;
    if (todayRank === 1) {
        todayHtml += `🏆 <strong>本日戰績：</strong><br>太厲害了！守住今天的冠軍寶座！`;
    } else {
        const diffToFirst = (currentSeconds - todayBest).toFixed(2);
        todayHtml += `🏆 <strong>本日第${convertToChinese(todayRank)}名：</strong><br>只要再快 ${diffToFirst} 秒<br>就可以達到第一名！`;
    }
    todayHtml += `</div>`;

    // --- 軌道 2：歷史排行榜 ---
    allRecords.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
    
    let historyHtml = `<div style="background-color: #f0fff4; padding: 10px; border-radius: 8px; border: 1px solid #c6f6d5; color: #2f855a;">`;
    
    const isNewRecord = (allRecords[0].timestamp === timestamp);
    const historyRank = allRecords.findIndex(item => item.timestamp === timestamp) + 1;

    if (isNewRecord) {
        const oldBest = allRecords.length > 1 ? allRecords[1].score : null;
        historyHtml += `📈 <strong>恭喜你刷新歷史紀錄 <第一名></strong><br>`;
        historyHtml += oldBest ? `(之前最佳成績僅為 ${oldBest} 秒)` : `(這是你的首戰紀錄喔！)`;
    } else if (historyRank <= 5) {
        const historyBest = parseFloat(allRecords[0].score);
        historyHtml += `📈 <strong>歷史排行榜第${convertToChinese(historyRank)}名：</strong><br>你的最高紀錄為 ${historyBest} 秒！`;
    } else {
        historyHtml += `📈 <strong>歷史紀錄：</strong><br>快達到歷史排行榜囉！`;
    }
    historyHtml += `</div>`;

    return todayHtml + historyHtml;
}

// 👑 12階情緒價值
function getPraiseMessage(rawSeconds) {
    const seconds = Math.round(parseFloat(rawSeconds));
    
    if (seconds < 60) return "👑 好快！教教我！<br>你是怎麼練的呢?";
    if (seconds < 100) return "🌟 哇！太厲害了！<br>你的手眼協調真好！";
    if (seconds < 140) return "🌟 喔！不錯喔！<br>你的腦筋很靈活喔！";
    if (seconds < 200) return "🌟 哇！真快！<br>繼續練習！失智症將會遠離你！";
    if (seconds < 220) return "🌟 哇！不錯喔！<br>有進步喔！";
    if (seconds < 240) return "🌟 喔！蠻快的嘛！<br>再玩一次！你可以更快的！";
    if (seconds < 260) return "🌟 哇！終於完成了！<br>再來一場吧！";
    if (seconds < 280) return "🌟 哇！好強喔！<br>你的速度越來越快了！";
    if (seconds < 300) return "🌟 哇！真快！<br>持續練習，你就不會退化。";
    if (seconds < 350) return "🌟 哇！不錯喔！<br>再練習一次，你一定可以低於300秒的！";
    if (seconds < 400) return "🌟 強！你完成了！<br>再練習一次，你可以更快的！";
    
    return "🌟 不錯喔！再玩一次，<br>讓我們一定可以突破400秒！";
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function saveScoreToLocal(score, timestamp) {
    let history = [];
    try {
        const stored = localStorage.getItem('game_1to50_history');
        history = JSON.parse(stored);
        if (!Array.isArray(history)) history = [];
    } catch (e) {
        history = [];
    }
    
    const d = new Date(timestamp);
    const dateString = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    
    history.unshift({ date: dateString, score: score, timestamp: timestamp });
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    history = history.filter(item => item && item.timestamp && item.timestamp > ninetyDaysAgo);
    localStorage.setItem('game_1to50_history', JSON.stringify(history));
}

// ==========================================
// 3. 遊戲核心運行邏輯
// ==========================================
function initGame() {
    currentTarget = 1;
    gameActive = false;
    startTime = null;
    clearInterval(timerInterval);
    DOM.timer.innerText = "⏱️ 0.00 秒";
    DOM.hint.innerText = "請點選：1";
    DOM.grid.innerHTML = ''; 

    const firstHalf = Array.from({ length: 25 }, (_, i) => i + 1);
    shuffleArray(firstHalf);

    firstHalf.forEach(num => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.setAttribute('data-val', num);
        cell.innerText = num;
        
        // 👍 用 pointerdown 確保長輩左手指腹壓在螢幕邊緣時，右手依然能「一摸即中」防誤觸
        cell.addEventListener('pointerdown', () => {
            handleCellClick(cell);
        });
        
        DOM.grid.appendChild(cell);
    });
}

function handleCellClick(cell) {
    const currentVal = parseInt(cell.getAttribute('data-val'), 10);
    if (currentVal !== currentTarget) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        cell.classList.add('wrong');
        setTimeout(() => cell.classList.remove('wrong'), 300);
        return; 
    }
    
    // ==========================================
    // 👑 兩全其美震動防禦演算法
    // ==========================================
    if (navigator.vibrate) {
        if (currentTarget === 1) {
            // 第一下點擊：延遲 150ms 避開全螢幕/網址列收合的硬體忙碌期，確保 100% 震動
            setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate(20);
            }, 150);
        } else {
            // 後續點擊：硬體與全螢幕已穩定，直接過電震動
            navigator.vibrate(20);
        }
    }
    // ==========================================
    
    if (currentTarget === 1 && !gameActive) {
        gameActive = true;
        startTime = performance.now();
        timerInterval = setInterval(updateTimer, 10);
        document.getElementById('androidBanner').classList.add('hidden');
    }
    
    if (currentVal <= 25) {
        const nextVal = currentVal + 25;
        cell.setAttribute('data-val', nextVal);
        cell.innerText = nextVal;
    } else {
        cell.innerText = '';
        cell.style.visibility = 'hidden';
    }
    
    currentTarget++;
    
    if (currentTarget > totalNumbers) {
        endGame();
    } else {
        DOM.hint.innerText = `請點選：${currentTarget}`;
    }
}

function updateTimer() {
    const elapsed = (performance.now() - startTime) / 1000;
    DOM.timer.innerText = `⏱️ ${elapsed.toFixed(2)} 秒`;
}

function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    
    const finalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    const nowTimestamp = Date.now();
    
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    
    DOM.rankMsg.innerHTML = calculateRankInHistory(finalTime, nowTimestamp);
    DOM.finalScore.innerText = `本次成績：${finalTime} 秒`;
    DOM.praiseMsg.innerHTML = getPraiseMessage(finalTime);
    
    DOM.resultModal.classList.add('show');
    saveScoreToLocal(finalTime, nowTimestamp);
}

// ==========================================
// 4. 事件綁定與跨載具判斷
// ==========================================
document.getElementById('restartBtn').onclick = () => {
    DOM.resultModal.classList.remove('show');
    initGame();
};

document.getElementById('historyBtn').onclick = () => {
    let history = [];
    try {
        const stored = localStorage.getItem('game_1to50_history');
        history = JSON.parse(stored);
        if (!Array.isArray(history)) history = [];
    } catch (e) {
        history = [];
    }

    DOM.historyList.innerHTML = history.length === 0 
        ? '<p style="color: #4a5568; text-align:center; padding: 20px;">目前尚無紀錄，趕快去玩一局吧！</p>'
        : history.map((item, i) => `
            <div style="display: flex; justify-content: space-between; padding: 10px 5px; border-bottom: 1px solid #edf2f7; font-size: 18px;">
                <span style="color: #4a5568;">第 ${history.length - i} 次 (${item.date || '未知'})</span>
                <strong style="color: #0f4c81;">${item.score} 秒</strong>
            </div>
        `).join('');
    DOM.historyModal.classList.add('show');
};

document.getElementById('closeHistoryBtn').onclick = () => DOM.historyModal.classList.remove('show');
window.onclick = (e) => { if (e.target === DOM.historyModal) DOM.historyModal.classList.remove('show'); };

window.addEventListener('DOMContentLoaded', () => {
    initGame();
    const ua = navigator.userAgent.toLowerCase();
    const isLine = ua.includes('line');
    const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;

    const pwaBtn = document.getElementById('pwaFixedBtn');
    const lineGuide = document.getElementById('lineGuideModal');
    const iosModal = document.getElementById('iosModalB');
    const androidBanner = document.getElementById('androidBanner');

    if (isLine) {
        if (!window.location.search.includes('openExternalBrowser=1')) {
            window.location.href += (window.location.href.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
            return;
        }
        lineGuide.classList.remove('hidden');
        document.getElementById('lineCloseBtn').onclick = () => lineGuide.classList.add('hidden');
        return; 
    }

    if (isIOS) {
        pwaBtn.classList.remove('hidden');
        pwaBtn.onclick = () => iosModal.classList.remove('hidden');
        document.getElementById('iosCloseBtn').onclick = () => iosModal.classList.add('hidden');
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        pwaBtn.classList.remove('hidden');
        androidBanner.classList.remove('hidden');
    });

    document.getElementById('androidInstallBtn').onclick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
            androidBanner.classList.add('hidden');
        }
    };

    document.getElementById('androidCloseBtn').onclick = () => androidBanner.classList.add('hidden');

    pwaBtn.onclick = () => {
        if (isIOS) iosModal.classList.remove('hidden');
        else if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
            androidBanner.classList.add('hidden');
        }
    };

    window.addEventListener('appinstalled', () => {
        pwaBtn.classList.add('hidden');
        androidBanner.classList.add('hidden');
        deferredPrompt = null;
    });

    // 🌟 串接全新的 Google Apps Script 雲端計數器
    if (!localStorage.getItem('game_visited_flag')) {
        localStorage.setItem('game_visited_flag', 'true');
        // 新玩家：增加遊玩次數與訪客數
        fetch(GAS_API_URL + '?new_user=1')
            .then(res => res.json())
            .then(updateCounters)
            .catch(err => console.error('後端連線失敗:', err));
    } else {
        // 老玩家：僅增加遊玩次數
        fetch(GAS_API_URL)
            .then(res => res.json())
            .then(updateCounters)
            .catch(err => console.error('後端連線失敗:', err));
    }
});

function updateCounters(data) {
    if (data && data.plays) document.getElementById('totalPlays').innerText = data.plays;
    if (data && data.visitors) document.getElementById('totalVisitors').innerText = data.visitors;
}
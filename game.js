// ==========================================
// 1. 遊戲核心變數與 DOM 宣告
// ==========================================
let currentTarget = 1;
let startTime = null;
let timerInterval = null;
let gameActive = false;
const TOTAL_CLICKS = 50;   // 所有難度固定點擊 50 次

// ==========================================
// 難度設定
// ==========================================
const MODES = {
    1: { step: 1, label: '標準 1~50',  shortLabel: '標準 1~50', key: 'game_1to50_history_x1' },
    2: { step: 2, label: '× 2 倍數',   shortLabel: '× 2 倍數',   key: 'game_1to50_history_x2' },
    5: { step: 5, label: '× 5 倍數',   shortLabel: '× 5 倍數',   key: 'game_1to50_history_x5' },
    7: { step: 7, label: '× 7 倍數',   shortLabel: '× 7 倍數',   key: 'game_1to50_history_x7' }
};
let currentMode = 1;   // 預設標準難度

// Google Apps Script 後端 API 網址 (計數與反饋)
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzFXNURbzrMozLkwZ5HlJDiTN9arH5Ihel2gGT2E4I7pjEzQ-RFmU3Cn8eE50LsCyXugQ/exec';

const DOM = {
    grid: document.getElementById('gameGrid'),
    timer: document.getElementById('timerDisplay'),
    hint: document.getElementById('hintDisplay'),
    hintNumber: document.getElementById('hintNumber'),
    currentModeLabel: document.getElementById('currentModeLabel'),
    resultModal: document.getElementById('resultModal'),
    finalScore: document.getElementById('finalScore'),
    praiseMsg: document.getElementById('praiseMessage'),
    rankMsg: document.getElementById('rankMessage'),
    historyModal: document.getElementById('historyModal'),
    historyList: document.getElementById('historyList'),
    historyModeLabel: document.getElementById('historyModeLabel'),
    difficultyModal: document.getElementById('difficultyModal'),
    difficultyBtn: document.getElementById('difficultyBtn')
};

// ==========================================
// 2. 基礎工具、排行邏輯與情緒價值
// ==========================================

// 輔助函式：數字轉國字
function convertToChinese(num) {
    const chinese = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return (num >= 0 && num <= 10) ? chinese[num] : num.toString();
}

// 取得當前難度的 localStorage key
function getHistoryKey() {
    return MODES[currentMode].key;
}

// 👑 雙軌排行演算法 (強固防禦版)
function calculateRankInHistory(currentScore, timestamp) {
    const currentSeconds = parseFloat(currentScore);
    let history = [];
    
    try {
        const stored = localStorage.getItem(getHistoryKey());
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

    let todayHtml = `<div style="background-color: rgba(56, 189, 248, 0.15); padding: 10px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #38bdf8; color: #e0f2fe;">`;
    if (todayRank === 1) {
        todayHtml += `🏆 <strong>本日戰績：</strong><br>太厲害了！守住今天的冠軍寶座！`;
    } else {
        const diffToFirst = (currentSeconds - todayBest).toFixed(2);
        todayHtml += `🏆 <strong>本日第${convertToChinese(todayRank)}名：</strong><br>只要再快 ${diffToFirst} 秒<br>就可以達到第一名！`;
    }
    todayHtml += `</div>`;

    // --- 軌道 2：歷史排行榜 ---
    allRecords.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
    
    let historyHtml = `<div style="background-color: rgba(74, 222, 128, 0.15); padding: 10px; border-radius: 10px; border: 1px solid #4ade80; color: #dcfce7;">`;
    
    const isNewRecord = (allRecords[0].timestamp === timestamp);
    const historyRank = allRecords.findIndex(item => item.timestamp === timestamp) + 1;

    if (isNewRecord) {
        const oldBest = allRecords.length > 1 ? allRecords[1].score : null;
        historyHtml += `📈 <strong>恭喜你刷新歷史紀錄 &lt;第一名&gt;</strong><br>`;
        historyHtml += oldBest ? `(之前最佳成績為 ${oldBest} 秒)` : `(這是你的首戰紀錄喔！)`;
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
    
    if (seconds < 60)  return "👑 好快！教教我！<br>你是怎麼練的呢?";
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

// 輔助：判斷當前難度是否需要套用較小的字體大小（5的倍數、7的倍數或數字>=100）
function shouldApplySmallFont(num) {
    const step = MODES[currentMode].step;
    if (step === 5 || step === 7) return true;
    return num >= 100;
}

// 輔助：設定提示數字
function setHintNumber(num) {
    DOM.hintNumber.innerText = num;
    if (shouldApplySmallFont(num)) {
        DOM.hintNumber.classList.add('three-digit');
    } else {
        DOM.hintNumber.classList.remove('three-digit');
    }
}

// 輔助：設定格子數字
function setCellNumber(cell, num) {
    cell.innerText = num;
    if (shouldApplySmallFont(num)) {
        cell.classList.add('three-digit');
    } else {
        cell.classList.remove('three-digit');
    }
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
        const stored = localStorage.getItem(getHistoryKey());
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
    localStorage.setItem(getHistoryKey(), JSON.stringify(history));
}

// ==========================================
// 3. 遊戲核心運行邏輯
// ==========================================
function initGame() {
    const step = MODES[currentMode].step;
    currentTarget = step * 1;
    gameActive = false;
    startTime = null;
    clearInterval(timerInterval);
    DOM.timer.innerText = "⏱️ 0.00 秒";
    setHintNumber(currentTarget);
    
    // 更新提示旁難度標籤
    if (DOM.currentModeLabel) {
        DOM.currentModeLabel.innerText = MODES[currentMode].shortLabel;
    }

    DOM.grid.innerHTML = '';

    // 第一輪：step*1 ~ step*25（共 25 格）
    const firstHalf = Array.from({ length: 25 }, (_, i) => step * (i + 1));
    shuffleArray(firstHalf);

    firstHalf.forEach(num => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.setAttribute('data-val', num);
        setCellNumber(cell, num);
        
        cell.addEventListener('pointerdown', () => {
            handleCellClick(cell);
        });
        
        DOM.grid.appendChild(cell);
    });

    updateDifficultyModal();
}

function handleCellClick(cell) {
    const currentVal = parseInt(cell.getAttribute('data-val'), 10);
    if (currentVal !== currentTarget) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        cell.classList.add('wrong');
        setTimeout(() => cell.classList.remove('wrong'), 300);
        return; 
    }
    
    const step = MODES[currentMode].step;
    if (navigator.vibrate) {
        if (currentTarget === step) {
            setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate(20);
            }, 150);
        } else {
            navigator.vibrate(20);
        }
    }
    
    if (currentTarget === step && !gameActive) {
        gameActive = true;
        startTime = performance.now();
        timerInterval = setInterval(updateTimer, 10);
    }
    
    // 第一輪（step*1 ~ step*25）→ 替換成第二輪（step*26 ~ step*50）
    if (currentVal <= step * 25) {
        const nextVal = currentVal + step * 25;
        cell.setAttribute('data-val', nextVal);
        setCellNumber(cell, nextVal);
    } else {
        // 第二輪點完 → 格子隱藏
        cell.innerText = '';
        cell.style.visibility = 'hidden';
    }
    
    currentTarget += step;
    
    if (currentTarget > step * TOTAL_CLICKS) {
        endGame();
    } else {
        setHintNumber(currentTarget);
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
// 4. 難度選擇彈窗邏輯
// ==========================================
function updateDifficultyModal() {
    Object.keys(MODES).forEach(step => {
        const el = document.getElementById(`diff-x${step}`);
        if (el) {
            if (parseInt(step) === currentMode) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    });
}

window.openDifficultyModal = function openDifficultyModal() {
    updateDifficultyModal();
    DOM.difficultyModal.classList.add('show');
};

window.closeDifficultyModal = function closeDifficultyModal() {
    DOM.difficultyModal.classList.remove('show');
};

// ==========================================
// 5. PWA 一鍵安裝機制 (頂端列「📲 安裝App」專用)
// ==========================================
window.deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
});

window.triggerPWAInstall = function triggerPWAInstall() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;

    // 1. 若瀏覽器已捕獲原生 PWA 安裝事件
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult && choiceResult.outcome === 'accepted') {
                document.documentElement.classList.add('is-pwa-standalone');
                const btnHeader = document.getElementById('btn-header-install');
                if (btnHeader) btnHeader.classList.add('hidden');
            }
            window.deferredPrompt = null;
        });
        return;
    }

    // 2. 若為 iOS 裝置 (Safari 分享引導)
    if (isIOS) {
        const iosModal = document.getElementById('iosInstallModal');
        if (iosModal) iosModal.classList.remove('hidden');
        return;
    }

    // 3. Android / Chrome 備援引導
    const androidModal = document.getElementById('androidInstallGuideModal');
    if (androidModal) {
        androidModal.classList.remove('hidden');
    } else {
        alert('📲 請點擊瀏覽器右上角「⋮」➜ 選擇「安裝應用程式」或「加到主畫面」即可安裝到桌面！');
    }
};

window.addEventListener('appinstalled', () => {
    document.documentElement.classList.add('is-pwa-standalone');
    const btnHeader = document.getElementById('btn-header-install');
    if (btnHeader) btnHeader.classList.add('hidden');
    window.deferredPrompt = null;
});

// ==========================================
// 6. 系統設計與開發建議反饋彈窗 (Feedback Modal)
// ==========================================
window.openFeedbackModal = function openFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeFeedbackModal = function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.add('hidden');
};

window.submitFeedback = function submitFeedback() {
    const name = (document.getElementById('feedback-input-name').value || '').trim();
    const phone = (document.getElementById('feedback-input-phone').value || '').trim();
    const content = (document.getElementById('feedback-input-content').value || '').trim();

    if (!content) {
        alert('請先填寫您的寶貴建議事項喔！謝謝您！');
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-feedback');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = '✉️ 正在送出中...';
    }

    try {
        const feedbackList = JSON.parse(localStorage.getItem('game_user_feedbacks') || '[]');
        feedbackList.push({
            name: name || '熱心玩家',
            phone: phone || '未提供',
            content: content,
            time: new Date().toLocaleString('zh-TW')
        });
        localStorage.setItem('game_user_feedbacks', JSON.stringify(feedbackList));

        // 發送通知到後端
        if (GAS_API_URL) {
            const feedbackUrl = GAS_API_URL + (GAS_API_URL.includes('?') ? '&' : '?') 
                + 'action=feedback'
                + '&name=' + encodeURIComponent(name || '熱心玩家')
                + '&phone=' + encodeURIComponent(phone || '未提供')
                + '&content=' + encodeURIComponent(content);
            
            fetch(feedbackUrl, { mode: 'no-cors' }).catch(() => {});
        }
    } catch(e) {}

    setTimeout(() => {
        alert('感謝您的寶貴建議！陳新昱已收到您的回饋，將持續優化遊戲體驗！');
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = '✉️ 送出建議';
        }
        document.getElementById('feedback-input-content').value = '';
        closeFeedbackModal();
    }, 600);
};

// ==========================================
// 7. 事件綁定與初始化
// ==========================================
document.getElementById('restartBtn').onclick = () => {
    DOM.resultModal.classList.remove('show');
    initGame();
};

// 點擊難度選項：切換並重開局
Object.keys(MODES).forEach(step => {
    const el = document.getElementById(`diff-x${step}`);
    if (el) {
        el.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            currentMode = parseInt(step);
            closeDifficultyModal();
            initGame();
        });
    }
});

// 點擊彈窗背景關閉
DOM.difficultyModal.addEventListener('pointerdown', (e) => {
    if (e.target === DOM.difficultyModal) closeDifficultyModal();
});

// 歷史戰績
document.getElementById('historyBtn').onclick = () => {
    let history = [];
    try {
        const stored = localStorage.getItem(getHistoryKey());
        history = JSON.parse(stored);
        if (!Array.isArray(history)) history = [];
    } catch (e) {
        history = [];
    }

    DOM.historyModeLabel.textContent = `【${MODES[currentMode].label}】保留近 90 天的最佳紀錄`;

    DOM.historyList.innerHTML = history.length === 0 
        ? '<p style="color: #94a3b8; text-align:center; padding: 20px; font-size: 16px;">目前尚無紀錄，趕快去挑戰一局吧！</p>'
        : history.map((item, i) => `
            <div style="display: flex; justify-content: space-between; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 16px;">
                <span style="color: #cbd5e1;">第 ${history.length - i} 次 (${item.date || '未知'})</span>
                <strong style="color: #ffcc02;">${item.score} 秒</strong>
            </div>
        `).join('');
    DOM.historyModal.classList.add('show');
};

document.getElementById('closeHistoryBtn').onclick = () => DOM.historyModal.classList.remove('show');
window.addEventListener('pointerdown', (e) => {
    if (e.target === DOM.historyModal) DOM.historyModal.classList.remove('show');
    if (e.target === DOM.resultModal) DOM.resultModal.classList.remove('show');
    const fbModal = document.getElementById('feedbackModal');
    if (e.target === fbModal) closeFeedbackModal();
    const androidModal = document.getElementById('androidInstallGuideModal');
    if (e.target === androidModal) androidModal.classList.add('hidden');
    const iosModal = document.getElementById('iosInstallModal');
    if (e.target === iosModal) iosModal.classList.add('hidden');
});

// 頁面載入生命週期
window.addEventListener('DOMContentLoaded', () => {
    initGame();

    const ua = (navigator.userAgent || '').toLowerCase();
    const isLine = ua.includes('line');
    const lineGuide = document.getElementById('lineGuideModal');

    if (isLine) {
        if (!window.location.search.includes('openExternalBrowser=1')) {
            window.location.href += (window.location.href.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
            return;
        }
        if (lineGuide) lineGuide.classList.remove('hidden');
    }

    // 串接 Google Apps Script 雲端計數器
    if (!localStorage.getItem('game_1to50_visited_flag')) {
        localStorage.setItem('game_1to50_visited_flag', 'true');
        fetch(GAS_API_URL + '?new_user=1')
            .then(res => res.json())
            .then(updateCounters)
            .catch(err => console.error('後端計數連線失敗:', err));
    } else {
        fetch(GAS_API_URL)
            .then(res => res.json())
            .then(updateCounters)
            .catch(err => console.error('後端計數連線失敗:', err));
    }
});

function updateCounters(data) {
    if (data && data.plays) {
        const el = document.getElementById('totalPlays');
        if (el) el.innerText = data.plays;
    }
    if (data && data.visitors) {
        const el = document.getElementById('totalVisitors');
        if (el) el.innerText = data.visitors;
    }
}
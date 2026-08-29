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
    
    DOM.resultModal.classList.remove('hidden');
    saveScoreToLocal(finalTime, nowTimestamp);

    // 長輩機自動雲端同步 (爸爸/媽媽遊玩紀錄回報)
    reportElderPlayToCloud(finalTime, MODES[currentMode].label);
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
    const modal = document.getElementById('difficultyModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeDifficultyModal = function closeDifficultyModal() {
    const modal = document.getElementById('difficultyModal');
    if (modal) modal.classList.add('hidden');
};

// ==========================================
// 5. PWA 一鍵安裝機制 (頂端列「📲 安裝App」專用)
// ==========================================
window.deferredPrompt = null;

// PWA 狀態檢查與安裝按鈕隱藏
function updatePWAInstallVisibility() {
    const isPWA = (window.matchMedia && (
                    window.matchMedia('(display-mode: standalone)').matches ||
                    window.matchMedia('(display-mode: fullscreen)').matches ||
                    window.matchMedia('(display-mode: minimal-ui)').matches
                )) ||
                window.navigator.standalone === true ||
                window.location.search.indexOf('source=pwa') !== -1 ||
                (document.referrer && document.referrer.indexOf('android-app://') === 0) ||
                localStorage.getItem('1to50_pwa_installed') === 'true';

    const btnHeader = document.getElementById('btn-header-install');
    if (isPWA) {
        document.documentElement.classList.add('is-pwa-standalone');
        if (btnHeader) btnHeader.classList.add('hidden');
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    // 若瀏覽器觸發了可安裝提示且當前非獨立 App，可重置安裝狀態
    if (!window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone) {
        localStorage.removeItem('1to50_pwa_installed');
        document.documentElement.classList.remove('is-pwa-standalone');
        const btnHeader = document.getElementById('btn-header-install');
        if (btnHeader) btnHeader.classList.remove('hidden');
    }
});

window.triggerPWAInstall = function triggerPWAInstall() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;

    // 1. 若瀏覽器已捕獲原生 PWA 安裝事件
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult && choiceResult.outcome === 'accepted') {
                localStorage.setItem('1to50_pwa_installed', 'true');
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
    localStorage.setItem('1to50_pwa_installed', 'true');
    document.documentElement.classList.add('is-pwa-standalone');
    const btnHeader = document.getElementById('btn-header-install');
    if (btnHeader) btnHeader.classList.add('hidden');
    window.deferredPrompt = null;
});

// 初始化即刻檢測
updatePWAInstallVisibility();
window.addEventListener('DOMContentLoaded', updatePWAInstallVisibility);

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
// 7. 歷史戰績與結算事件綁定
// ==========================================
window.restartGame = function restartGame() {
    const modal = document.getElementById('resultModal');
    if (modal) modal.classList.add('hidden');
    initGame();
};

window.openHistoryModal = function openHistoryModal() {
    let history = [];
    try {
        const stored = localStorage.getItem(getHistoryKey());
        history = JSON.parse(stored);
        if (!Array.isArray(history)) history = [];
    } catch (e) {
        history = [];
    }

    if (DOM.historyModeLabel) {
        DOM.historyModeLabel.textContent = `【${MODES[currentMode].label}】保留近 90 天的最佳紀錄`;
    }

    if (DOM.historyList) {
        DOM.historyList.innerHTML = history.length === 0 
            ? '<p style="color: #94a3b8; text-align:center; padding: 20px; font-size: 16px;">目前尚無紀錄，趕快去挑戰一局吧！</p>'
            : history.map((item, i) => `
                <div style="display: flex; justify-content: space-between; padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 16px;">
                    <span style="color: #cbd5e1;">第 ${history.length - i} 次 (${item.date || '未知'})</span>
                    <strong style="color: #ffcc02;">${item.score} 秒</strong>
                </div>
            `).join('');
    }
    const modal = document.getElementById('historyModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeHistoryModal = function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.classList.add('hidden');
};

// 點擊難度選項：切換並重開局
Object.keys(MODES).forEach(step => {
    const el = document.getElementById(`diff-x${step}`);
    if (el) {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            currentMode = parseInt(step);
            closeDifficultyModal();
            initGame();
        });
    }
});

// 歷史按鈕綁定
const btnHistory = document.getElementById('historyBtn');
if (btnHistory) {
    btnHistory.onclick = () => openHistoryModal();
}

// 點擊遮罩背景自動關閉彈窗
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
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

// ==========================================
// 8. 家庭守護與長輩動態模組 (Family Guardian Module v6.10)
// ==========================================
const FAMILY_STORAGE_KEY = '1to50_family_config';
let isSimulationMode = false; // 是否處於測試模擬模式

// 取得家庭設定
function getFamilyConfig() {
    try {
        const data = localStorage.getItem(FAMILY_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

// 儲存家庭設定
window.saveFamilyConfig = function saveFamilyConfig() {
    const emailInput = document.getElementById('familyInputEmail');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    
    const roleRadio = document.querySelector('input[name="familyRole"]:checked');
    const role = roleRadio ? roleRadio.value : '';

    if (!email || !email.includes('@')) {
        alert('請輸入正確的 Gmail 信箱格式！');
        if (emailInput) emailInput.focus();
        return;
    }

    if (!role) {
        alert('請選擇這台手機的使用者角色（爸爸 / 媽媽 / 晚輩）！');
        return;
    }

    const config = {
        email: email,
        role: role,
        name: role === 'father' ? '爸爸' : (role === 'mother' ? '媽媽' : '晚輩'),
        updatedAt: Date.now()
    };

    localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(config));
    alert(`🎉 綁定成功！\n身分：${config.name}\n信箱：${config.email}`);
    
    renderFamilyView();
};

// 取消修改並返回原本視圖
window.cancelFamilyForm = function cancelFamilyForm() {
    renderFamilyView();
};

// 顯示修改表單
window.showFamilyConfigForm = function showFamilyConfigForm() {
    const config = getFamilyConfig();
    const formView = document.getElementById('familyFormView');
    const elderView = document.getElementById('familyElderView');
    const dashView = document.getElementById('familyDashboardView');
    const btnCancel = document.getElementById('btnCancelFamilyForm');

    if (formView) formView.classList.remove('hidden');
    if (elderView) elderView.classList.add('hidden');
    if (dashView) dashView.classList.add('hidden');

    if (config) {
        const emailInput = document.getElementById('familyInputEmail');
        if (emailInput) emailInput.value = config.email || '';
        
        const radio = document.querySelector(`input[name="familyRole"][value="${config.role}"]`);
        if (radio) radio.checked = true;
        
        if (btnCancel) btnCancel.classList.remove('hidden');
    } else {
        if (btnCancel) btnCancel.classList.add('hidden');
    }
};

// 分頁切換 (難度設定 vs 家庭守護)
window.switchSettingsTab = function switchSettingsTab(tab) {
    const tabBtnDiff = document.getElementById('tab-btn-diff');
    const tabBtnFamily = document.getElementById('tab-btn-family');
    const panelDiff = document.getElementById('tab-content-diff');
    const panelFamily = document.getElementById('tab-content-family');

    if (tab === 'diff') {
        if (tabBtnDiff) tabBtnDiff.classList.add('active');
        if (tabBtnFamily) tabBtnFamily.classList.remove('active');
        if (panelDiff) panelDiff.classList.remove('hidden');
        if (panelFamily) panelFamily.classList.add('hidden');
    } else {
        if (tabBtnDiff) tabBtnDiff.classList.remove('active');
        if (tabBtnFamily) tabBtnFamily.classList.add('active');
        if (panelDiff) panelDiff.classList.add('hidden');
        if (panelFamily) panelFamily.classList.remove('hidden');
        renderFamilyView();
    }
};

// 依據設定渲染家庭守護介面視圖
function renderFamilyView() {
    const config = getFamilyConfig();
    const formView = document.getElementById('familyFormView');
    const elderView = document.getElementById('familyElderView');
    const dashView = document.getElementById('familyDashboardView');

    if (!formView || !elderView || !dashView) return;

    if (!config) {
        // 未綁定：顯示設定表單
        formView.classList.remove('hidden');
        elderView.classList.add('hidden');
        dashView.classList.add('hidden');
        const btnCancel = document.getElementById('btnCancelFamilyForm');
        if (btnCancel) btnCancel.classList.add('hidden');
    } else if (config.role === 'father' || config.role === 'mother') {
        // 長輩機：顯示綁定狀態卡片
        formView.classList.add('hidden');
        elderView.classList.remove('hidden');
        dashView.classList.add('hidden');

        const avatarIcon = document.getElementById('elderAvatarIcon');
        const roleTitle = document.getElementById('elderRoleTitle');
        const boundEmail = document.getElementById('elderBoundEmail');

        if (avatarIcon) avatarIcon.innerText = config.role === 'father' ? '👨' : '👩';
        if (roleTitle) roleTitle.innerText = `${config.name}的手機 (訓練模式)`;
        if (boundEmail) boundEmail.innerText = config.email;
    } else {
        // 晚輩機：顯示守護儀表板
        formView.classList.add('hidden');
        elderView.classList.add('hidden');
        dashView.classList.remove('hidden');

        const dashEmail = document.getElementById('dashFamilyEmail');
        if (dashEmail) dashEmail.innerText = config.email;

        fetchFamilyStatus(false);
    }
}

// 晚輩拉取長輩今日動態 (GAS API 或模擬資料)
window.fetchFamilyStatus = function fetchFamilyStatus(isManual) {
    const container = document.getElementById('eldersCardsContainer');
    if (!container) return;

    const config = getFamilyConfig();
    if (!config) return;

    if (isManual) {
        container.innerHTML = '<div class="family-loading">正在同步最新動態... ⏳</div>';
    }

    if (isSimulationMode) {
        // 測試模擬情境
        setTimeout(() => {
            const mockData = {
                status: 'success',
                elders: [
                    { role: 'mother', name: '媽媽', todayPlays: 3, bestScore: 46.85, lastPlayTime: '今天 14:20', streakDays: 5 },
                    { role: 'father', name: '爸爸', todayPlays: 0, bestScore: null, lastPlayTime: '昨天 19:10', streakDays: 0 }
                ]
            };
            renderEldersCards(mockData.elders);
        }, 300);
        return;
    }

    // 發送雲端 API 查詢
    const apiUrl = `${GAS_API_URL}?action=get_family_status&email=${encodeURIComponent(config.email)}&t=${Date.now()}`;
    
    fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
            if (data && data.status === 'success' && Array.isArray(data.elders)) {
                renderEldersCards(data.elders);
            } else {
                container.innerHTML = `<div class="family-loading" style="color:#f87171;">⚠️ 尚無長輩遊玩數據或連線異常</div>`;
            }
        })
        .catch(err => {
            console.error('長輩動態查詢失敗:', err);
            // 容錯降級：提供預設空狀態與手動模擬提示
            renderEldersCards([
                { role: 'father', name: '爸爸', todayPlays: 0, bestScore: null, lastPlayTime: '尚無紀錄', streakDays: 0 },
                { role: 'mother', name: '媽媽', todayPlays: 0, bestScore: null, lastPlayTime: '尚無紀錄', streakDays: 0 }
            ]);
        });
};

// 渲染爸爸與媽媽的動態卡片
function renderEldersCards(elders) {
    const container = document.getElementById('eldersCardsContainer');
    if (!container) return;

    if (!elders || elders.length === 0) {
        container.innerHTML = `<div class="family-loading">尚未有長輩遊玩數據</div>`;
        return;
    }

    let html = '';
    elders.forEach(elder => {
        const isFather = elder.role === 'father';
        const emoji = isFather ? '👨' : '👩';
        const playedToday = elder.todayPlays > 0;
        const cardClass = playedToday ? 'elder-dash-card card-active' : 'elder-dash-card card-warning';
        
        const badgeHtml = playedToday
            ? `<span class="elder-status-badge badge-success">🟢 今日已動腦 (${elder.todayPlays}次)</span>`
            : `<span class="elder-status-badge badge-warning">🔴 今日尚未遊玩</span>`;

        // 安全格式化時間為「2026/08/29 (六) 23:24」
        let lastPlayStr = '尚無紀錄';
        if (elder.lastPlayTime && elder.lastPlayTime !== '尚無紀錄') {
            const raw = elder.lastPlayTime.toString();
            // 如果已經是中文字串格式 (2026/08/29 (六) 23:24) 直接使用
            if (raw.includes('(') && raw.includes(')')) {
                lastPlayStr = raw;
            } else {
                const parsed = new Date(raw);
                if (!isNaN(parsed.getTime())) {
                    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                    const yyyy = parsed.getFullYear();
                    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                    const dd = String(parsed.getDate()).padStart(2, '0');
                    const w = weekdays[parsed.getDay()];
                    const hh = String(parsed.getHours()).padStart(2, '0');
                    const min = String(parsed.getMinutes()).padStart(2, '0');
                    lastPlayStr = `${yyyy}/${mm}/${dd} (${w}) ${hh}:${min}`;
                } else {
                    lastPlayStr = raw;
                }
            }
        }
        const streakStr = elder.streakDays > 0 ? `連續 ${elder.streakDays} 天 🔥` : '今日待開局';

        html += `
            <div class="${cardClass}">
                <div class="elder-card-header">
                    <div class="elder-name-group">
                        <span class="elder-name-emoji">${emoji}</span>
                        <span class="elder-name-text">${elder.name}</span>
                    </div>
                    ${badgeHtml}
                </div>

                <div class="elder-stats-grid">
                    <div class="stat-box-item">
                        <div>今日最佳成績</div>
                        <div class="stat-box-val highlight">${bestScoreStr}</div>
                    </div>
                    <div class="stat-box-item">
                        <div>連續挑戰天數</div>
                        <div class="stat-box-val">${streakStr}</div>
                    </div>
                    <div class="stat-box-item" style="grid-column: span 2;">
                        <div>最後挑戰時間：<strong style="color:#e2e8f0;">${lastPlayStr}</strong></div>
                    </div>
                </div>

                <div class="elder-card-actions">
                    <button type="button" class="btn-line-care" onclick="sendLineCare('${elder.role}', '${elder.name}', ${elder.todayPlays}, '${bestScoreStr}')">
                        <span>💬 LINE 關心${elder.name}</span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 測試模擬資料切換開關
window.toggleTestSimulation = function toggleTestSimulation() {
    isSimulationMode = !isSimulationMode;
    alert(isSimulationMode ? '🧪 已開啟【測試模擬模式】：目前展示模擬爸爸/媽媽數據！' : '🟢 已切換回【雲端即時連線模式】！');
    fetchFamilyStatus(true);
};

// 一鍵生成 LINE 貼心問候並開啟分享
window.sendLineCare = function sendLineCare(role, name, todayPlays, bestScore) {
    let message = '';
    if (todayPlays > 0) {
        message = `${name}～我看到您今天已經玩了 ${todayPlays} 次 1~50 健腦遊戲，最佳成績 ${bestScore}，太厲害了！繼續保持天天動動腦喔！❤️`;
    } else {
        message = `${name}～今天還沒玩 1~50 延緩失智動動腦遊戲喔！有空時記得打開玩個 2 局，活化大腦放鬆一下～🌟 遊戲網址：https://pod0987183520.github.io/1to50/`;
    }

    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
    
    // 若在支援 Web Share API 的手機上優先開啟分享
    if (navigator.share) {
        navigator.share({
            title: `關心${name}健腦動態`,
            text: message
        }).catch(() => {
            window.open(lineUrl, '_blank');
        });
    } else {
        window.open(lineUrl, '_blank');
    }
};

// 長輩完成遊戲時，背景自動同步給 GAS 雲端
function reportElderPlayToCloud(score, modeLabel) {
    const config = getFamilyConfig();
    if (!config || (config.role !== 'father' && config.role !== 'mother')) {
        return; // 非長輩機或未綁定，不需回報
    }

    const payload = {
        action: 'report_play',
        email: config.email,
        role: config.role,
        name: config.name,
        score: score,
        mode: modeLabel,
        timestamp: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
    };

    const query = Object.keys(payload)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(payload[k])}`)
        .join('&');

    // 背景靜默送出，不干擾長輩遊戲體驗
    fetch(`${GAS_API_URL}?${query}`, { mode: 'no-cors' })
        .then(() => console.log('長輩遊玩數據已同步至雲端'))
        .catch(err => console.error('長輩數據同步失敗:', err));
}
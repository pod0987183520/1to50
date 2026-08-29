/**
 * 1~50 遊戲 - Google Apps Script (GAS) 雲端後端程式碼
 * 
 * 包含功能：
 * 1. 【長輩家庭守護】接收爸爸/媽媽遊玩數據 (action: report_play)
 * 2. 【晚輩守護儀表板】查詢指定 Email 家庭的長輩今日遊玩狀態 (action: get_family_status)
 * 3. 【網站計數器】累積遊玩次數與玩家總數 (action: count / new_user)
 * 4. 【建議反饋】接收使用者提交的心得建議 (action: feedback)
 * 
 * 部署步驟：
 * 1. 建立一個新的 Google Sheet (Google 試算表)
 * 2. 點擊頂端選單「擴充功能」 -> 「Apps Script」
 * 3. 將本檔案內容完整貼入 Code.gs 中
 * 4. 點擊右上角「部署」 -> 「新增部署」 -> 齒輪選擇「網頁應用程式」
 * 5. 設定：
 *    - 執行身分：我 (您的帳號)
 *    - 誰可以存取：所有人 (Anyone)
 * 6. 點擊部署，複製取得的「網頁應用程式網址 (Web App URL)」，貼回 game.js 中的 GAS_API_URL 即可！
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || '';

    // ==========================================
    // 1. 長輩遊玩數據回報 (action: report_play)
    // ==========================================
    if (action === 'report_play') {
      var email = (params.email || '').trim().toLowerCase();
      var role = (params.role || '').trim(); // 'father' 或 'mother'
      var name = (params.name || '').trim(); // '爸爸' 或 '媽媽'
      var score = parseFloat(params.score || 0);
      var mode = params.mode || '標準模式';
      var timeStr = params.timestamp || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
      var dateStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");

      if (!email || !role) {
        return createJsonResponse({ status: 'error', message: '缺少 Email 或角色資訊' });
      }

      var sheetName = "長輩遊玩紀錄";
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["紀錄時間", "家庭Email", "角色", "稱呼", "今日日期", "成績(秒)", "難度模式"]);
      }

      sheet.appendRow([timeStr, email, role, name, dateStr, score, mode]);

      return createJsonResponse({ status: 'success', message: '長輩紀錄已成功同步！' });
    }

    // ==========================================
    // 2. 晚輩守護查詢 (action: get_family_status)
    // ==========================================
    if (action === 'get_family_status') {
      var searchEmail = (params.email || '').trim().toLowerCase();
      if (!searchEmail) {
        return createJsonResponse({ status: 'error', message: '請提供家庭 Email' });
      }

      var sheet = ss.getSheetByName("長輩遊玩紀錄");
      var todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
      
      var eldersData = {
        father: { role: 'father', name: '爸爸', todayPlays: 0, bestScore: null, lastPlayTime: null, streakDays: 0, historyDates: {} },
        mother: { role: 'mother', name: '媽媽', todayPlays: 0, bestScore: null, lastPlayTime: null, streakDays: 0, historyDates: {} }
      };

      if (sheet) {
        var data = sheet.getDataRange().getValues();
        // 欄位: 0:時間, 1:Email, 2:角色, 3:稱呼, 4:日期, 5:成績, 6:難度
        for (var i = 1; i < data.length; i++) {
          var rowEmail = (data[i][1] || '').toString().trim().toLowerCase();
          var rowRole = (data[i][2] || '').toString().trim();
          var rowTime = (data[i][0] || '').toString().trim();
          var rowDate = (data[i][4] || '').toString().trim();
          var rowScore = parseFloat(data[i][5] || 0);

          if (rowEmail === searchEmail && (rowRole === 'father' || rowRole === 'mother')) {
            var elder = eldersData[rowRole];
            if (rowDate === todayStr) {
              elder.todayPlays += 1;
              if (elder.bestScore === null || (rowScore > 0 && rowScore < elder.bestScore)) {
                elder.bestScore = rowScore;
              }
              elder.lastPlayTime = rowTime;
            } else if (!elder.lastPlayTime) {
              elder.lastPlayTime = rowTime;
            }
            elder.historyDates[rowDate] = true;
          }
        }
      }

      // 計算連續動腦天數 (Streak)
      ['father', 'mother'].forEach(function(r) {
        var elder = eldersData[r];
        var streak = 0;
        var checkDate = new Date();
        var todayPlayed = elder.todayPlays > 0;
        if (!todayPlayed) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
        for (var d = 0; d < 60; d++) {
          var dStr = Utilities.formatDate(checkDate, "Asia/Taipei", "yyyy-MM-dd");
          if (elder.historyDates[dStr]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
        elder.streakDays = streak;
        delete elder.historyDates;
      });

      return createJsonResponse({
        status: 'success',
        familyEmail: searchEmail,
        today: todayStr,
        elders: [eldersData.father, eldersData.mother]
      });
    }

    // ==========================================
    // 3. 建議反饋 (action: feedback)
    // ==========================================
    if (action === 'feedback') {
      var name = params.name || '匿名';
      var phone = params.phone || '';
      var content = params.content || '';
      var time = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");

      var sheetFeedback = ss.getSheetByName("建議反饋");
      if (!sheetFeedback) {
        sheetFeedback = ss.insertSheet("建議反饋");
        sheetFeedback.appendRow(["提交時間", "姓名", "電話", "建議內容"]);
      }
      sheetFeedback.appendRow([time, name, phone, content]);
      return createJsonResponse({ status: 'success', message: '感謝您的寶貴建議！' });
    }

    // ==========================================
    // 4. 預設訪客與遊玩次數統計
    // ==========================================
    var countSheet = ss.getSheetByName("統計數據");
    if (!countSheet) {
      countSheet = ss.insertSheet("統計數據");
      countSheet.appendRow(["項目", "數值"]);
      countSheet.appendRow(["遊玩總次數", 0]);
      countSheet.appendRow(["玩家總人數", 0]);
    }
    
    var totalPlays = countSheet.getRange(2, 2).getValue() || 0;
    var totalVisitors = countSheet.getRange(3, 2).getValue() || 0;

    if (params.new_user === '1') {
      totalVisitors += 1;
      countSheet.getRange(3, 2).setValue(totalVisitors);
    } else {
      totalPlays += 1;
      countSheet.getRange(2, 2).setValue(totalPlays);
    }

    return createJsonResponse({
      status: 'success',
      totalPlays: totalPlays,
      totalVisitors: totalVisitors
    });

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

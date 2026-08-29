/**
 * 1~50 遊戲 - Google Apps Script (GAS) 雲端後端程式碼 (v7.04 正式防重版)
 * 
 * 包含功能：
 * 1. 【長輩家庭守護】接收爸爸/媽媽遊玩數據 (action: report_play，內建 45 秒防重複寫入)
 * 2. 【晚輩守護儀表板】查詢指定 Email 家庭的長輩今日遊玩狀態 (action: get_family_status)
 * 3. 【網站計數器】累積遊玩次數與玩家總數 (防 #NUM! 純數字計算)
 * 4. 【建議反饋】接收使用者提交的心得建議 (action: feedback)
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';
  var callback = params.callback || '';

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 輔助：安全將日期轉為 yyyy-MM-dd
    function normalizeDateStr(val) {
      if (!val) return '';
      if (val instanceof Date) {
        return Utilities.formatDate(val, "Asia/Taipei", "yyyy-MM-dd");
      }
      var s = val.toString().trim();
      var parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return Utilities.formatDate(parsed, "Asia/Taipei", "yyyy-MM-dd");
      }
      return s.substring(0, 10);
    }

    // 輔助：安全將時間轉為「2026/08/29 (六) 23:24」
    function formatFriendlyTime(val) {
      if (!val) return '尚無紀錄';
      var d = (val instanceof Date) ? val : new Date(val.toString().trim());
      if (isNaN(d.getTime())) return val.toString();

      var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      var yyyy = Utilities.formatDate(d, "Asia/Taipei", "yyyy");
      var mm = Utilities.formatDate(d, "Asia/Taipei", "MM");
      var dd = Utilities.formatDate(d, "Asia/Taipei", "dd");
      var w = weekdays[parseInt(Utilities.formatDate(d, "Asia/Taipei", "u"), 10) % 7];
      var hhmm = Utilities.formatDate(d, "Asia/Taipei", "HH:mm");

      return yyyy + "/" + mm + "/" + dd + " (" + w + ") " + hhmm;
    }

    // ==========================================
    // 1. 長輩遊玩數據回報 (action: report_play - 內建嚴格防重複)
    // ==========================================
    if (action === 'report_play') {
      var email = (params.email || '').trim().toLowerCase();
      var role = (params.role || '').trim();
      var name = (params.name || '').trim();
      var score = parseFloat(params.score || 0);
      var mode = params.mode || '標準模式';
      var nowDate = new Date();
      var timeStr = Utilities.formatDate(nowDate, "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
      var dateStr = Utilities.formatDate(nowDate, "Asia/Taipei", "yyyy-MM-dd");

      if (!email || !role) {
        return createJsonResponse({ status: 'error', message: '缺少 Email 或角色資訊' }, callback);
      }

      var sheet = ss.getSheetByName("長輩遊玩紀錄") || ss.getSheetByName("晚輩遊玩紀錄") || ss.getSheetByName("遊玩紀錄");
      if (!sheet) {
        sheet = ss.insertSheet("長輩遊玩紀錄");
        sheet.appendRow(["紀錄時間", "家庭Email", "角色", "稱呼", "今日日期", "成績(秒)", "難度模式"]);
      }

      // 檢查最後一列是否完全相同 (45秒內重複上傳防禦)
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var lastValues = sheet.getRange(lastRow, 1, 1, 7).getValues()[0];
        var lastEmail = (lastValues[1] || '').toString().trim().toLowerCase();
        var lastRole = (lastValues[2] || '').toString().trim();
        var lastScore = parseFloat(lastValues[5] || 0);
        var lastTime = new Date(lastValues[0]);

        var isTimeClose = !isNaN(lastTime.getTime()) && (nowDate.getTime() - lastTime.getTime() < 45000);
        if (lastEmail === email && lastRole === role && lastScore === score && isTimeClose) {
          return createJsonResponse({ status: 'success', message: '已存在相同紀錄 (防重複略過)' }, callback);
        }
      }

      sheet.appendRow([timeStr, email, role, name, dateStr, score, mode]);
      return createJsonResponse({ status: 'success', message: '長輩紀錄已成功同步！' }, callback);
    }

    // ==========================================
    // 2. 晚輩守護查詢 (action: get_family_status)
    // ==========================================
    if (action === 'get_family_status') {
      var searchEmail = (params.email || '').trim().toLowerCase();
      var sheet = ss.getSheetByName("長輩遊玩紀錄") || ss.getSheetByName("晚輩遊玩紀錄") || ss.getSheetByName("遊玩紀錄");
      var todayStr = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
      
      var eldersData = {
        father: { role: 'father', name: '爸爸', todayPlays: 0, bestScore: null, lastPlayTime: null, streakDays: 0, historyDates: {} },
        mother: { role: 'mother', name: '媽媽', todayPlays: 0, bestScore: null, lastPlayTime: null, streakDays: 0, historyDates: {} }
      };

      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          var rowEmail = (data[i][1] || '').toString().trim().toLowerCase();
          var rowRole = (data[i][2] || '').toString().trim();
          var rawTime = data[i][0];
          var rawDate = data[i][4];
          var rowDate = normalizeDateStr(rawDate);
          var rowScore = parseFloat(data[i][5] || 0);

          if (rowEmail === searchEmail && (rowRole === 'father' || rowRole === 'mother')) {
            var elder = eldersData[rowRole];
            var friendlyTime = formatFriendlyTime(rawTime);

            if (rowDate === todayStr) {
              elder.todayPlays += 1;
              if (elder.bestScore === null || (rowScore > 0 && rowScore < elder.bestScore)) {
                elder.bestScore = rowScore;
              }
              elder.lastPlayTime = friendlyTime;
            } else if (!elder.lastPlayTime) {
              elder.lastPlayTime = friendlyTime;
            }
            if (rowDate) {
              elder.historyDates[rowDate] = true;
            }
          }
        }
      }

      // 計算連續動腦天數
      ['father', 'mother'].forEach(function(r) {
        var elder = eldersData[r];
        var streak = 0;
        var checkDate = new Date();
        var todayPlayed = elder.todayPlays > 0;
        if (!todayPlayed) checkDate.setDate(checkDate.getDate() - 1);

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
      }, callback);
    }

    // ==========================================
    // 3. 建議反饋 (action: feedback)
    // ==========================================
    if (action === 'feedback') {
      var name = params.name || '匿名';
      var phone = params.phone || '';
      var content = params.content || '';
      var time = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");

      var sheetFeedback = ss.getSheetByName("建議反饋") || ss.insertSheet("建議反饋");
      if (sheetFeedback.getLastRow() === 0) {
        sheetFeedback.appendRow(["提交時間", "姓名", "電話", "建議內容"]);
      }
      sheetFeedback.appendRow([time, name, phone, content]);
      return createJsonResponse({ status: 'success', message: '感謝您的寶貴建議！' }, callback);
    }

    // ==========================================
    // 4. 預設訪客與遊玩次數統計 (防 #NUM! 純數字讀寫)
    // ==========================================
    var countSheet = ss.getSheetByName("數據統計") || ss.getSheetByName("統計數據") || ss.getSheetByName("工作表1") || ss.getSheets()[0];
    
    var totalPlays = 0;
    var totalVisitors = 0;

    if (countSheet) {
      var rawPlays = countSheet.getRange(2, 2).getValue();
      var rawVisitors = countSheet.getRange(3, 2).getValue();

      totalPlays = (typeof rawPlays === 'number' && !isNaN(rawPlays)) ? Math.round(rawPlays) : parseInt(rawPlays || 0, 10);
      totalVisitors = (typeof rawVisitors === 'number' && !isNaN(rawVisitors)) ? Math.round(rawVisitors) : parseInt(rawVisitors || 0, 10);

      if (isNaN(totalPlays) || totalPlays === 0) totalPlays = 950;
      if (isNaN(totalVisitors) || totalVisitors === 0) totalVisitors = 160;

      if (params.new_user === '1') {
        totalVisitors += 1;
        countSheet.getRange(3, 2).setValue(Number(totalVisitors));
      } else {
        totalPlays += 1;
        countSheet.getRange(2, 2).setValue(Number(totalPlays));
      }
    }

    return createJsonResponse({
      status: 'success',
      totalPlays: totalPlays,
      totalVisitors: totalVisitors,
      plays: totalPlays,
      visitors: totalVisitors
    }, callback);

  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() }, callback);
  }
}

function createJsonResponse(data, callback) {
  var jsonStr = JSON.stringify(data);
  if (callback && callback.trim()) {
    return ContentService.createTextOutput(callback.trim() + '(' + jsonStr + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

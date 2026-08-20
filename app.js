(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var STORAGE_KEY = 'smart-quiz-app-v3';
  var EMBEDDED_BANK_VERSION = 6;
  var APP_VERSION = '1.2.1';
  var SB_URL = 'https://kjijvpfhmkrbqnsangub.supabase.co';
  var SB_KEY = 'sb_publishable_y1p34NJyqHePb5b3y0Xv7A_JsZxTx4t';
  var WRONG_KEY = 'smart-quiz-wrong-v2';
  var SYNC_KEY = 'smart-quiz-sync-v1';
  var ACCOUNT_KEY = 'smart-quiz-account-v1';
  var GH_SYNC_KEY = 'smart-quiz-gh-sync-v1';
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var EDITOR_PAGE_SIZE = 80;
  var IDB_DB = 'smart-quiz-bank-v1';
  var IDB_STORE = 'master';
  var IDB_KEY = 'master';

  var DEFAULT_CATEGORIES = [
    { id: 'xingce', name: '行测' },
    { id: 'qiye', name: '企业文化' },
    { id: 'tongxin', name: '通信原理' },
    { id: 'guangxian', name: '光纤通信' },
    { id: 'shujuwang', name: '数据通信网' },
    { id: 'yidong', name: '移动通信及其他业务' },
    { id: 'huiyi', name: '会议电视' },
    { id: 'jiaohuan', name: '交换及接入' }
  ];

  var DEFAULT_WEIGHTS = {
    tongxin: 5,
    shujuwang: 4,
    guangxian: 3,
    yidong: 3,
    jiaohuan: 2,
    huiyi: 1
  };

  var SECTIONS = ['综合单选', '专业单选', '综合多选', '专业多选', '专业判断', '资料分析'];

  var CHECK_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CROSS_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

  var FALLBACK_MASTER = {
    title: '精简题库',
    categories: DEFAULT_CATEGORIES,
    composite: { name: '综合卷', weights: DEFAULT_WEIGHTS },
    questions: [
      { id: 1, category: 'xingce', section: '综合单选', type: 'single', stem: '数列 2，6，12，20，30，（ ）中应填：', options: ['36', '40', '42', '48'], answer: 'C', score: 0.5, reason: '相邻差依次为 4、6、8、10、12，所以 30+12=42。' },
      { id: 2, category: 'qiye', section: '综合单选', type: 'single', stem: '国家电网有限公司的企业宗旨是：', options: ['人民电业为人民', '努力超越、追求卓越', '诚信、责任、创新、奉献', '安全第一、预防为主'], answer: 'A', score: 0.5, reason: '国家电网有限公司的企业宗旨是“人民电业为人民”。' },
      { id: 3, category: 'tongxin', section: '专业单选', type: 'single', stem: '2PSK 与 2ASK 相比，抗噪声性能更好的是：', options: ['2PSK', '2ASK', '2FSK', '相同'], answer: 'A', score: 0.5, reason: '2PSK 信号点间距离最大，抗噪声性能最好。' },
      { id: 4, category: 'shujuwang', section: '专业单选', type: 'single', stem: 'OSI 参考模型共有几层？', options: ['7 层', '5 层', '4 层', '3 层'], answer: 'A', score: 0.5, reason: 'OSI 参考模型共 7 层。' },
      { id: 5, category: 'guangxian', section: '专业单选', type: 'single', stem: '光纤通信依靠光波在纤芯与包层界面上发生的什么原理传播？', options: ['全反射', '折射', '衍射', '散射'], answer: 'A', score: 0.5, reason: '光波在纤芯与包层界面发生全反射向前传播。' },
      { id: 6, category: 'yidong', section: '专业单选', type: 'single', stem: '移动台运动会使信号频率发生变化，这种现象称为：', options: ['远近效应', '阴影效应', '多普勒效应', '多径效应'], answer: 'C', score: 0.5, reason: '运动引起的频率变化称为多普勒效应。' },
      { id: 7, category: 'jiaohuan', section: '专业单选', type: 'single', stem: 'T 接线器中话音存储器 SM 的作用是：', options: ['存放时隙控制地址', '存放 PCM 话音编码数据', '计算话务量', '完成空间接线'], answer: 'B', score: 0.5, reason: 'SM 用于暂存 PCM 话音编码数据。' }
    ]
  };

  var state = {
    master: null,
    bank: null,
    mode: null,
    modeName: '',
    answers: [],
    current: 0,
    view: 'mode',
    draft: new Set(),
    wrongFilter: 'all',
    wrongOnly: false,
    editorDirty: false,
    editorSelected: new Set(),
    editorCatFilter: 'all',
    editorSearch: '',
    editorDoneFilter: 'all',
    editorPage: 0,
    submitted: false,
    bankVersion: 0,
    doneMap: {},
    masterDirty: false,
    masterStamp: 0,
    accountUser: null,
    accountPass: null
  };

  var autoTimer = null;
  var idbWriteQueue = Promise.resolve();
  var masterSaveTimer = null;
  var masterSavePending = null;
  var poolIndex = null;

  function cloneBank(bank) {
    try { return JSON.parse(JSON.stringify(bank)); } catch (e) { return bank; }
  }

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
      var req = window.indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB 打开失败')); };
    });
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function () { db.close(); resolve(req.result); };
        req.onerror = function () { db.close(); reject(req.error); };
      });
    });
  }

  function idbSet(key, value) {
    var task = idbWriteQueue.then(function () {
      return idbOpen().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(value, key);
          tx.oncomplete = function () { db.close(); resolve(); };
          tx.onerror = function () { db.close(); reject(tx.error); };
        });
      });
    });
    idbWriteQueue = task.catch(function () { /* keep queue alive */ });
    return task;
  }

  function stripDoneFlags(bank) {
    if (bank && Array.isArray(bank.questions)) {
      bank.questions.forEach(function (q) {
        if ('done' in q) { try { delete q.done; } catch (e) { q.done = undefined; } }
      });
    }
    return bank;
  }

  function isDone(q) { return !!state.doneMap[String(q.id)]; }

  function setDone(q, val) {
    if (val) state.doneMap[String(q.id)] = true;
    else { try { delete state.doneMap[String(q.id)]; } catch (e) { state.doneMap[String(q.id)] = false; } }
  }

  function rebuildPoolIndex() {
    var idx = { questions: [], byType: {}, byCat: {}, byCatType: {}, bySection: {}, bySectionType: {} };
    if (!state.master || !Array.isArray(state.master.questions)) { poolIndex = idx; return idx; }
    var qs = state.master.questions;
    idx.questions = qs;
    qs.forEach(function (q) {
      var t = q.type, c = q.category || '', sec = q.section || '';
      (idx.byType[t] = idx.byType[t] || []).push(q);
      (idx.byCat[c] = idx.byCat[c] || []).push(q);
      var ct = c + '|' + t;
      (idx.byCatType[ct] = idx.byCatType[ct] || []).push(q);
      (idx.bySection[sec] = idx.bySection[sec] || []).push(q);
      var st = sec + '|' + t;
      (idx.bySectionType[st] = idx.bySectionType[st] || []).push(q);
    });
    poolIndex = idx;
    return idx;
  }

  function ensurePoolIndex() {
    if (!poolIndex) return rebuildPoolIndex();
    return poolIndex;
  }

  function poolQuestions(category) {
    var idx = ensurePoolIndex();
    return category ? (idx.byCat[category] || []) : idx.questions;
  }

  function poolCount(category) {
    var idx = ensurePoolIndex();
    if (!category) return idx.questions.length;
    return (idx.byCat[category] || []).length;
  }

  function poolSectionType(sec, type) {
    var idx = ensurePoolIndex();
    var key = sec + '|' + type;
    return idx.bySectionType[key] || [];
  }

  function markMasterDirty() {
    state.masterDirty = true;
    state.masterStamp = (state.masterStamp || 0) + 1;
    rebuildPoolIndex();
  }

  function flushMasterSave() {
    if (masterSaveTimer) { clearTimeout(masterSaveTimer); masterSaveTimer = null; }
    if (!state.masterDirty || masterSavePending) return Promise.resolve();
    var stamp = state.masterStamp;
    masterSavePending = idbSet(IDB_KEY, { version: EMBEDDED_BANK_VERSION, stamp: stamp, bank: state.master })
      .then(function () {
        if (stamp === state.masterStamp) state.masterDirty = false;
      })
      .catch(function () { /* IndexedDB 不可用时降级 */ })
      .then(function () { masterSavePending = null; });
    return masterSavePending;
  }

  function scheduleMasterSave() {
    if (masterSaveTimer) clearTimeout(masterSaveTimer);
    masterSaveTimer = setTimeout(flushMasterSave, 400);
  }

  function toCompactWrong(r) {
    return { id: r.id, selected: r.selected, time: r.time || Date.now() };
  }

  function wrongFromCompact(r) {
    if (!r || r.id == null) return null;
    var q = null;
    if (state.master) {
      for (var i = 0; i < state.master.questions.length; i++) {
        if (String(state.master.questions[i].id) === String(r.id)) { q = state.master.questions[i]; break; }
      }
    }
    if (!q) return null;
    return {
      id: q.id,
      category: q.category || '',
      section: q.section || '',
      type: q.type,
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      score: q.score,
      reason: q.reason || '',
      images: Array.isArray(q.images) ? q.images.slice() : [],
      selected: r.selected,
      time: r.time || Date.now()
    };
  }

  function migrateLegacyMaster() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p && p.master && Array.isArray(p.master.questions) && p.master.questions.length) {
        state.master = normalizeBank(p.master);
        p.master.questions.forEach(function (q) {
          if (q && q.done) state.doneMap[String(q.id)] = true;
        });
        stripDoneFlags(state.master);
        state.bankVersion = EMBEDDED_BANK_VERSION;
        markMasterDirty();
      }
    } catch (e) { /* ignore */ }
  }

  function saveState() {
    if (!state.master) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      return;
    }
    var payload = {
      bank: state.bank,
      mode: state.mode,
      modeName: state.modeName,
      answers: state.answers,
      current: state.current,
      view: state.view,
      wrongFilter: state.wrongFilter,
      wrongOnly: state.wrongOnly,
      submitted: state.submitted,
      bankVersion: state.bankVersion || EMBEDDED_BANK_VERSION,
      doneMap: state.doneMap || {}
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (e) { /* ignore */ }
    if (state.masterDirty) scheduleMasterSave();
    scheduleAccountSave();
  }

  function restoreState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (!p) return;
      state.doneMap = p.doneMap && typeof p.doneMap === 'object' ? p.doneMap : {};
      if (p.master && Array.isArray(p.master.questions)) {
        migrateLegacyMaster();
        p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
        saveState();
      }
      state.mode = p.mode || 'composite';
      state.modeName = p.modeName || '';
      state.bank = p.bank && Array.isArray(p.bank.questions) && p.bank.questions.length ? p.bank : null;
      state.answers = Array.isArray(p.answers) ? p.answers : [];
      if (state.master && (!state.bank || state.answers.length !== state.bank.questions.length)) {
        state.bank = buildBankForMode(state.mode);
        state.answers = state.bank ? new Array(state.bank.questions.length).fill(null) : [];
      }
      state.current = Math.max(0, Math.min(Number(p.current) || 0, Math.max(0, state.bank ? state.bank.questions.length - 1 : 0)));
      state.view = ['mode', 'import', 'quiz', 'result', 'wrong', 'editor'].indexOf(p.view) >= 0 ? p.view : 'quiz';
      state.wrongFilter = p.wrongFilter || 'all';
      state.wrongOnly = !!p.wrongOnly;
      state.submitted = !!p.submitted;
      state.bankVersion = p.bankVersion || 0;
      state.draft = new Set();
      state.editorDirty = false;
      state.editorSelected = new Set();
      state.editorCatFilter = 'all';
      state.editorSearch = '';
      state.editorDoneFilter = 'all';
      state.editorPage = 0;
    } catch (e) { /* ignore */ }
  }

  function categoryName(id) {
    if (!state.master) return id;
    for (var i = 0; i < state.master.categories.length; i++) {
      if (state.master.categories[i].id === id) return state.master.categories[i].name;
    }
    return id;
  }

  function normalizeType(t) {
    var s = String(t || '').toLowerCase();
    if (s === 'single' || s === '单选') return 'single';
    if (s === 'multiple' || s === 'multi' || s === '多选') return 'multiple';
    if (s === 'judge' || s === 'truefalse' || s === '判断') return 'judge';
    throw new Error('题型 type 只能为 single / multiple / judge');
  }

  function normalizeAnswer(ans, type, optionCount, idx) {
    function norm(v) { return String(v).trim().toUpperCase(); }
    if (type === 'multiple') {
      if (!Array.isArray(ans) || ans.length === 0) throw new Error('第 ' + (idx + 1) + ' 题多选答案应为非空数组');
      var keys = ans.map(norm).filter(function (k) { return LETTERS.indexOf(k) >= 0 && LETTERS.indexOf(k) < optionCount; });
      if (keys.length !== ans.length) throw new Error('第 ' + (idx + 1) + ' 题多选答案超出选项范围');
      return Array.from(new Set(keys)).sort();
    }
    if (type === 'judge') {
      if (typeof ans === 'boolean') return ans ? 'A' : 'B';
      if (ans === true || ans === 'true' || ans === 'TRUE' || ans === 1 || ans === '1' || ans === '对' || ans === '正确') return 'A';
      if (ans === false || ans === 'false' || ans === 'FALSE' || ans === 0 || ans === '0' || ans === '错' || ans === '错误') return 'B';
      var jk = norm(ans);
      if (jk === 'A' || jk === 'B') return jk;
      throw new Error('第 ' + (idx + 1) + ' 题判断题答案应为 true/false 或 正确/错误');
    }
    var k = norm(ans);
    if (LETTERS.indexOf(k) < 0 || LETTERS.indexOf(k) >= optionCount) throw new Error('第 ' + (idx + 1) + ' 题单选答案超出选项范围');
    return k;
  }

  function normalizeBank(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('题库格式不正确：应为 JSON 对象');
    if (!Array.isArray(raw.questions) || raw.questions.length === 0) throw new Error('题库缺少 questions 数组');
    var categories = Array.isArray(raw.categories) && raw.categories.length ? raw.categories : DEFAULT_CATEGORIES;
    var composite = raw.composite && typeof raw.composite === 'object' ? raw.composite : { name: '综合卷', weights: DEFAULT_WEIGHTS };
    var questions = raw.questions.map(function (q, i) {
      var type = normalizeType(q.type);
      if (!q.stem || !String(q.stem).trim()) throw new Error('第 ' + (i + 1) + ' 题缺少题干 stem');
      var options = type === 'judge' ? ['正确', '错误'] : (Array.isArray(q.options) && q.options.length >= 2 ? q.options.map(String) : (function () { throw new Error('第 ' + (i + 1) + ' 题 options 至少需要 2 个选项'); })());
      var answer = normalizeAnswer(q.answer, type, options.length, i);
      var score = q.score == null ? 0.5 : Number(q.score);
      if (!isFinite(score) || score < 0) throw new Error('第 ' + (i + 1) + ' 题分值无效');
      return {
        id: q.id == null ? i + 1 : q.id,
        category: q.category ? String(q.category) : 'tongxin',
        section: q.section ? String(q.section) : '专业单选',
        type: type,
        stem: String(q.stem).trim(),
        options: options,
        answer: answer,
        score: score,
        reason: q.reason ? String(q.reason).trim() : '',
        images: Array.isArray(q.images) ? q.images.map(String) : (q.image ? [String(q.image)] : [])
      };
    });
    return {
      title: raw.title ? String(raw.title) : '未命名题库',
      categories: categories,
      composite: composite,
      questions: questions
    };
  }

  function weightedSample(pool, count, weights) {
    if (!pool.length || count <= 0) return [];
    var byCat = {};
    pool.forEach(function (q) {
      (byCat[q.category] = byCat[q.category] || []).push(q);
    });
    var cats = Object.keys(byCat);
    var result = [];
    var remaining = Math.min(count, pool.length);
    while (remaining > 0) {
      var available = cats.filter(function (c) { return byCat[c].length > 0; });
      if (!available.length) break;
      var totalW = available.reduce(function (s, c) { return s + (weights && weights[c] ? weights[c] : 0); }, 0);
      var chosen;
      if (totalW <= 0) {
        chosen = available[Math.floor(Math.random() * available.length)];
      } else {
        var r = Math.random() * totalW;
        for (var i = 0; i < available.length; i++) {
          var c = available[i];
          r -= (weights && weights[c] ? weights[c] : 0);
          if (r <= 0) { chosen = c; break; }
        }
        if (!chosen) chosen = available[available.length - 1];
      }
      result.push(byCat[chosen].shift());
      remaining--;
    }
    return result.sort(function (a, b) { return a.id - b.id; });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function orderByType(questions) {
    var singles = questions.filter(function (q) { return q.type === 'single'; });
    var multis = questions.filter(function (q) { return q.type === 'multiple'; });
    var judges = questions.filter(function (q) { return q.type === 'judge'; });
    return singles.concat(multis, judges);
  }

  function bySection(master, section) {
    return master.questions.filter(function (q) { return q.section === section && !isDone(q); }).map(cloneBank).sort(function (a, b) { return a.id - b.id; });
  }

  function buildCompositeBank(master) {
    var weights = master.composite && master.composite.weights ? master.composite.weights : DEFAULT_WEIGHTS;
    var onePoint = bySection(master, '专业单选').filter(function (q) { return q.score === 1; });
    var restSingle = bySection(master, '专业单选').filter(function (q) { return q.score !== 1; });
    var proMulti = bySection(master, '专业多选');
    var proJudge = bySection(master, '专业判断');
    var out = [];
    out.push.apply(out, shuffle(bySection(master, '综合单选')));
    out.push.apply(out, shuffle(weightedSample(onePoint, 5, weights)));
    out.push.apply(out, shuffle(weightedSample(restSingle, 60, weights)));
    out.push.apply(out, shuffle(bySection(master, '综合多选')));
    out.push.apply(out, shuffle(weightedSample(proMulti, 30, weights)));
    out.push.apply(out, shuffle(weightedSample(proJudge, 30, weights)));
    out.push.apply(out, shuffle(bySection(master, '资料分析')));
    return out;
  }

  var PAPER_BANDS = [
    { start: 1, end: 80, type: 'single', score: 0.5, section: '综合单选' },
    { start: 81, end: 85, type: 'single', score: 1, section: '专业单选' },
    { start: 86, end: 95, type: 'multiple', score: 0.5, section: '综合多选' },
    { start: 96, end: 125, type: 'multiple', score: 1, section: '专业多选' },
    { start: 126, end: 155, type: 'judge', score: 0.5, section: '专业判断' },
    { start: 156, end: 165, type: 'single', score: 0.5, section: '资料分析' }
  ];

  function fillPaperType(pool, type, count, weights, usedIds) {
    var avail = pool.filter(function (q) { return q.type === type && !usedIds[String(q.id)]; });
    var candidates = avail.filter(function (q) { return !isDone(q); });
    if (candidates.length < count) candidates = avail;
    if (!candidates.length) candidates = ensurePoolIndex().byType[type].filter(function (q) { return !usedIds[String(q.id)]; });
    var chosen = weights ? weightedSample(candidates, Math.min(count, candidates.length), weights) : shuffle(candidates).slice(0, Math.min(count, candidates.length));
    if (!chosen.length) chosen = candidates;
    var out = chosen.map(cloneBank);
    var i = 0;
    while (out.length < count) { out.push(cloneBank(chosen[i % chosen.length])); i++; }
    chosen.forEach(function (q) { usedIds[String(q.id)] = true; });
    return out;
  }

  function buildBankForMode(mode) {
    var master = state.master;
    if (!master) return null;
    var name = mode === 'composite' ? (master.composite && master.composite.name || '综合卷') : categoryName(mode);
    var pool = poolQuestions(mode === 'composite' ? null : mode).slice();
    var weights = master.composite && master.composite.weights;
    var questions = [];
    var usedIds = {};
    PAPER_BANDS.forEach(function (band) {
      var count = band.end - band.start + 1;
      var items = fillPaperType(pool, band.type, count, mode === 'composite' ? weights : null, usedIds);
      items.forEach(function (q) {
        var c = cloneBank(q);
        c.score = band.score;
        c.section = band.section;
        questions.push(c);
      });
    });
    return {
      title: master.title + ' · ' + name,
      categories: master.categories,
      composite: master.composite,
      questions: questions
    };
  }

  function typeLabel(type) {
    return type === 'single' ? '单选' : type === 'multiple' ? '多选' : '判断';
  }

  function fmtScore(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function richText(s) {
    return escapeHtml(s).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  }

  function questionImageList(q) {
    var list = Array.isArray(q.images) ? q.images.slice() : [];
    if (q.image) list.unshift(String(q.image));
    return list;
  }

  function appendImages(container, q) {
    questionImageList(q).forEach(function (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = '题目图片';
      img.loading = 'lazy';
      container.append(img);
    });
  }

  function isCorrect(q, selected) {
    if (q.type === 'multiple') {
      if (!Array.isArray(selected) || selected.length === 0) return false;
      return selected.map(String).slice().sort().join(',') === q.answer.map(String).slice().sort().join(',');
    }
    return selected === q.answer;
  }

  function optionText(q, key) {
    return q.options[LETTERS.indexOf(key)] || '';
  }

  function formatAnswer(q) {
    var keys = q.type === 'multiple' ? q.answer : [q.answer];
    return keys.map(function (k) { return k + '. ' + optionText(q, k); }).join('、');
  }

  function formatSelected(selected, q) {
    var arr = Array.isArray(selected) ? selected : [selected];
    if (!arr.length) return '未作答';
    return arr.map(function (k) { return k + '. ' + optionText(q, k); }).join('、');
  }

  function allAnswered() {
    return state.answers.every(function (a) { return !!a; });
  }

  function firstUnanswered() {
    return state.answers.findIndex(function (a) { return !a; });
  }

  function renderAll() {
    var isAuth = state.view === 'login' || state.view === 'register';
    var topbar = document.querySelector('header.topbar');
    if (topbar) topbar.style.display = isAuth ? 'none' : '';
    var lv = $('#loginView');
    if (lv) lv.hidden = state.view !== 'login';
    var rv = $('#registerView');
    if (rv) rv.hidden = state.view !== 'register';
    $('#bankTitle').textContent = state.bank ? state.bank.title : (state.master ? state.master.title : '尚未加载题库');
    $('#wrongBankBtn').hidden = false;
    $('#editBankBtn').hidden = !state.master;
    $('#changeBankBtn').hidden = !state.master;
    $('#restartBtn').hidden = !state.master || state.view === 'mode';
    $('#modeView').hidden = state.view !== 'mode';
    $('#importView').hidden = state.view !== 'import';
    $('#backFromImportBtn').hidden = state.view !== 'import' || !state.master;
    $('#quizView').hidden = state.view !== 'quiz';
    $('#resultView').hidden = state.view !== 'result';
    $('#wrongView').hidden = state.view !== 'wrong';
    $('#editorView').hidden = state.view !== 'editor';
    if (state.view === 'mode') { renderModeGrid(); renderAccountPanel(); }
    if (state.view === 'quiz') renderQuiz();
    if (state.view === 'result') renderResult();
    if (state.view === 'wrong') renderStoredWrong();
    if (state.view === 'editor') renderEditorList();
  }

  function renderModeGrid() {
    var master = state.master;
    if (!master) {
      $('#modeSummary').textContent = '请先导入题库。';
      $('#modeGrid').replaceChildren();
      return;
    }
    $('#modeSummary').textContent = '共 ' + master.questions.length + ' 题。一套卷最多 165 题，每次随机抽题、随机顺序；综合卷按重点比例抽题。';
    var grid = $('#modeGrid');
    grid.replaceChildren();
    var compositeCount = master.questions.length;
    grid.append(makeModeCard('composite', master.composite && master.composite.name || '综合卷', compositeCount + ' 题 · 全部题型，按重点比例抽题'));
    master.categories.forEach(function (cat) {
      grid.append(makeModeCard(cat.id, cat.name, poolCount(cat.id) + ' 题 · 单独套题'));
    });
  }

  function makeModeCard(mode, name, desc) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'mode-card';
    card.dataset.mode = mode;
    var title = document.createElement('strong');
    title.textContent = name;
    var sub = document.createElement('span');
    sub.textContent = desc;
    card.append(title, sub);
    return card;
  }

  function loadMode(mode) {
    var bank = buildBankForMode(mode);
    if (!bank) {
      alert('该题库暂时没有题目');
      return;
    }
    state.bank = bank;
    state.mode = mode;
    state.modeName = mode === 'composite' ? (state.master.composite && state.master.composite.name || '综合卷') : categoryName(mode);
    state.answers = new Array(bank.questions.length).fill(null);
    state.current = 0;
    state.draft = new Set();
    state.wrongOnly = false;
    state.editorDirty = false;
    state.editorSelected = new Set();
    state.submitted = false;
    state.view = 'quiz';
    saveState();
    renderAll();
  }

  function renderQuiz() {
    var bank = state.bank;
    var total = bank.questions.length;
    var answered = state.answers.filter(Boolean).length;
    var earned = state.answers.reduce(function (s, a) { return s + (a ? a.points : 0); }, 0);
    var full = bank.questions.reduce(function (s, q) { return s + q.score; }, 0);
    $('#progressText').textContent = (state.current + 1) + ' / ' + total;
    $('#scoreText').textContent = '得分 ' + fmtScore(earned) + ' / ' + fmtScore(full);
    $('#answeredCount').textContent = answered;
    $('#totalCount').textContent = total;
    $('#progressFill').style.width = (total ? (answered / total) * 100 : 0) + '%';
    renderQuestion();
    renderSheet();
    updateNav();
  }

  function renderQuestion() {
    var panel = $('#questionPanel');
    var q = state.bank.questions[state.current];
    var ans = state.answers[state.current];
    panel.replaceChildren();

    var head = document.createElement('div');
    head.className = 'question-head';
    var num = document.createElement('span');
    num.className = 'q-number';
    num.textContent = '第 ' + (state.current + 1) + ' 题';
    var typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge type-' + q.type;
    typeBadge.textContent = typeLabel(q.type);
    head.append(num, typeBadge);
    if (state.mode === 'composite' && q.section) {
      var sectionBadge = document.createElement('span');
      sectionBadge.className = 'section-badge';
      sectionBadge.textContent = q.section;
      head.append(sectionBadge);
    }
    var scoreBadge = document.createElement('span');
    scoreBadge.className = 'score-badge';
    scoreBadge.textContent = fmtScore(q.score) + ' 分';
    head.append(scoreBadge);

    var stem = document.createElement('div');
    stem.className = 'question-stem';
    stem.innerHTML = richText(q.stem);

    var list = document.createElement('div');
    list.className = 'option-list';
    q.options.forEach(function (opt, i) {
      var key = LETTERS[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.dataset.action = 'option';
      btn.dataset.key = key;
      var letter = document.createElement('span');
      letter.className = 'option-letter';
      letter.textContent = key;
      var text = document.createElement('span');
      text.className = 'option-text';
      text.innerHTML = richText(opt);
      btn.append(letter, text);
      if (ans) {
        btn.disabled = true;
        var selected = Array.isArray(ans.selected) ? ans.selected : [ans.selected];
        var isAnswer = q.type === 'multiple' ? q.answer.indexOf(key) >= 0 : q.answer === key;
        var isSelected = selected.indexOf(key) >= 0;
        if (isAnswer) btn.classList.add('correct');
        else if (isSelected) btn.classList.add('wrong-selected');
        else btn.classList.add('dim');
      } else if (q.type === 'multiple' && state.draft.has(key)) {
        btn.classList.add('selected');
      }
      list.append(btn);
    });

    var images = document.createElement('div');
    images.className = 'question-images';
    appendImages(images, q);
    panel.append(head, stem);
    if (images.children.length) panel.append(images);
    panel.append(list);
    if (!ans && q.type === 'multiple') {
      var confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-primary confirm-btn';
      confirmBtn.dataset.action = 'confirm';
      confirmBtn.textContent = '确认答案';
      panel.append(confirmBtn);
    }
    if (ans) panel.append(renderFeedback(q, ans));
  }

  function renderFeedback(q, ans) {
    var fb = document.createElement('div');
    fb.className = 'feedback ' + (ans.correct ? 'feedback-ok' : 'feedback-bad');
    var icon = document.createElement('div');
    icon.className = 'feedback-icon';
    icon.innerHTML = ans.correct ? CHECK_ICON : CROSS_ICON;
    var body = document.createElement('div');
    body.className = 'feedback-body';
    var title = document.createElement('div');
    title.className = 'fb-title';
    title.textContent = ans.correct ? '回答正确 · 获得 ' + fmtScore(q.score) + ' 分' : '回答错误 · 该题 ' + fmtScore(q.score) + ' 分';
    var answerLine = document.createElement('div');
    answerLine.className = 'fb-answer';
    answerLine.textContent = ans.correct ? '你的答案：' + formatSelected(ans.selected, q) : '正确答案：' + formatAnswer(q);
    body.append(title, answerLine);
    var reason = document.createElement('div');
    reason.className = 'fb-reason';
    reason.textContent = q.reason || '本题未提供解析';
    body.append(reason);
    fb.append(icon, body);
    return fb;
  }

  function renderSheet() {
    var grid = $('#sheetGrid');
    grid.replaceChildren();
    state.bank.questions.forEach(function (q, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sheet-btn';
      btn.dataset.action = 'jump';
      btn.dataset.index = i;
      btn.textContent = i + 1;
      var ans = state.answers[i];
      if (ans) btn.classList.add(ans.correct ? 'ok' : 'bad');
      if (i === state.current) btn.classList.add('current');
      grid.append(btn);
    });
  }

  function updateNav() {
    $('#prevBtn').disabled = state.current === 0;
    $('#nextBtn').textContent = state.current === state.bank.questions.length - 1 ? '提交试卷' : '下一题';
  }

  function goTo(i) {
    clearTimeout(autoTimer);
    state.current = Math.max(0, Math.min(state.bank.questions.length - 1, i));
    state.draft = new Set();
    saveState();
    renderQuiz();
  }

  function goPrev() {
    if (state.current > 0) goTo(state.current - 1);
  }

  function goNext() {
    if (state.current < state.bank.questions.length - 1) {
      goTo(state.current + 1);
      return;
    }
    if (!allAnswered() && !confirm('还有未作答的题目，确定提交试卷吗？')) return;
    showResult();
  }

  function showResult() {
    state.view = 'result';
    state.submitted = true;
    saveState();
    renderAll();
  }

  function onOptionClick(btn) {
    var q = state.bank.questions[state.current];
    if (state.answers[state.current]) return;
    var key = btn.dataset.key;
    if (q.type === 'multiple') {
      if (state.draft.has(key)) {
        state.draft.delete(key);
        btn.classList.remove('selected');
      } else {
        state.draft.add(key);
        btn.classList.add('selected');
      }
      return;
    }
    submitAnswer(key);
  }

  function submitMultiple() {
    var q = state.bank.questions[state.current];
    if (state.answers[state.current] || state.draft.size === 0) return;
    submitAnswer(Array.from(state.draft));
  }

  function submitAnswer(selected) {
    var q = state.bank.questions[state.current];
    var correct = isCorrect(q, selected);
    state.answers[state.current] = { selected: selected, correct: correct, points: correct ? q.score : 0 };
    setDone(q, correct);
    var mi = state.master.questions.findIndex(function (x) { return String(x.id) === String(q.id); });
    if (mi >= 0) setDone(state.master.questions[mi], correct);
    state.draft = new Set();
    if (correct) removeStoredWrong(q.id);
    else addStoredWrong(q, selected);
    saveState();
    renderQuiz();
    if (!correct) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (state.current < state.bank.questions.length - 1) goTo(state.current + 1);
    }, 800);
  }

  function loadStoredWrong() {
    try {
      var raw = localStorage.getItem(WRONG_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      var out = [];
      list.forEach(function (r) {
        var full = wrongFromCompact(r);
        if (full) out.push(full);
      });
      return out;
    } catch (e) { return []; }
  }

  function saveStoredWrong(list) {
    try {
      var compact = (Array.isArray(list) ? list : []).map(toCompactWrong);
      localStorage.setItem(WRONG_KEY, JSON.stringify(compact));
    } catch (e) { /* ignore */ }
  }

  function addStoredWrong(q, selected) {
    var list = loadStoredWrong();
    var rec = {
      id: q.id,
      category: q.category || '',
      section: q.section || '',
      type: q.type,
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      score: q.score,
      reason: q.reason || '',
      images: questionImageList(q),
      selected: selected,
      time: Date.now()
    };
    var idx = list.findIndex(function (r) { return String(r.id) === String(q.id); });
    if (idx >= 0) list[idx] = rec; else list.push(rec);
    saveStoredWrong(list);
  }

  function removeStoredWrong(id) {
    var list = loadStoredWrong();
    var next = list.filter(function (r) { return String(r.id) !== String(id); });
    if (next.length !== list.length) saveStoredWrong(next);
  }

  function clearStoredWrong() {
    saveStoredWrong([]);
  }

  function showImportError(msg) {
    var el = $('#importError');
    el.textContent = msg || '题库导入失败';
    el.hidden = false;
  }


  function syncLoadSettings() {
    try { var raw = localStorage.getItem(SYNC_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
  }

  function syncSaveSettings() {
    var s = { owner: $('#syncOwner').value.trim(), repo: $('#syncRepo').value.trim(), token: $('#syncToken').value.trim(), auto: !!$('#syncAuto').checked };
    localStorage.setItem(SYNC_KEY, JSON.stringify(s));
    setSyncStatus('同步设置已保存');
  }

  function fillSyncSettings() {
    var s = syncLoadSettings();
    if ($('#syncOwner')) $('#syncOwner').value = s.owner || 'IAY-J';
    if ($('#syncRepo')) $('#syncRepo').value = s.repo || 'guowang-quiz';
    if ($('#syncToken')) $('#syncToken').value = s.token || '';
    if ($('#syncAuto')) $('#syncAuto').checked = !!s.auto;
  }

  function setSyncStatus(msg) {
    var el = $('#syncStatus');
    if (el) { el.textContent = msg; el.hidden = !msg; }
  }

  function syncHeaders(token) {
    return { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }

  function b64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function buildCloudData() {
    var master = state.master ? stripDoneFlags(cloneBank(state.master)) : null;
    var doneIds = [];
    if (state.master) {
      state.master.questions.forEach(function (q) { if (isDone(q)) doneIds.push(q.id); });
    }
    return {
      version: APP_VERSION,
      master: master,
      doneIds: doneIds,
      bank: state.bank,
      answers: state.answers,
      current: state.current,
      mode: state.mode,
      modeName: state.modeName,
      wrong: loadStoredWrong(),
      submitted: state.submitted
    };
  }

  function applyCloudData(data) {
    if (!data || !data.master) throw new Error('云端数据缺少题库');
    state.master = stripDoneFlags(normalizeBank(data.master));
    state.doneMap = {};
    (data.doneIds || []).forEach(function (id) { state.doneMap[String(id)] = true; });
    if (data.master && Array.isArray(data.master.questions)) {
      data.master.questions.forEach(function (q) { if (q && q.done) state.doneMap[String(q.id)] = true; });
    }
    markMasterDirty();
    state.bank = data.bank && Array.isArray(data.bank.questions) && data.bank.questions.length ? data.bank : null;
    state.answers = Array.isArray(data.answers) ? data.answers : [];
    if (!state.bank || state.answers.length !== state.bank.questions.length) {
      state.bank = buildBankForMode(data.mode || 'composite');
      state.answers = state.bank ? new Array(state.bank.questions.length).fill(null) : [];
    }
    state.current = Math.max(0, Math.min(Number(data.current) || 0, Math.max(0, state.bank.questions.length - 1)));
    state.mode = data.mode || 'composite';
    state.modeName = data.modeName || '';
    state.submitted = !!data.submitted;
    state.wrongOnly = false;
    state.draft = new Set();
    if (Array.isArray(data.wrong)) saveStoredWrong(data.wrong);
    state.view = state.bank ? 'quiz' : 'mode';
    saveState();
  }

  async function pushBankToGithub() {
    if (!state.master) { setSyncStatus('请先加载题库'); return; }
    syncSaveSettings();
    var token = $('#syncToken').value.trim();
    var owner = $('#syncOwner').value.trim();
    var repo = $('#syncRepo').value.trim();
    if (!token) { setSyncStatus('请填写 GitHub 令牌'); return; }
    setSyncStatus('正在推送…');
    try {
      var path = 'cloud-data.json';
      var sha = null;
      var get = await fetch('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/' + path, { headers: syncHeaders(token) });
      if (get.ok) { var meta = await get.json(); sha = meta.sha; }
      var body = { message: 'Sync user data from app', content: b64EncodeUtf8(JSON.stringify(buildCloudData(), null, 2)), branch: 'main' };
      if (sha) body.sha = sha;
      var put = await fetch('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/' + path, { method: 'PUT', headers: Object.assign(syncHeaders(token), { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (put.ok) setSyncStatus('推送成功，云端数据已更新');
      else { var err = await put.json().catch(function () { return {}; }); setSyncStatus('推送失败：' + (err.message || put.status) + '（请检查令牌是否有效且勾选 repo 权限）'); }
    } catch (e) { setSyncStatus('推送失败：' + e.message); }
  }

  async function pullBankFromGithub(silent) {
    syncSaveSettings();
    var token = $('#syncToken').value.trim();
    var owner = $('#syncOwner').value.trim();
    var repo = $('#syncRepo').value.trim();
    if (!token) { if (!silent) setSyncStatus('请先填写 GitHub 令牌并保存'); return; }
    if (!silent) setSyncStatus('正在拉取…');
    try {
      var apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/cloud-data.json';
      var res = await fetch(apiUrl, { headers: Object.assign(syncHeaders(token), { 'Accept': 'application/vnd.github.raw+json' }) });
      var raw = null;
      if (res.ok) raw = await res.text();
      else if (res.status === 404) {
        var fallback = await fetch('https://raw.githubusercontent.com/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/main/cloud-data.json', { cache: 'no-store' });
        if (fallback.ok) raw = await fallback.text();
      } else {
        var err = await res.json().catch(function () { return {}; });
        if (!silent) setSyncStatus('拉取失败：' + (err.message || res.status) + '（请检查令牌是否有效且勾选 repo 权限）');
        return;
      }
      if (!raw) { if (!silent) setSyncStatus('云端还没有 cloud-data.json，请先在任意设备点“推送”上传一次'); return; }
      var data;
      try { data = JSON.parse(raw); } catch (e) { if (!silent) setSyncStatus('云端数据格式不正确：' + e.message); return; }
      if (!silent && !confirm('拉取云端数据将替换当前题库和进度，确定继续吗？')) { setSyncStatus('已取消'); return; }
      applyCloudData(data);
      renderAll();
      if (!silent) setSyncStatus('拉取成功，云端数据已载入');
    } catch (e) { if (!silent) setSyncStatus('拉取失败：' + e.message); }
  }

  async function maybeAutoSync() {
    var s = syncLoadSettings();
    if (!s.auto || !s.token) return;
    await pullBankFromGithub(true);
  }

    var accountSaveTimer = null;
  var accountInterval = null;

  function accountStored() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); } catch (e) { return null; }
  }

  function accountStore(u, p) {
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ user: u, pass: p })); } catch (e) { /* ignore */ }
  }

  function accountClear() {
    try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) { /* ignore */ }
  }

  function setAccountStatus(msg) {
    var el = $('#accountStatus');
    if (el) el.textContent = msg;
    var el2 = $('#accountStatusBar');
    if (el2) el2.textContent = msg;
  }

  function renderAccountPanel() {
    var stored = accountStored();
    var logged = !!state.accountUser;
    if ($('#accountLogoutBtn')) $('#accountLogoutBtn').hidden = !logged;
    if ($('#accountSaveBtn')) $('#accountSaveBtn').hidden = !logged;
    if ($('#accountLoginBarBtn')) $('#accountLoginBarBtn').hidden = logged;
    if ($('#accountUser')) $('#accountUser').value = state.accountUser || (stored ? stored.user : '');
    if ($('#accountPass')) $('#accountPass').value = stored ? stored.pass : '';
    setAccountStatus(logged ? '已登录：' + state.accountUser + '，数据会自动保存。' : '登录或注册后自动保存题库、错题和进度。');
  }

  function sbHash(pass) {
    var h = 0;
    var s = String(pass);
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'h' + Math.abs(h);
  }

  async function sbRequest(method, query, payload) {
    var url = SB_URL + '/rest/v1/quiz_data' + (query || '');
    var opts = { method: method, headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' } };
    if (method === 'POST') opts.headers['Prefer'] = 'resolution=merge-duplicates';
    if (payload !== undefined) opts.body = JSON.stringify(payload);
    var res = await fetch(url, opts);
    var text = await res.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data: data };
  }

  async function accountApi(path, body) {
    if (path === '/api/register') {
      var r = await sbRequest('POST', '', { username: body.user, pass_hash: sbHash(body.pass), data: {} });
      return { ok: r.ok, status: r.status, data: r.data || {} };
    }
    if (path === '/api/login' || path === '/api/load') {
      var r = await sbRequest('GET', '?username=eq.' + encodeURIComponent(body.user) + '&select=pass_hash,data');
      if (!r.ok) return { ok: false, status: r.status, data: {} };
      var row = (r.data || [])[0];
      if (!row || row.pass_hash !== sbHash(body.pass)) return { ok: false, status: 401, data: { error: '用户名或密码错误' } };
      return { ok: true, status: 200, data: { data: row.data || {} } };
    }
    if (path === '/api/save') {
      var r = await sbRequest('POST', '?on_conflict=username', { username: body.user, pass_hash: sbHash(body.pass), data: body.data });
      return { ok: r.ok, status: r.status, data: r.data || {} };
    }
    return { ok: false, status: 404, data: {} };
  }

  async function accountLogin(silent) {
    var u = $('#accountUser').value.trim();
    var p = $('#accountPass').value;
    if (!u || !/^\d{6}$/.test(p)) { if (!silent) setAccountStatus('请输入用户名和6位数字密码'); return false; }
    if (!silent) setAccountStatus('正在登录，请稍候…');
    var r = await accountApi('/api/login', { user: u, pass: p });
    if (!r.ok) { if (!silent) setAccountStatus(r.data.error || '登录失败'); return false; }
    state.accountUser = u;
    state.accountPass = p;
    accountStore(u, p);
    try { applyCompactData(r.data.data || {}); } catch (e) { /* keep local */ }
    state.view = 'mode';
    saveState();
    startAccountTimer();
    renderAll();
    if (!silent) setAccountStatus('登录成功，已载入云端数据');
    return true;
  }

  async function accountRegister() {
    var u = $('#regUser').value.trim();
    var p = $('#regPass').value;
    var st = $('#registerStatus');
    if (!u || !/^\d{6}$/.test(p)) { if (st) st.textContent = '用户名不能为空，密码必须是6位数字'; return; }
    var r = await accountApi('/api/register', { user: u, pass: p });
    if (!r.ok) { if (st) st.textContent = (r.data && (r.data.error || r.data.message)) || '注册失败'; return; }
    if ($('#accountUser')) $('#accountUser').value = u;
    if ($('#accountPass')) $('#accountPass').value = '';
    state.view = 'login';
    renderAll();
    setAccountStatus('注册成功，请登录');
  }

  function accountLogout() {
    state.accountUser = null;
    state.accountPass = null;
    accountClear();
    if (accountInterval) clearInterval(accountInterval);
    accountInterval = null;
    state.view = 'login';
    saveState();
    renderAll();
    setAccountStatus('已退出登录');
  }

  function scheduleAccountSave() {
    if (!state.accountUser) return;
    if (accountSaveTimer) clearTimeout(accountSaveTimer);
    accountSaveTimer = setTimeout(function () { saveAccountNow(); }, 2000);
  }

  async function saveAccountNow() {
    if (!state.accountUser || !state.accountPass) return;
    var r = await accountApi('/api/save', { user: state.accountUser, pass: state.accountPass, data: buildCompactData() });
    if (r.ok) {
      var btn = $('#accountSaveBtn');
      if (btn) { btn.classList.add('saved'); btn.textContent = '已保存'; }
      setAccountStatus('已保存到云端');
      setTimeout(function () {
        if (btn) { btn.classList.remove('saved'); btn.textContent = '立即保存'; }
        renderAccountPanel();
      }, 1500);
    }
  }

  function startAccountTimer() {
    if (accountInterval) clearInterval(accountInterval);
    accountInterval = setInterval(function () { saveAccountNow(); }, 30000);
  }

  async function autoLogin() {
    var stored = accountStored();
    if (!stored || !stored.user || !stored.pass) return;
    if ($('#accountUser')) $('#accountUser').value = stored.user;
    if ($('#accountPass')) $('#accountPass').value = stored.pass;
    await accountLogin(true);
  }

  function dataSyncStatus(msg) {
    var el = $('#dataSyncStatus');
    if (el) el.textContent = msg;
  }

  function exportData() {
    if (!state.master) { dataSyncStatus('请先加载题库'); return; }
    var data = buildCloudData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-data-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    dataSyncStatus('已导出数据文件');
  }

  function importDataFromText(text) {
    try {
      var data = JSON.parse(text);
      applyCloudData(data);
      renderAll();
      dataSyncStatus('导入成功，数据已载入');
    } catch (e) { dataSyncStatus('导入失败：' + e.message); }
  }

  function toggleImport() {
    var ta = $('#importDataText');
    var btn = $('#importDataConfirmBtn');
    if (!ta || !btn) return;
    var hidden = ta.hidden;
    ta.hidden = !hidden;
    btn.hidden = !hidden;
    if (hidden) { ta.value = ''; ta.focus(); }
  }

  function ghLoad() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(GH_SYNC_KEY) || 'null') || {}; } catch (e) { s = {}; }
    s.owner = s.owner || 'IAY-J';
    s.repo = s.repo || 'guowang-quiz';
    s.interval = Math.max(1, Number(s.interval) || 5);
    s.auto = s.auto !== false;
    return s;
  }

  function ghSave() {
    var s = { owner: $('#ghOwner').value.trim(), repo: $('#ghRepo').value.trim(), token: $('#ghToken').value.trim(), interval: Math.max(1, Number($('#ghInterval').value) || 5), auto: !!$('#ghAuto').checked };
    localStorage.setItem(GH_SYNC_KEY, JSON.stringify(s));
    ghStatus('GitHub 自动上传设置已保存');
    startGhTimer();
  }

  function ghFill() {
    var s = ghLoad();
    if ($('#ghOwner')) $('#ghOwner').value = s.owner || 'IAY-J';
    if ($('#ghRepo')) $('#ghRepo').value = s.repo || 'guowang-quiz';
    if ($('#ghToken')) $('#ghToken').value = s.token || '';
    if ($('#ghInterval')) $('#ghInterval').value = s.interval || 5;
    if ($('#ghAuto')) $('#ghAuto').checked = !!s.auto;
  }

  function ghStatus(msg) {
    var el = $('#ghStatus');
    if (el) el.textContent = msg;
  }

  function buildCompactData() {
    var doneIds = [];
    if (state.master) state.master.questions.forEach(function (q) { if (isDone(q)) doneIds.push(q.id); });
    return {
      version: APP_VERSION,
      doneIds: doneIds,
      wrong: loadStoredWrong(),
      progress: { bank: state.bank, answers: state.answers, current: state.current, mode: state.mode, modeName: state.modeName, submitted: state.submitted }
    };
  }

  function applyCompactData(data) {
    if (!data || !state.master) return;
    var doneSet = {};
    (data.doneIds || []).forEach(function (id) { doneSet[String(id)] = true; });
    state.doneMap = doneSet;
    if (Array.isArray(data.wrong)) saveStoredWrong(data.wrong);
    if (data.progress && data.progress.bank && Array.isArray(data.progress.bank.questions)) {
      state.bank = data.progress.bank;
      state.answers = Array.isArray(data.progress.answers) ? data.progress.answers : [];
      if (state.answers.length !== state.bank.questions.length) state.answers = new Array(state.bank.questions.length).fill(null);
      state.current = Math.max(0, Math.min(Number(data.progress.current) || 0, state.bank.questions.length - 1));
      state.mode = data.progress.mode || state.mode;
      state.modeName = data.progress.modeName || state.modeName;
      state.submitted = !!data.progress.submitted;
    }
    saveState();
  }

  async function uploadGh(silent) {
    var s = ghLoad();
    if (!s.token || !s.owner || !s.repo) return;
    try {
      var path = 'user-data.json';
      var sha = null;
      var get = await fetch('https://api.github.com/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + '/contents/' + path, { headers: syncHeaders(s.token) });
      if (get.ok) { var meta = await get.json(); sha = meta.sha; }
      var body = { message: 'Auto sync user data', content: b64EncodeUtf8(JSON.stringify(buildCompactData())), branch: 'main' };
      if (sha) body.sha = sha;
      var put = await fetch('https://api.github.com/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + '/contents/' + path, { method: 'PUT', headers: Object.assign(syncHeaders(s.token), { 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
      if (put.ok && !silent) ghStatus('已上传到 GitHub');
    } catch (e) { if (!silent) ghStatus('上传失败：' + e.message); }
  }

  async function pullGh() {
    var s = ghLoad();
    if (!s.token || !s.owner || !s.repo) { ghStatus('请先保存 GitHub 设置'); return; }
    try {
      var res = await fetch('https://api.github.com/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + '/contents/user-data.json', { headers: Object.assign(syncHeaders(s.token), { 'Accept': 'application/vnd.github.raw+json' }) });
      if (res.status === 404) { ghStatus('GitHub 还没有 user-data.json'); return; }
      if (!res.ok) { ghStatus('拉取失败：' + res.status); return; }
      var data = JSON.parse(await res.text());
      applyCompactData(data);
      renderAll();
      ghStatus('已从 GitHub 拉取并应用');
    } catch (e) { ghStatus('拉取失败：' + e.message); }
  }

  async function autoPullOnOpen() {
    var s = ghLoad();
    if (!s.token) return;
    try {
      var res = await fetch('https://api.github.com/repos/' + encodeURIComponent(s.owner) + '/' + encodeURIComponent(s.repo) + '/contents/user-data.json', { headers: Object.assign(syncHeaders(s.token), { 'Accept': 'application/vnd.github.raw+json' }) });
      if (!res.ok) return;
      var data = JSON.parse(await res.text());
      applyCompactData(data);
      renderAll();
    } catch (e) { /* ignore */ }
  }

  async function loadGhConfigFromServer() {
    try {
      var res = await fetch('/api/gh-config', { cache: 'no-store' });
      if (res.ok) {
        var cfg = await res.json();
        if (cfg && cfg.token) {
          var s = ghLoad();
          s.owner = cfg.owner || s.owner;
          s.repo = cfg.repo || s.repo;
          s.token = cfg.token;
          s.auto = true;
          localStorage.setItem(GH_SYNC_KEY, JSON.stringify(s));
        }
      }
      startGhTimer();
      await autoPullOnOpen();
      setTimeout(function () { uploadGh(true); }, 3000);
    } catch (e) { /* ignore */ }
  }

  var ghTimer = null;
  var ghUploadTimer = null;
  function scheduleGhUpload() {
    if (!ghLoad().token) return;
    if (ghUploadTimer) clearTimeout(ghUploadTimer);
    ghUploadTimer = setTimeout(function () { uploadGh(true); }, 5000);
  }

  function startGhTimer() {
    if (ghTimer) clearInterval(ghTimer);
    var s = ghLoad();
    if (!s.auto || !s.token) return;
    ghTimer = setInterval(function () { uploadGh(true); }, Math.max(1, Number(s.interval) || 5) * 60 * 1000);
  }

  function questionFingerprint(q) {
    return JSON.stringify([
      q.type,
      q.stem,
      q.options,
      q.answer,
      q.reason || '',
      q.images || []
    ]);
  }

  function importFromText(text) {
    try {
      if (state.bank && !state.submitted) {
        if (!confirm('当前试卷尚未提交，导入新题库将清空当前试卷，确定继续吗？')) return false;
      }
      var bank = normalizeBank(JSON.parse(text));
      if (!state.master) {
        state.master = bank;
      } else {
        var existing = {};
        state.master.questions.forEach(function (q) { existing[questionFingerprint(q)] = true; });
        var seen = {};
        var added = [];
        var skipped = 0;
        bank.questions.forEach(function (q) {
          var fp = questionFingerprint(q);
          if (existing[fp] || seen[fp]) {
            skipped += 1;
            return;
          }
          seen[fp] = true;
          added.push(q);
        });
        if (!added.length) {
          alert('导入的题目与现有题库完全相同，未导入任何题目');
          return false;
        }
        var maxId = state.master.questions.reduce(function (m, q) { return Math.max(m, Number(q.id) || 0); }, 0);
        added.forEach(function (q, i) { q.id = maxId + i + 1; });
        var catIds = state.master.categories.map(function (c) { return c.id; });
        bank.categories.forEach(function (c) {
          if (catIds.indexOf(c.id) < 0) {
            state.master.categories.push(c);
            catIds.push(c.id);
          }
        });
        var weights = state.master.composite.weights;
        state.master.categories.forEach(function (c) {
          if (!weights[c.id]) weights[c.id] = 1;
        });
        state.master.questions.push.apply(state.master.questions, added);
        alert('成功导入 ' + added.length + ' 道新题，跳过 ' + skipped + ' 道重复题');
      }
      state.bank = null;
      state.mode = null;
      state.answers = [];
      state.current = 0;
      state.view = 'mode';
      markMasterDirty();
      saveState();
      renderAll();
      return true;
    } catch (err) {
      showImportError(err && err.message ? err.message : '题库导入失败');
      return false;
    }
  }

  function changeBank() {
    if (state.bank && state.answers.some(Boolean) && !confirm('退出当前作答并前往导入题库？')) return;
    state.view = 'import';
    saveState();
    renderAll();
  }

  function restartAll() {
    if (state.bank && state.answers.some(Boolean) && !confirm('确定开始一套新测试吗？当前作答记录将被清除。')) return;
    if (state.wrongOnly) {
      state.answers = new Array(state.bank.questions.length).fill(null);
      state.current = 0;
      state.draft = new Set();
      state.submitted = false;
      state.view = 'quiz';
      saveState();
      renderAll();
      return;
    }
    loadMode(state.mode || 'composite');
  }

  function wrongItems() {
    return state.bank.questions
      .map(function (q, i) { return { q: q, ans: state.answers[i] }; })
      .filter(function (x) { return x.ans && !x.ans.correct; });
  }

  function buildWrongBank(records, title) {
    if (!records.length) return null;
    return {
      title: title,
      categories: state.master ? state.master.categories : DEFAULT_CATEGORIES,
      composite: state.master ? state.master.composite : { name: '综合卷', weights: DEFAULT_WEIGHTS },
      questions: records.map(function (r) {
        return {
          id: r.id,
          category: r.category || '',
          section: r.section || '',
          type: r.type,
          stem: r.stem,
          options: r.options,
          answer: r.answer,
          score: r.score,
          reason: r.reason || '',
          images: Array.isArray(r.images) ? r.images : []
        };
      })
    };
  }

  function startWrongBank(bank) {
    var qs = orderByType(shuffle(bank.questions));
    if (qs.length > 165) qs = qs.slice(0, 165);
    bank.questions = qs;
    state.bank = bank;
    state.mode = 'wrong';
    state.modeName = '错题重练';
    state.wrongOnly = true;
    state.answers = new Array(bank.questions.length).fill(null);
    state.current = 0;
    state.draft = new Set();
    state.editorDirty = false;
    state.submitted = false;
    state.view = 'quiz';
    saveState();
    renderAll();
  }

  function retryWrong() {
    var wrong = wrongItems();
    if (!wrong.length) { alert('没有错题'); return; }
    var bank = buildWrongBank(wrong.map(function (x) { return x.q; }), (state.bank ? state.bank.title : '错题') + ' · 错题重练');
    if (bank) startWrongBank(bank);
  }

  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportWrong() {
    var wrong = wrongItems();
    if (!wrong.length) { alert('没有错题'); return; }
    downloadJson(buildWrongBank(wrong.map(function (x) { return x.q; }), '错题库'), '错题库-' + Date.now() + '.json');
  }

  function renderStoredWrong() {
    var list = loadStoredWrong();
    var filtered = state.wrongFilter === 'all' ? list : list.filter(function (r) { return r.category === state.wrongFilter; });
    $('#wrongViewSummary').textContent = filtered.length ? '共 ' + filtered.length + ' 题，长期保存在本浏览器。' : '暂无错题记录。';
    var tabs = $('#wrongFilterTabs');
    tabs.replaceChildren();
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'filter-tab' + (state.wrongFilter === 'all' ? ' active' : '');
    allBtn.dataset.filter = 'all';
    allBtn.textContent = '全部';
    tabs.append(allBtn);
    (state.master ? state.master.categories : DEFAULT_CATEGORIES).forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-tab' + (state.wrongFilter === cat.id ? ' active' : '');
      btn.dataset.filter = cat.id;
      btn.textContent = cat.name;
      tabs.append(btn);
    });
    var wrap = $('#storedWrongList');
    wrap.replaceChildren();
    if (!filtered.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '还没有错题，全部掌握。';
      wrap.append(empty);
      return;
    }
    filtered.forEach(function (rec) { wrap.append(renderWrongRecordItem(rec)); });
  }

  function renderWrongRecordItem(rec) {
    var item = document.createElement('div');
    item.className = 'wrong-item';
    var head = document.createElement('div');
    head.className = 'wrong-item-head';
    var num = document.createElement('span');
    num.className = 'q-number';
    num.textContent = '第 ' + rec.id + ' 题';
    var typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge type-' + rec.type;
    typeBadge.textContent = typeLabel(rec.type);
    var catBadge = document.createElement('span');
    catBadge.className = 'section-badge';
    catBadge.textContent = categoryName(rec.category) || rec.category;
    var scoreBadge = document.createElement('span');
    scoreBadge.className = 'score-badge';
    scoreBadge.textContent = fmtScore(rec.score) + ' 分';
    head.append(num, typeBadge, catBadge, scoreBadge);
    var stem = document.createElement('div');
    stem.className = 'wrong-item-stem';
    stem.innerHTML = richText(rec.stem);
    var images = document.createElement('div');
    images.className = 'question-images';
    appendImages(images, rec);
    var opts = document.createElement('div');
    opts.className = 'mini-options';
    rec.options.forEach(function (opt, i) {
      var key = LETTERS[i];
      var row = document.createElement('div');
      row.className = 'mini-option';
      var isAnswer = rec.type === 'multiple' ? rec.answer.indexOf(key) >= 0 : rec.answer === key;
      var isSelected = (Array.isArray(rec.selected) ? rec.selected : [rec.selected]).indexOf(key) >= 0;
      if (isAnswer) row.classList.add('correct');
      if (isSelected && !isAnswer) row.classList.add('wrong-selected');
      var letter = document.createElement('span');
      letter.className = 'mini-letter';
      letter.textContent = key;
      var text = document.createElement('span');
      text.innerHTML = richText(opt);
      row.append(letter, text);
      opts.append(row);
    });
    var answerLine = document.createElement('div');
    answerLine.className = 'wrong-answer-line';
    var yourAnswer = document.createElement('span');
    yourAnswer.textContent = '你的答案：' + formatSelected(rec.selected, rec);
    var correctAnswer = document.createElement('div');
    correctAnswer.innerHTML = '<strong>正确答案：</strong>';
    correctAnswer.append(document.createTextNode(formatAnswer(rec)));
    answerLine.append(yourAnswer, correctAnswer);
    var reason = document.createElement('div');
    reason.className = 'wrong-reason';
    reason.textContent = rec.reason || '本题未提供解析';
    item.append(head, stem);
    if (images.children.length) item.append(images);
    item.append(opts, answerLine, reason);
    return item;
  }

  function retryStoredWrong() {
    var list = loadStoredWrong();
    var filtered = state.wrongFilter === 'all' ? list : list.filter(function (r) { return r.category === state.wrongFilter; });
    if (!filtered.length) { alert('没有错题'); return; }
    var bank = buildWrongBank(filtered, '错题重练');
    if (bank) startWrongBank(bank);
  }

  function exportStoredWrong() {
    var list = loadStoredWrong();
    var filtered = state.wrongFilter === 'all' ? list : list.filter(function (r) { return r.category === state.wrongFilter; });
    if (!filtered.length) { alert('没有错题'); return; }
    downloadJson(buildWrongBank(filtered, '错题库'), '错题库-' + Date.now() + '.json');
  }

  function matchEditorFilter(q) {
    if (state.editorCatFilter !== 'all' && q.category !== state.editorCatFilter) return false;
    if (state.editorDoneFilter === 'done' && !isDone(q)) return false;
    if (state.editorDoneFilter === 'undone' && isDone(q)) return false;
    var kw = state.editorSearch.trim().toLowerCase();
    if (!kw) return true;
    var hay = [
      String(q.id),
      q.stem,
      q.reason || '',
      categoryName(q.category),
      q.section || '',
      q.type,
      q.options.join(' '),
      (q.images || []).join(' ')
    ].join(' ').toLowerCase();
    return hay.indexOf(kw) >= 0;
  }

  function renderEditorCatTabs() {
    var tabs = $('#editorCatTabs');
    tabs.replaceChildren();
    function makeTab(id, name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-tab' + (state.editorCatFilter === id ? ' active' : '');
      btn.dataset.cat = id;
      btn.textContent = name;
      tabs.append(btn);
    }
    makeTab('all', '全部');
    (state.master ? state.master.categories : DEFAULT_CATEGORIES).forEach(function (cat) {
      makeTab(cat.id, cat.name + '（' + poolCount(cat.id) + '）');
    });
  }

  function renderEditorDoneTabs() {
    var tabs = $('#editorDoneTabs');
    tabs.replaceChildren();
    var doneCount = 0;
    var allCount = state.master ? state.master.questions.length : 0;
    if (state.master) doneCount = state.master.questions.filter(function (q) { return isDone(q); }).length;
    var items = [
      { id: 'all', name: '全部状态' },
      { id: 'done', name: '已做（' + doneCount + '）' },
      { id: 'undone', name: '未做（' + (allCount - doneCount) + '）' }
    ];
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter-tab' + (state.editorDoneFilter === it.id ? ' active' : '');
      b.dataset.done = it.id;
      b.textContent = it.name;
      tabs.append(b);
    });
  }

  function renderEditorPager(total) {
    var wrap = $('#editorPager');
    wrap.replaceChildren();
    var pageCount = Math.max(1, Math.ceil(total / EDITOR_PAGE_SIZE));
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn btn-secondary btn-small';
    prev.dataset.pager = 'prev';
    prev.textContent = '上一页';
    prev.disabled = state.editorPage <= 0;
    var info = document.createElement('span');
    info.className = 'muted';
    info.textContent = '第 ' + (state.editorPage + 1) + ' / ' + pageCount + ' 页';
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-secondary btn-small';
    next.dataset.pager = 'next';
    next.textContent = '下一页';
    next.disabled = state.editorPage >= pageCount - 1;
    wrap.append(prev, info, next);
  }

  function renderEditorList() {
    var wrap = $('#editorList');
    wrap.replaceChildren();
    var master = state.master;
    var full = master.questions.reduce(function (s, q) { return s + q.score; }, 0);
    var typeRank = { single: 0, multiple: 1, judge: 2 };
    var filtered = master.questions.filter(matchEditorFilter).slice().sort(function (a, b) { return typeRank[a.type] - typeRank[b.type]; });
    var pageCount = Math.max(1, Math.ceil(filtered.length / EDITOR_PAGE_SIZE));
    if (state.editorPage >= pageCount) state.editorPage = pageCount - 1;
    var start = state.editorPage * EDITOR_PAGE_SIZE;
    var pageItems = filtered.slice(start, start + EDITOR_PAGE_SIZE);
    var endNum = Math.min(start + pageItems.length, filtered.length);
    $('#editorSummary').textContent = '共 ' + master.questions.length + ' 题 · 筛选 ' + filtered.length + ' 题 · 显示第 ' + (start + 1) + '-' + endNum + ' 题 · 第 ' + (state.editorPage + 1) + '/' + pageCount + ' 页';
    var selectedCount = state.editorSelected.size;
    $('#editorSelectedInfo').textContent = '已选 ' + selectedCount + ' 题';
    renderEditorCatTabs();
    renderEditorDoneTabs();
    renderEditorPager(filtered.length);
    pageItems.forEach(function (q, i) {
      var row = document.createElement('div');
      row.className = 'editor-row' + (state.editorSelected.has(String(q.id)) ? ' selected' : '');
      var selectBox = document.createElement('label');
      selectBox.className = 'editor-select';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.action = 'select-question';
      cb.dataset.id = q.id;
      if (state.editorSelected.has(String(q.id))) cb.checked = true;
      selectBox.append(cb);
      var main = document.createElement('div');
      main.className = 'editor-row-main';
      var head = document.createElement('div');
      head.className = 'question-head';
      var num = document.createElement('span');
      num.className = 'q-number';
      num.textContent = '第 ' + (start + i + 1) + ' 题';
      var typeBadge = document.createElement('span');
      typeBadge.className = 'type-badge type-' + q.type;
      typeBadge.textContent = typeLabel(q.type);
      var sectionBadge = document.createElement('span');
      sectionBadge.className = 'section-badge';
      sectionBadge.textContent = q.section || '';
      var catBadge = document.createElement('span');
      catBadge.className = 'cat-badge';
      catBadge.textContent = categoryName(q.category) || q.category;
      var doneBadge = document.createElement('span');
      var qDone = isDone(q);
      doneBadge.className = qDone ? 'done-badge done' : 'done-badge';
      doneBadge.textContent = qDone ? '已做' : '未做';
      head.append(num, typeBadge, sectionBadge, catBadge, doneBadge);
      if (q.images && q.images.length) {
        var imgBadge = document.createElement('span');
        imgBadge.className = 'cat-badge';
        imgBadge.textContent = '含图';
        head.append(imgBadge);
      }
      var stem = document.createElement('div');
      stem.className = 'editor-stem';
      stem.innerHTML = richText(q.stem);
      main.append(head, stem);
      var actions = document.createElement('div');
      actions.className = 'editor-row-actions';
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-secondary btn-small';
      editBtn.dataset.action = 'edit-question';
      editBtn.dataset.id = q.id;
      editBtn.textContent = '编辑';
      var doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'btn btn-secondary btn-small';
      doneBtn.dataset.action = 'toggle-done';
      doneBtn.dataset.id = q.id;
      doneBtn.textContent = isDone(q) ? '标记未做' : '标记已做';
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-secondary btn-small btn-danger';
      delBtn.dataset.action = 'delete-question';
      delBtn.dataset.id = q.id;
      delBtn.textContent = '删除';
      actions.append(doneBtn, editBtn, delBtn);

      row.append(selectBox, main, actions);
      wrap.append(row);
    });
  }

  function fillEditorSelects() {
    var sectionSel = $('#editSection');
    sectionSel.replaceChildren();
    SECTIONS.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sectionSel.append(opt);
    });
    var catSel = $('#editCategory');
    catSel.replaceChildren();
    (state.master ? state.master.categories : DEFAULT_CATEGORIES).forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      catSel.append(opt);
    });
  }

  function openQuestionForm(id) {
    var index = id == null || id < 0 ? -1 : state.master.questions.findIndex(function (q) { return String(q.id) === String(id); });
    $('#editIndex').value = index;
    fillEditorSelects();
    var q = index >= 0 ? state.master.questions[index] : null;
    $('#questionEditorTitle').textContent = q ? '编辑第 ' + q.id + ' 题' : '添加题目';
    $('#editType').value = q ? q.type : 'single';
    $('#editSection').value = q ? (q.section || '专业单选') : '专业单选';
    $('#editCategory').value = q ? (q.category || (state.master.categories[0] && state.master.categories[0].id)) : (state.master.categories[0] && state.master.categories[0].id);
    $('#editStem').value = q ? q.stem : '';
    $('#editImages').value = q ? questionImageList(q).join('\n') : '';
    $('#editScore').value = q ? q.score : '';
    $('#editReason').value = q ? (q.reason || '') : '';
    renderEditTypeControls(q);
    renderEditImagesPreview();
    $('#questionEditor').hidden = false;
    $('#questionEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderEditImagesPreview() {
    var preview = $('#editImagesPreview');
    preview.replaceChildren();
    $('#editImages').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = '图片预览';
      img.loading = 'lazy';
      preview.append(img);
    });
  }

  function renderEditTypeControls(q) {
    var type = $('#editType').value;
    var optionsWrap = $('#editOptionsWrap');
    optionsWrap.replaceChildren();
    if (type === 'judge') {
      ['正确', '错误'].forEach(function (text) {
        var input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.readOnly = true;
        optionsWrap.append(input);
      });
    } else {
      LETTERS.slice(0, 4).forEach(function (key, i) {
        var input = document.createElement('input');
        input.type = 'text';
        input.dataset.key = key;
        input.placeholder = key + ' 选项';
        if (q) input.value = q.options[i] || '';
        optionsWrap.append(input);
      });
    }
    renderEditAnswer(type, q);
  }

  function renderEditAnswer(type, q) {
    var wrap = $('#editAnswerWrap');
    wrap.replaceChildren();
    if (type === 'single' || type === 'judge') {
      var select = document.createElement('select');
      var options = type === 'judge' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
      options.forEach(function (key) {
        var opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        select.append(opt);
      });
      if (q) {
        var cur = q.type === 'judge' ? (q.answer === true ? 'A' : q.answer === false ? 'B' : q.answer) : q.answer;
        select.value = cur;
      }
      wrap.append(select);
      return;
    }
    LETTERS.slice(0, 4).forEach(function (key) {
      var label = document.createElement('label');
      label.className = 'answer-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = key;
      label.append(cb, document.createTextNode(key));
      wrap.append(label);
      if (q && Array.isArray(q.answer) && q.answer.indexOf(key) >= 0) cb.checked = true;
    });
  }

  function saveQuestionFromForm() {
    var index = Number($('#editIndex').value);
    var type = $('#editType').value;
    var section = $('#editSection').value;
    var category = $('#editCategory').value;
    var stem = $('#editStem').value.trim();
    var scoreRaw = $('#editScore').value.trim();
    var reason = $('#editReason').value.trim();
    var images = $('#editImages').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!stem) { alert('题干不能为空'); return; }
    var options;
    var answer;
    if (type === 'judge') {
      options = ['正确', '错误'];
      answer = $('#editAnswerWrap select').value === 'A';
    } else {
      options = $$('#editOptionsWrap input').map(function (inp) { return inp.value.trim(); });
      if (options.some(function (o) { return !o; })) { alert('每个选项都不能为空'); return; }
      answer = type === 'single' ? $('#editAnswerWrap select').value : $$('#editAnswerWrap input:checked').map(function (cb) { return cb.value; });
      if (type === 'multiple' && !answer.length) { alert('请选择至少一个正确答案'); return; }
    }
    var score = scoreRaw === '' ? 0.5 : Number(scoreRaw);
    if (!isFinite(score) || score < 0) { alert('分值必须是不小于 0 的数字'); return; }
    var question = {
      id: index >= 0 ? state.master.questions[index].id : null,
      category: category,
      section: section,
      type: type,
      stem: stem,
      options: options,
      answer: answer,
      score: score,
      reason: reason,
      images: images
    };
    if (index >= 0) {
      question.id = state.master.questions[index].id;
      state.master.questions[index] = question;
    } else {
      var maxId = state.master.questions.reduce(function (m, q) { return Math.max(m, Number(q.id) || 0); }, 0);
      question.id = maxId + 1;
      state.master.questions.push(question);
    }
    markMasterDirty();
    state.editorDirty = true;
    $('#questionEditor').hidden = true;
    renderEditorList();
  }

  function deleteQuestion(id) {
    var index = state.master.questions.findIndex(function (q) { return String(q.id) === String(id); });
    if (index < 0) return;
    id = state.master.questions[index].id;
    if (!confirm('确定删除第 ' + id + ' 题吗？')) return;
    state.master.questions.splice(index, 1);
    state.editorSelected.delete(String(id));
    markMasterDirty();
    state.editorDirty = true;
    renderEditorList();
  }

  function moveQuestion(id, delta) {
    var index = state.master.questions.findIndex(function (q) { return String(q.id) === String(id); });
    if (index < 0) return;
    var target = index + delta;
    if (target < 0 || target >= state.master.questions.length) return;
    var arr = state.master.questions;
    var tmp = arr[index];
    arr[index] = arr[target];
    arr[target] = tmp;
    state.editorDirty = true;
    renderEditorList();
  }

  function selectedQuestions() {
    return state.master.questions.filter(function (q) { return state.editorSelected.has(String(q.id)); });
  }

  function toggleEditorSelect(id) {
    var key = String(id);
    if (state.editorSelected.has(key)) state.editorSelected.delete(key);
    else state.editorSelected.add(key);
    $$('#editorList .editor-row').forEach(function (row) {
      var cb = row.querySelector('input[data-action="select-question"]');
      if (cb && String(cb.dataset.id) === key) {
        cb.checked = state.editorSelected.has(key);
        row.classList.toggle('selected', state.editorSelected.has(key));
      }
    });
    $('#editorSelectedInfo').textContent = '已选 ' + state.editorSelected.size + ' 题';
  }

  function selectAllQuestions() {
    state.master.questions.filter(matchEditorFilter).forEach(function (q) { state.editorSelected.add(String(q.id)); });
    renderEditorList();
  }

  function clearSelectedQuestions() {
    state.editorSelected = new Set();
    renderEditorList();
  }

  function deleteSelectedQuestions() {
    var list = selectedQuestions();
    if (!list.length) { alert('请先选择题'); return; }
    if (!confirm('确定删除选中的 ' + list.length + ' 道题吗？')) return;
    var ids = list.map(function (q) { return String(q.id); });
    state.master.questions = state.master.questions.filter(function (q) { return ids.indexOf(String(q.id)) < 0; });
    state.editorSelected = new Set();
    state.editorDirty = true;
    renderEditorList();
  }

  function exportSelectedQuestions() {
    var list = selectedQuestions();
    if (!list.length) { alert('请先选择题'); return; }
    var bank = {
      title: state.master.title + ' · 选中导出',
      categories: state.master.categories,
      composite: state.master.composite,
      questions: list.map(cloneBank)
    };
    downloadJson(bank, '选中题目-' + Date.now() + '.json');
  }

  function toggleQuestionDone(id) {
    var q = state.master.questions.find(function (x) { return String(x.id) === String(id); });
    if (!q) return;
    setDone(q, !isDone(q));
    state.editorDirty = true;
    saveState();
    renderEditorList();
  }

  function saveBankFromEditor() {
    if (state.bank && !state.submitted) {
      if (!confirm('当前试卷尚未提交，保存题库将清空当前试卷，确定继续吗？')) return;
    }
    if (state.editorDirty && !confirm('保存题库会重置当前作答进度，确定保存吗？')) return;
    try {
      state.master = stripDoneFlags(normalizeBank(state.master));
      markMasterDirty();
      state.editorDirty = false;
      state.editorSelected = new Set();
      if (state.wrongOnly || !state.mode) {
        state.view = 'mode';
      } else {
        loadMode(state.mode);
        return;
      }
      saveState();
      renderAll();
    } catch (err) {
      alert(err && err.message ? err.message : '题库格式不正确');
    }
  }

  function exportBankFromEditor() {
    downloadJson(state.master, (state.master.title || '题库') + '.json');
  }

  function backFromEditor() {
    if (state.editorDirty && !confirm('有未保存的修改，确定放弃并返回吗？')) return;
    state.editorDirty = false;
    state.editorSelected = new Set();
    state.view = state.bank ? 'quiz' : 'mode';
    saveState();
    renderAll();
  }

  function renderResult() {
    var bank = state.bank;
    var total = bank.questions.length;
    var answered = state.answers.filter(Boolean).length;
    var full = bank.questions.reduce(function (s, q) { return s + q.score; }, 0);
    var earned = state.answers.reduce(function (s, a) { return s + (a ? a.points : 0); }, 0);
    var correct = state.answers.filter(function (a) { return a && a.correct; }).length;
    var wrong = answered - correct;
    $('#finalScore').textContent = fmtScore(earned);
    $('#resultSubtitle').textContent =
      (state.modeName || '') + ' · 满分 ' + fmtScore(full) + ' 分 · 共 ' + total + ' 题 · 答对 ' + correct + ' 题 · 答错 ' + wrong + ' 题';
    var ratio = full > 0 ? earned / full : 0;
    var ringColor = ratio >= 0.6 ? '#1d9a68' : ratio >= 0.4 ? '#b7791f' : '#d04a4a';
    $('#scoreRing').style.borderColor = ringColor;
    $('#scoreRing').style.color = ringColor;
    var stats = ['single', 'multiple', 'judge'].map(function (type) {
      var items = bank.questions.map(function (q, i) { return { q: q, i: i }; }).filter(function (x) { return x.q.type === type; });
      var count = items.length;
      var correctCount = items.filter(function (x) { return state.answers[x.i] && state.answers[x.i].correct; }).length;
      var typeFull = items.reduce(function (s, x) { return s + x.q.score; }, 0);
      var typeEarned = items.reduce(function (s, x) { var a = state.answers[x.i]; return s + (a ? a.points : 0); }, 0);
      return { type: type, count: count, correctCount: correctCount, full: typeFull, earned: typeEarned };
    });
    var grid = $('#statsGrid');
    grid.replaceChildren();
    stats.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'stat-card';
      var name = document.createElement('div');
      name.className = 'stat-name';
      name.textContent = typeLabel(s.type);
      var value = document.createElement('div');
      value.className = 'stat-value';
      value.textContent = fmtScore(s.earned) + ' / ' + fmtScore(s.full) + ' 分';
      var sub = document.createElement('div');
      sub.className = 'stat-sub';
      sub.textContent = s.count + ' 题 · 答对 ' + s.correctCount + ' 题';
      card.append(name, value, sub);
      grid.append(card);
    });
    var wrongList = wrongItems();
    $('#wrongCount').textContent = wrongList.length ? '共 ' + wrongList.length + ' 题' : '全部正确';
    var wrap = $('#wrongList');
    wrap.replaceChildren();
    if (!wrongList.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '没有错题，全部掌握。';
      wrap.append(empty);
      return;
    }
    wrongList.forEach(function (x) {
      var q = x.q;
      var ans = x.ans;
      wrap.append(renderWrongRecordItem({
        id: q.id,
        category: q.category || '',
        section: q.section || '',
        type: q.type,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        score: q.score,
        reason: q.reason || '',
        images: questionImageList(q),
        selected: ans.selected
      }));
    });
  }

  async function loadBundledBank() {
    var raw = window.BUNDLED_BANK || FALLBACK_MASTER;
    state.master = stripDoneFlags(cloneBank(normalizeBank(raw)));
    state.doneMap = {};
    markMasterDirty();
    state.bank = null;
    state.mode = null;
    state.answers = [];
    state.current = 0;
    state.view = 'mode';
    saveState();
    renderAll();
  }

  function resetToEmbeddedBank() {
    var raw = window.BUNDLED_BANK || FALLBACK_MASTER;
    state.master = stripDoneFlags(normalizeBank(cloneBank(raw)));
    markMasterDirty();
    state.bank = null;
    state.mode = null;
    state.modeName = '';
    state.answers = [];
    state.current = 0;
    state.draft = new Set();
    state.wrongOnly = false;
    state.editorDirty = false;
    state.editorSelected = new Set();
    state.editorCatFilter = 'all';
    state.editorSearch = '';
    state.submitted = false;
    state.bankVersion = EMBEDDED_BANK_VERSION;
    state.view = 'mode';
    saveState();
  }

  function dedupeQuestionList(list) {
    var seen = {};
    var out = [];
    list.forEach(function (q) {
      var fp = questionFingerprint(q);
      if (!seen[fp]) { seen[fp] = true; out.push(q); }
    });
    return out;
  }

  function dedupeMasterQuestions() {
    if (!state.master) return;
    var before = state.master.questions.length;
    state.master.questions = dedupeQuestionList(state.master.questions);
    if (state.master.questions.length !== before) {
      markMasterDirty();
      if (state.bank) {
        var kept = [];
        var keptAnswers = [];
        var seen = {};
        state.bank.questions.forEach(function (q, i) {
          var fp = questionFingerprint(q);
          if (!seen[fp]) { seen[fp] = true; kept.push(q); keptAnswers.push(state.answers[i]); }
        });
        state.bank.questions = kept;
        state.answers = keptAnswers;
        if (state.current >= kept.length) state.current = Math.max(0, kept.length - 1);
      }
      saveState();
    }
  }

  function syncEmbeddedQuestions() {
    if (!state.master || !window.BUNDLED_BANK || !Array.isArray(window.BUNDLED_BANK.questions)) return;
    var existing = {};
    state.master.questions.forEach(function (q) { existing[questionFingerprint(q)] = true; });
    var maxId = state.master.questions.reduce(function (m, q) { return Math.max(m, Number(q.id) || 0); }, 0);
    var changed = false;
    window.BUNDLED_BANK.questions.forEach(function (q) {
      var norm;
      try {
        norm = normalizeBank({ title: 'sync', categories: [], composite: {}, questions: [q] }).questions[0];
      } catch (e) { return; }
      var fp = questionFingerprint(norm);
      if (existing[fp]) return;
      existing[fp] = true;
      maxId += 1;
      norm.id = maxId;
      state.master.questions.push(norm);
      changed = true;
    });
    if (changed) { markMasterDirty(); saveState(); }
  }

  function syncEmbeddedImages() {
    if (!state.master || !window.BUNDLED_BANK || !Array.isArray(window.BUNDLED_BANK.questions)) return;
    var map = {};
    window.BUNDLED_BANK.questions.forEach(function (q) {
      if (q.images && q.images.length) map[String(q.id)] = q.images.slice();
    });
    var changed = false;
    state.master.questions.forEach(function (q) {
      if (map[String(q.id)] && (!q.images || !q.images.length)) {
        q.images = map[String(q.id)].slice();
        changed = true;
      }
    });
    if (state.bank && state.bank.questions) {
      state.bank.questions.forEach(function (q) {
        if (map[String(q.id)] && (!q.images || !q.images.length)) q.images = map[String(q.id)].slice();
      });
    }
    var embeddedWeights = window.BUNDLED_BANK.composite && window.BUNDLED_BANK.composite.weights;
    if (embeddedWeights && state.master.composite && state.master.composite.weights) {
      Object.keys(embeddedWeights).forEach(function (k) {
        if (state.master.composite.weights[k] !== embeddedWeights[k]) {
          state.master.composite.weights[k] = embeddedWeights[k];
          changed = true;
        }
      });
      if (state.bank && state.bank.composite && state.bank.composite.weights) {
        Object.keys(embeddedWeights).forEach(function (k) {
          state.bank.composite.weights[k] = embeddedWeights[k];
        });
      }
    }
    if (window.BUNDLED_BANK.title && state.master.title !== window.BUNDLED_BANK.title) {
      state.master.title = window.BUNDLED_BANK.title;
      changed = true;
    }
    if (state.bank && window.BUNDLED_BANK.title) {
      state.bank.title = window.BUNDLED_BANK.title + (state.modeName ? ' · ' + state.modeName : '');
    }
    if (changed) { markMasterDirty(); saveState(); }
  }

  $('#fileInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { importFromText(String(reader.result || '')); };
    reader.onerror = function () { showImportError('读取文件失败'); };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });

  var dropzone = $('#dropzone');
  dropzone.addEventListener('click', function () { $('#fileInput').click(); });
  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); }
  });
  dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { importFromText(String(reader.result || '')); };
    reader.onerror = function () { showImportError('读取文件失败'); };
    reader.readAsText(file, 'utf-8');
  });

  $('#pasteImportBtn').addEventListener('click', function () { importFromText($('#jsonInput').value); });
  $('#jsonInput').addEventListener('input', function () { $('#importError').hidden = true; });
  $('#accountLoginBtn').addEventListener('click', function () { accountLogin(false); });
  $('#accountRegisterBtn').addEventListener('click', function () { state.view = 'register'; renderAll(); });
  $('#registerSubmitBtn').addEventListener('click', accountRegister);
  $('#registerBackBtn').addEventListener('click', function () { state.view = 'login'; renderAll(); });
  $('#accountLogoutBtn').addEventListener('click', accountLogout);
  $('#accountSaveBtn').addEventListener('click', saveAccountNow);
;
  $('#exportDataBtn').addEventListener('click', exportData);
  $('#importDataBtn').addEventListener('click', toggleImport);
  $('#importDataConfirmBtn').addEventListener('click', function () { importDataFromText($('#importDataText').value); });
  $('#importDataFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { importDataFromText(String(reader.result || '')); };
    reader.onerror = function () { dataSyncStatus('读取文件失败'); };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });


  $('#backFromImportBtn').addEventListener('click', function () {
    state.view = state.bank ? 'quiz' : 'mode';
    saveState();
    renderAll();
  });
  $('#sheetToggleBtn').addEventListener('click', function () {
    document.querySelector('.quiz-layout').classList.toggle('show-sheet');
  });

  $('#modeGrid').addEventListener('click', function (e) {
    var card = e.target.closest('[data-mode]');
    if (!card) return;
    loadMode(card.dataset.mode);
  });

  $('#app').addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    if (action === 'option') onOptionClick(target);
    if (action === 'confirm') submitMultiple();
    if (action === 'jump') goTo(Number(target.dataset.index));
    if (action === 'prev') goPrev();
    if (action === 'next') goNext();
    if (action === 'edit-question') openQuestionForm(target.dataset.id);
    if (action === 'delete-question') deleteQuestion(target.dataset.id);
    if (action === 'select-question') toggleEditorSelect(target.dataset.id);
    if (action === 'toggle-done') toggleQuestionDone(target.dataset.id);
  });

  $('#wrongBankBtn').addEventListener('click', function () {
    state.view = 'wrong';
    saveState();
    renderAll();
  });
  $('#editBankBtn').addEventListener('click', function () {
    state.view = 'editor';
    state.editorDirty = false;
    state.editorSelected = new Set();
    state.editorCatFilter = 'all';
    state.editorSearch = '';
    state.editorDoneFilter = 'all';
    state.editorPage = 0;
    $('#editorSearch').value = '';
    saveState();
    renderAll();
  });
  $('#changeBankBtn').addEventListener('click', changeBank);
  $('#restartBtn').addEventListener('click', function () {
    if (state.bank && !state.submitted) {
      state.view = 'quiz';
      saveState();
      renderAll();
      return;
    }
    state.view = 'mode';
    saveState();
    renderAll();
  });
  $('#reselectInQuizBtn').addEventListener('click', function () {
    if (state.bank && !state.submitted && state.answers.some(Boolean) && !confirm('确定放弃当前试卷并重新选择模式吗？')) return;
    state.view = 'mode';
    saveState();
    renderAll();
  });
  $('#continueBtn').addEventListener('click', function () {
    state.view = 'quiz';
    state.submitted = false;
    saveState();
    renderAll();
  });
  $('#reselectModeBtn').addEventListener('click', function () {
    state.view = 'mode';
    saveState();
    renderAll();
  });
  $('#retryWrongBtn').addEventListener('click', retryWrong);
  $('#exportWrongBtn').addEventListener('click', exportWrong);

  $('#wrongFilterTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.wrongFilter = btn.dataset.filter;
    saveState();
    renderStoredWrong();
  });
  $('#backFromWrongBtn').addEventListener('click', function () {
    state.view = state.bank ? 'quiz' : 'mode';
    saveState();
    renderAll();
  });
  $('#retryStoredWrongBtn').addEventListener('click', retryStoredWrong);
  $('#exportStoredWrongBtn').addEventListener('click', exportStoredWrong);
  $('#clearStoredWrongBtn').addEventListener('click', function () {
    var list = loadStoredWrong();
    if (!list.length) { alert('错题库已经是空的'); return; }
    if (!confirm('确定清空错题库吗？此操作不可恢复。')) return;
    clearStoredWrong();
    renderStoredWrong();
  });

  $('#addQuestionBtn').addEventListener('click', function () { openQuestionForm(-1); });
  $('#selectAllBtn').addEventListener('click', selectAllQuestions);
  $('#clearSelectBtn').addEventListener('click', clearSelectedQuestions);
  $('#deleteSelectedBtn').addEventListener('click', deleteSelectedQuestions);
  $('#exportSelectedBtn').addEventListener('click', exportSelectedQuestions);
  $('#editorSearch').addEventListener('input', function () {
    state.editorSearch = this.value;
    state.editorPage = 0;
    state.editorSelected = new Set();
    renderEditorList();
  });
  $('#editorDoneTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-done]');
    if (!btn) return;
    state.editorDoneFilter = btn.dataset.done;
    state.editorPage = 0;
    state.editorSelected = new Set();
    renderEditorList();
  });
  $('#editorPager').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pager]');
    if (!btn) return;
    if (btn.dataset.pager === 'prev' && state.editorPage > 0) state.editorPage -= 1;
    if (btn.dataset.pager === 'next') state.editorPage += 1;
    renderEditorList();
  });
  $('#editorCatTabs').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.editorCatFilter = btn.dataset.cat;
    state.editorPage = 0;
    state.editorSelected = new Set();
    renderEditorList();
  });
  $('#editImages').addEventListener('input', renderEditImagesPreview);
  $('#saveQuestionBtn').addEventListener('click', saveQuestionFromForm);
  $('#cancelQuestionBtn').addEventListener('click', function () { $('#questionEditor').hidden = true; });
  $('#editType').addEventListener('change', function () { renderEditTypeControls(null); });
  $('#saveBankBtn').addEventListener('click', saveBankFromEditor);
  $('#exportBankBtn').addEventListener('click', exportBankFromEditor);
  $('#backFromEditorBtn').addEventListener('click', backFromEditor);

  document.addEventListener('keydown', function (e) {
    if (state.view !== 'quiz' || !state.bank) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
    var ans = state.answers[state.current];
    if (/^[1-6]$/.test(e.key)) {
      var idx = Number(e.key) - 1;
      var q = state.bank.questions[state.current];
      if (idx < q.options.length && !ans) {
        var optBtn = $$('#questionPanel .option-btn')[idx];
        if (optBtn) { e.preventDefault(); optBtn.click(); }
      }
    }
    if (e.key === 'Enter') {
      var confirmBtn = $('#questionPanel .confirm-btn');
      if (confirmBtn && !ans) { e.preventDefault(); confirmBtn.click(); return; }
      if (ans) { e.preventDefault(); $('#nextBtn').click(); }
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  });

  (async function () {
    migrateLegacyMaster();
    try {
      var saved = await idbGet(IDB_KEY);
      if (saved && saved.bank && Array.isArray(saved.bank.questions) && saved.bank.questions.length) {
        state.master = normalizeBank(saved.bank);
        stripDoneFlags(state.master);
        state.bankVersion = Number(saved.version) || EMBEDDED_BANK_VERSION;
        state.masterStamp = Number(saved.stamp) || 0;
      }
    } catch (e) { /* IndexedDB 不可用时使用内置题库 */ }
    if (!state.master) resetToEmbeddedBank();
    restoreState();
    if (state.master) {
      rebuildPoolIndex();
      dedupeMasterQuestions();
      syncEmbeddedImages();
      syncEmbeddedQuestions();
    }
    state.view = 'login';
    renderAll();
  })();
  window.addEventListener('beforeunload', function () {
    try { flushMasterSave(); } catch (e) { /* ignore */ }
  });
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { try { flushMasterSave(); } catch (e) { /* ignore */ } }
  });
})();

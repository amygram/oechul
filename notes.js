/* 메모(블로그 소재·티켓·행사)와 달력. 외출준비와 같은 Supabase 'lists' 표를 쓰되 id로 구분한다:
   n_… = 메모 한 줄, _cats = 분류 목록, _pin = 메모 잠금 번호(해시) */
(function () {
  'use strict';
  var DEF = [{ k: 'blog', label: '블로그', c: 0 }, { k: 'ticket', label: '티켓', c: 1 }, { k: 'event', label: '행사', c: 2 }];
  var PAL = 6, MAXC = 12;
  var LS = 'chaeng-notes-v1', LSU = 'chaeng-unlocked';
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function cp(c) { return { k: c.k, label: c.label, c: c.c }; }
  function okCat(c) { return !!c && typeof c.k === 'string' && c.k && typeof c.label === 'string' && c.label && Number.isInteger(c.c) && c.c >= 0 && c.c < PAL; }
  function isMine(id) { return id === '_cats' || id === '_pin' || String(id).indexOf('n_') === 0; }

  var N = { notes: [], cats: DEF.map(cp), pin: '' };
  var busy = {}, chain = {}, failed = {};
  var M = { tab: 'all', cat: 'blog', pick: '', composer: false, manage: false, addCat: false, pinMode: '', editDate: null, catPick: null,
    ask: null, askAt: 0, subFor: null, subAsk: null, subAskAt: 0, showDone: false, armedCat: null, armAt: 0, err: '', focus: null };
  var C = { y: 0, m: 0, sel: '', cat: '' };

  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function mkDate(y, m, d) { var x = new Date(y, m - 1, d); return (x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d) ? x : null; }
  function parts(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function dd(s) { return Math.round((parts(s) - today()) / 86400000); }
  function ddLabel(n) { return n === 0 ? '오늘' : n > 0 ? 'D-' + n : Math.abs(n) + '일 지남'; }
  function fShort(s) { var d = parts(s); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ')'; }
  function fLong(s) { var d = parts(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일'; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function newId(p) { return p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); }
  function say(msg) { try { toast(msg, function () {}); var b = document.getElementById('toastBtn'); if (b) b.hidden = true; } catch (e) {} }

  /* ---------- 날짜 읽기 ("내일", "토", 10/25 …) ---------- */
  var DOW = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  function parseDate(text, cat) {
    var t0 = today(), y = t0.getFullYear(), hit = null, date = null;
    var UNITS = '컵|개|kg|g|ml|L|%|인분|병|봉|장|판|통|캔|큰술|작은술|스푼|숟갈';
    function fix(mm, d) { var x = mkDate(y, mm, d); if (!x) return null; if (cat !== 'blog' && (t0 - x) / 86400000 > 60) x = mkDate(y + 1, mm, d); return x; }
    function tryRe(re, fn) { if (date) return; var mt = text.match(re); if (!mt) return; var d = fn(mt); if (d) { date = d; hit = mt.hit || mt[0]; } }
    tryRe(/(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})/, function (m) { return mkDate(+m[1], +m[2], +m[3]); });
    tryRe(/(\d{1,2})\s*월\s*(\d{1,2})\s*일(?!간|째)/, function (m) { return fix(+m[1], +m[2]); });
    tryRe(new RegExp('(^|[^\\d/])(\\d{1,2})\\s*/\\s*(\\d{1,2})(?![\\d/]|\\s*(?:' + UNITS + '))'), function (m) { var d = fix(+m[2], +m[3]); if (d) m.hit = m[0].slice(m[1].length); return d; });
    tryRe(/내일\s*모레|내일|모레|글피|오늘/, function (m) { var map = { '내일모레': 2, '내일': 1, '모레': 2, '글피': 3, '오늘': 0 }; return addDays(t0, map[m[0].replace(/\s/g, '')]); });
    tryRe(/(\d{1,3})\s*(일|주)\s*(?:뒤|후)/, function (m) { return addDays(t0, +m[1] * (m[2] === '주' ? 7 : 1)); });
    tryRe(/(다다음\s?주|다음\s?주|이번\s?주)?\s*([일월화수목금토])요일/, function (m) {
      var tg = DOW[m[2]], cur = t0.getDay();
      if (!m[1]) return addDays(t0, ((tg - cur + 6) % 7) + 1);
      var mon = addDays(t0, -((cur + 6) % 7)), w = m[1].charAt(0) === '이' ? 0 : (m[1].indexOf('다다') === 0 ? 2 : 1);
      return addDays(mon, w * 7 + ((tg + 6) % 7));
    });
    tryRe(/^(\s*)([월화수목금토])(?=\s+\S)/, function (m) { var tg = DOW[m[2]], cur = t0.getDay(); m.hit = m[0].slice(m[1].length); return addDays(t0, ((tg - cur + 6) % 7) + 1); });
    var rest = text.trim();
    if (hit) {
      var r = text.replace(hit, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,:：·\-–]+|[\s,:：·\-–]+$/g, '');
      r = r.replace(/^(에서|에는|까지|부터|에|은|는)(\s+|$)/, '').trim();
      if (r) rest = r;
    }
    return { date: date ? ymd(date) : '', text: rest };
  }

  /* ---------- 분류 ---------- */
  function catInfo(k) {
    for (var i = 0; i < N.cats.length; i++) if (N.cats[i].k === k) return N.cats[i];
    return { k: k, label: k === 'prep' ? '준비물' : '기타', c: k === 'prep' ? 3 : 5, virtual: true };
  }
  function orderOf(k) { for (var i = 0; i < N.cats.length; i++) if (N.cats[i].k === k) return i; return 99; }
  function live() { return N.notes.filter(function (n) { return !n.deletedAt; }); }
  function countIn(k) { return live().filter(function (n) { return n.cat === k; }).length; }
  function usedKeys() {
    var ks = N.cats.map(function (c) { return c.k; });
    live().forEach(function (n) { if (n.cat && ks.indexOf(n.cat) < 0) ks.push(n.cat); });
    return ks;
  }
  function fixSel() {
    if (!N.cats.some(function (c) { return c.k === M.cat; })) M.cat = N.cats[0] ? N.cats[0].k : '';
    if (!N.cats.some(function (c) { return c.k === C.cat; })) C.cat = N.cats[0] ? N.cats[0].k : '';
    if (M.tab !== 'all' && usedKeys().indexOf(M.tab) < 0) M.tab = 'all';
  }

  /* ---------- 잠금 ---------- */
  function unlocked() { if (!N.pin) return true; try { return sessionStorage.getItem(LSU) === N.pin; } catch (e) { return false; } }
  function setUnlocked(on) { try { if (on) sessionStorage.setItem(LSU, N.pin); else sessionStorage.removeItem(LSU); } catch (e) {} }
  async function hashPin(p) {
    try {
      if (window.crypto && crypto.subtle) {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oechul:' + p));
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return pad2(b.toString(16)); }).join('');
      }
    } catch (e) {}
    var h = 5381; for (var i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) | 0;
    return 'x' + h;
  }
  function pad2(s) { return s.length < 2 ? '0' + s : s; }

  /* ---------- 저장 ---------- */
  function cache() { try { localStorage.setItem(LS, JSON.stringify({ notes: N.notes, cats: N.cats, pin: N.pin })); } catch (e) {} }
  function loadCache() {
    try {
      var c = JSON.parse(localStorage.getItem(LS) || 'null');
      if (c) {
        if (Array.isArray(c.notes)) N.notes = c.notes;
        if (Array.isArray(c.cats)) { var l = c.cats.filter(okCat).map(cp); if (l.length) N.cats = l; }
        if (typeof c.pin === 'string') N.pin = c.pin;
      }
    } catch (e) {}
    fixSel();
  }
  function docOf(id) {
    if (id === '_cats') return { list: N.cats };
    if (id === '_pin') return { h: N.pin };
    var n = N.notes.filter(function (x) { return x.id === id; })[0];
    if (!n) return null;
    var o = {}; Object.keys(n).forEach(function (k) { if (k !== 'id') o[k] = n[k]; });
    return o;
  }
  function put(id) {
    cache();
    busy[id] = (busy[id] || 0) + 1;
    chain[id] = (chain[id] || Promise.resolve()).then(async function () {
      await ready;
      var body = docOf(id); if (!body) return;
      var r = await sb.from('lists').upsert({ id: id, data: JSON.parse(JSON.stringify(body)), updated_at: new Date().toISOString() });
      if (r.error) throw r.error;
      delete failed[id];
    }).catch(function () { failed[id] = 1; say('저장하지 못했어요. 연결되면 다시 올려요.'); })
      .then(function () { busy[id]--; if (!busy[id]) delete busy[id]; });
  }
  async function removeRow(id) {
    cache();
    try { await ready; var r = await sb.from('lists').delete().eq('id', id); if (r.error) throw r.error; }
    catch (e) { say('지우지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
  }
  function resync() { Object.keys(failed).forEach(function (id) { put(id); }); }

  /* 서버에서 받은 행들 중 메모 쪽을 가져가고, 외출준비 목록 행만 돌려준다 */
  function sync(rows) {
    var incoming = [], cats = null, pin = null, rest = [];
    rows.forEach(function (r) {
      if (!isMine(r.id)) { rest.push(r); return; }
      var d = r.data || {};
      if (r.id === '_cats') { if (Array.isArray(d.list)) { var l = d.list.filter(okCat).map(cp); if (l.length) cats = l; } }
      else if (r.id === '_pin') { pin = typeof d.h === 'string' ? d.h : ''; }
      else { incoming.push(Object.assign({}, d, { id: r.id })); }
    });
    var keep = function (id) { return busy[id] || failed[id]; };
    var merged = incoming.map(function (n) { if (keep(n.id)) { var m = N.notes.filter(function (x) { return x.id === n.id; })[0]; if (m) return m; } return n; });
    N.notes.forEach(function (n) { if (keep(n.id) && !merged.some(function (x) { return x.id === n.id; })) merged.push(n); });
    N.notes = merged;
    if (!keep('_cats')) N.cats = cats || DEF.map(cp);
    if (!keep('_pin')) N.pin = pin || '';
    fixSel(); cache();
    return rest;
  }
  /* 실시간 변경 한 건: 메모 쪽이면 true */
  function live1(p) {
    var id = (p.new && p.new.id) || (p.old && p.old.id);
    if (!id || !isMine(id)) return false;
    if (busy[id] || failed[id]) return true;
    if (p.eventType === 'DELETE' || !p.new) { N.notes = N.notes.filter(function (n) { return n.id !== id; }); }
    else {
      var d = p.new.data || {};
      if (id === '_cats') { var l = Array.isArray(d.list) ? d.list.filter(okCat).map(cp) : []; N.cats = l.length ? l : DEF.map(cp); }
      else if (id === '_pin') { N.pin = typeof d.h === 'string' ? d.h : ''; }
      else {
        var n = Object.assign({}, d, { id: id }), i = N.notes.findIndex(function (x) { return x.id === id; });
        if (i >= 0) N.notes[i] = n; else N.notes.push(n);
      }
    }
    fixSel(); cache(); refresh();
    return true;
  }

  function patch(id, fn) {
    var n = N.notes.filter(function (x) { return x.id === id; })[0]; if (!n) return;
    fn(n); render(); put(id);
  }
  function saveCats(fn) { N.cats = fn(N.cats.map(cp)); fixSel(); render(); put('_cats'); }

  /* ---------- 그리기 ---------- */
  function kcls(k) { return 'k' + catInfo(k).c; }
  function tabNow() { try { return localStorage.getItem('chaeng-tab') || 'list'; } catch (e) { return 'list'; } }
  function root(t) { return document.getElementById(t === 'cal' ? 'calSec' : 'memoSec'); }

  function subBlock(n) {
    var subs = n.sub || [], done = subs.filter(function (s) { return s.done; }).length;
    var h = '<div class="nsubs"><div class="nsubhead">' + (subs.length ? '<span class="subcount">준비물 ' + done + '/' + subs.length + '</span>' : '') +
      (M.subFor === n.id ? '' : '<button class="btn ghost mini" data-act="nsubopen" data-n="' + n.id + '">' + (subs.length ? '+ 추가' : '+ 준비물') + '</button>') + '</div>';
    if (subs.length) {
      h += '<ul class="nsublist">' + subs.map(function (s) {
        var key = n.id + '|' + s.id, ask = M.subAsk === key;
        return '<li class="nsub' + (s.done ? ' done' : '') + '"><button class="tick small" data-act="nsubtick" data-n="' + n.id + '" data-s="' + s.id + '" aria-label="' + E(s.text) + ' 챙김">' + TICK + '</button>' +
          '<span class="txt">' + E(s.text) + '</span>' +
          (ask ? '<span class="askdel">지울까요?</span><button class="btn warn mini" data-act="nsubyes" data-n="' + n.id + '" data-s="' + s.id + '">지우기</button><button class="btn ghost mini" data-act="nsubno">취소</button>'
            : '<button class="del" data-act="nsubdel" data-n="' + n.id + '" data-s="' + s.id + '" aria-label="' + E(s.text) + ' 지우기">×</button>') + '</li>';
      }).join('') + '</ul>';
    }
    if (M.subFor === n.id) {
      h += '<form class="nsubform" data-nsub="' + n.id + '"><input data-keep="sub' + n.id + '" placeholder="예) 돗자리, 물통" maxlength="100" autocomplete="off" aria-label="준비물">' +
        '<button class="btn mini" type="submit">추가</button><button class="btn ghost mini" type="button" data-act="nsubclose">닫기</button></form>';
    }
    return h + '</div>';
  }

  function noteLi(n) {
    var ci = catInfo(n.cat), over = n.date && n.cat !== 'blog' && !n.done ? dd(n.date) : null;
    var h = '<li class="nitem k' + ci.c + (n.done ? ' done' : '') + '" data-n="' + n.id + '">' +
      '<button class="tick" data-act="ntick" data-n="' + n.id + '" aria-label="' + E(n.text) + ' ' + (n.done ? '체크 해제' : '챙김') + '">' + TICK + '</button>' +
      '<div class="nbody"><div class="txtwrap"><span class="txt">' + E(n.text) + '</span></div><div class="nmeta">' +
      '<button class="ntag" data-act="ncatpick" data-n="' + n.id + '" aria-label="분류 바꾸기: ' + E(ci.label) + '">' + E(ci.label) + '</button>';
    if (M.editDate === n.id) {
      h += '<input type="date" class="ndate" data-chg="idate" data-n="' + n.id + '" value="' + (n.date || '') + '" aria-label="날짜 바꾸기">' +
        (n.date ? '<button class="btn ghost mini" data-act="ndateclr" data-n="' + n.id + '">날짜 지우기</button>' : '') +
        '<button class="btn ghost mini" data-act="ndateclose">닫기</button>';
    } else {
      h += '<button class="nwhen' + (n.date ? '' : ' ghost') + '" data-act="ndate" data-n="' + n.id + '">' + (n.date ? fShort(n.date) + (n.cat === 'ticket' ? '까지' : '') : '날짜 넣기') + '</button>';
      if (over !== null) h += '<span class="dday small' + (over <= 1 ? ' urgent' : '') + '">' + ddLabel(over) + '</span>';
    }
    h += '</div>';
    if (M.catPick === n.id) {
      h += '<div class="nchips">' + N.cats.map(function (c) {
        return '<button class="nchip k' + c.c + '" aria-pressed="' + (c.k === n.cat) + '" data-act="nsetcat" data-n="' + n.id + '" data-k="' + c.k + '">' + E(c.label) + '</button>';
      }).join('') + '<button class="btn ghost mini" data-act="ncatclose">닫기</button></div>';
    }
    h += subBlock(n);
    if (M.ask === n.id) {
      var ns = (n.sub || []).length;
      h += '<div class="confirm"><span>' + (ns ? '이 메모와 준비물 ' + ns + '개를 지울까요?' : '이 메모를 지울까요?') + '</span><button class="btn ghost mini" data-act="ndelno">취소</button><button class="btn warn mini" data-act="ndelyes" data-n="' + n.id + '">지우기</button></div>';
    }
    h += '</div>' + (M.ask === n.id ? '' : '<button class="del" data-act="ndel" data-n="' + n.id + '" aria-label="' + E(n.text) + ' 지우기">×</button>') + '</li>';
    return h;
  }
  function group(title, cls, arr) {
    return '<section class="ngroup ' + cls + '"><h3>' + title + '<span class="n">' + arr.length + '개</span></h3><ul>' + arr.map(noteLi).join('') + '</ul></section>';
  }
  function byDate(a, b) { return a.date !== b.date ? (a.date < b.date ? -1 : 1) : (b.created || 0) - (a.created || 0); }
  function byNew(a, b) { return (b.created || 0) - (a.created || 0); }
  function dated(n) { return !!n.date && n.cat !== 'blog'; }

  function manageHTML() {
    var h = '<div class="nmanage"><h3>분류 관리</h3><p class="memo">이름을 눌러 고치고, 동그라미로 색을, 화살표로 순서를 바꿔요. 항목이 들어 있는 분류는 지울 수 없어요.</p><ul class="ncatlist">';
    usedKeys().forEach(function (k) {
      var ci = catInfo(k), n = countIn(k), idx = orderOf(k);
      if (ci.virtual) {
        h += '<li class="ncatrow k' + ci.c + '"><span class="cdot"></span><span class="ncatname static">' + E(ci.label) + '</span><span class="memo">' + n + '개</span><button class="btn ghost mini" data-act="mreg" data-k="' + E(k) + '">분류에 추가</button></li>';
        return;
      }
      var ask = M.armedCat === k;
      h += '<li class="ncatrow k' + ci.c + '"><button class="cdotbtn" data-act="mcol" data-k="' + k + '" aria-label="' + E(ci.label) + ' 색 바꾸기"><span class="cdot"></span></button>' +
        '<input class="ncatname" data-chg="mrename" data-k="' + k + '" value="' + E(ci.label) + '" maxlength="10" aria-label="분류 이름"><span class="memo">' + n + '개</span>' +
        '<button class="icon" data-act="mmove" data-k="' + k + '" data-d="-1" ' + (idx <= 0 ? 'disabled' : '') + ' aria-label="' + E(ci.label) + ' 위로">▲</button>' +
        '<button class="icon" data-act="mmove" data-k="' + k + '" data-d="1" ' + (idx >= N.cats.length - 1 ? 'disabled' : '') + ' aria-label="' + E(ci.label) + ' 아래로">▼</button>' +
        '<button class="del" data-act="mdel" data-k="' + k + '" aria-label="' + E(ci.label) + ' 지우기">×</button></li>';
      if (ask) h += '<li class="confirm"><span>"' + E(ci.label) + '" 분류를 지울까요?</span><button class="btn ghost mini" data-act="mdelno">취소</button><button class="btn warn mini" data-act="mdelyes" data-k="' + k + '">지우기</button></li>';
    });
    h += '</ul><form class="nsubform" id="mNew"><input data-keep="mnew" maxlength="10" placeholder="새 분류 이름" autocomplete="off" aria-label="새 분류 이름"><button class="btn mini" type="submit">만들기</button></form></div>';
    return h;
  }

  function pickChips() {
    var t = today(), sat = (6 - t.getDay() + 7) % 7;
    var opts = [['오늘', ymd(t)], ['내일', ymd(addDays(t, 1))], ['이번 토', ymd(addDays(t, sat))], ['다음 토', ymd(addDays(t, sat + 7))]];
    var matched = false, h = '';
    opts.forEach(function (o) {
      var on = !matched && M.pick === o[1]; if (on) matched = true;
      h += '<button type="button" class="nchip" aria-pressed="' + on + '" data-act="npick" data-v="' + o[1] + '">' + o[0] + '</button>';
    });
    var custom = !!M.pick && !matched;
    h += '<label class="nchip pick" aria-pressed="' + custom + '"><span>' + (custom ? fShort(M.pick) : '📅 날짜 고르기') + '</span><input type="date" class="dpick" data-chg="pickdate" value="' + (M.pick || '') + '" aria-label="날짜 고르기"></label>';
    if (M.pick) h += '<button type="button" class="nchip" data-act="npickclr">날짜 지우기</button>';
    return h;
  }
  function composerHTML() {
    var h = '<form class="ncomp" id="nComposer" autocomplete="off"><div class="crow"><input id="nText" data-keep="ntext" maxlength="300" placeholder="예) 시댁 반찬통" enterkeyhint="done" aria-label="적어둘 내용"><button class="btn" type="submit">추가</button></div>' +
      '<p class="memo" id="nHint"></p><div class="nchips">' +
      N.cats.map(function (c) { return '<button type="button" class="nchip k' + c.c + '" aria-pressed="' + (M.cat === c.k) + '" data-act="ncat" data-k="' + c.k + '">' + E(c.label) + '</button>'; }).join('') +
      '<button type="button" class="nchip dashed" data-act="naddcat">+ 분류</button></div>';
    if (M.addCat) h += '<div class="nsubform"><input id="nCatName" data-keep="ncatname" maxlength="10" placeholder="새 분류 이름" autocomplete="off" aria-label="새 분류 이름"><button type="button" class="btn mini" data-act="naddcatok">만들기</button><button type="button" class="btn ghost mini" data-act="naddcatcancel">취소</button></div>';
    h += '<p class="memo">날짜 (안 고르면 날짜 없이 저장돼요)</p><div class="nchips">' + pickChips() + '</div>' +
      '<div class="tools"><button type="button" class="btn ghost mini" data-act="ncompclose">닫기</button></div></form>';
    return h;
  }

  function lockScreen() {
    return '<div class="head"><div><h2>🔒 메모</h2><div class="date">숫자 4자리를 넣어 주세요</div></div></div>' +
      '<form class="loginf" id="nUnlock"><input data-keep="unl" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="4자리" aria-label="비밀번호 4자리"><button class="btn" type="submit">열기</button><p class="memo" id="nErr">' + E(M.err) + '</p></form>';
  }
  function lockMenu() {
    if (M.pinMode === 'set') return '<form class="loginf" id="nPinSet"><p class="memo">남편분이 실수로 열어 보지 않게 숫자 4자리를 정해요. (같은 로그인을 쓰므로 완전한 보안은 아니에요)</p><input data-keep="pin1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="4자리" aria-label="새 비밀번호"><div class="tools"><button class="btn ghost mini" type="button" data-act="lockclose">닫기</button><button class="btn mini" type="submit">잠금 켜기</button></div><p class="memo">' + E(M.err) + '</p></form>';
    if (M.pinMode === 'off') return '<div class="confirm"><span>메모 잠금을 풀까요?</span><button class="btn ghost mini" data-act="lockclose">취소</button><button class="btn warn mini" data-act="lockoff">잠금 풀기</button></div>';
    return '';
  }

  function memoHTML() {
    if (!unlocked()) return lockScreen();
    var all = live(), open = all.filter(function (n) { return !n.done; });
    var h = '<div class="head"><div><h2>메모</h2><div class="date">블로그 소재·티켓·행사를 한 줄씩</div></div>' +
      '<button class="btn ghost mini" data-act="lockmenu">' + (N.pin ? '🔒 잠금 풀기' : '🔓 잠금') + '</button></div>' + lockMenu();
    var tabs = [{ k: 'all', label: '전체', n: open.length }].concat(usedKeys().map(function (k) { return { k: k, label: catInfo(k).label, n: open.filter(function (i) { return i.cat === k; }).length, c: catInfo(k).c }; }));
    h += '<div class="nchips scroll">' + tabs.map(function (t) {
      return '<button class="nchip ' + (t.k === 'all' ? '' : 'k' + t.c) + '" aria-pressed="' + (M.tab === t.k) + '" data-act="ntab" data-k="' + E(t.k) + '">' + E(t.label) + ' <small>' + t.n + '</small></button>';
    }).join('') + '<button class="nchip dashed" aria-pressed="' + M.manage + '" data-act="nmanage">분류 편집</button></div>';
    if (M.manage) h += manageHTML();
    h += M.composer ? composerHTML() : '<button class="newbtn" data-act="nnew">+ 새로 적기</button>';

    var shown = M.tab === 'all' ? all : all.filter(function (n) { return n.cat === M.tab; });
    if (!all.length) {
      h += '<div class="empty"><b>아직 적어둔 게 없어요</b>위의 새로 적기를 눌러 한 줄씩 적어요. 날짜는 고르거나 글에 내일, 토, 10/25처럼 써도 읽어요.</div>';
    } else if (!shown.length) {
      h += '<div class="empty"><b>' + E(catInfo(M.tab).label) + '은(는) 아직 없어요</b>새로 적기에서 이 분류를 고르면 여기에 쌓여요.</div>';
    } else {
      var op = shown.filter(function (n) { return !n.done; });
      var soon = op.filter(function (n) { return dated(n) && dd(n.date) <= 7; }).sort(byDate);
      var rest = op.filter(function (n) { return !(dated(n) && dd(n.date) <= 7); }).sort(function (a, b) {
        var x = dated(a), y = dated(b); if (x && y) return byDate(a, b); if (x) return -1; if (y) return 1; return byNew(a, b);
      });
      var done = shown.filter(function (n) { return n.done; }).sort(byNew);
      if (soon.length) h += group('7일 안에 챙길 것', 'soon', soon);
      if (rest.length) h += group(soon.length ? '그 밖의 메모' : '적어둔 메모', 'rest', rest);
      if (done.length) {
        h += '<button class="btn ghost" data-act="ndone">' + (M.showDone ? '완료 ' + done.length + '개 접기' : '완료 ' + done.length + '개 보기') + '</button>';
        if (M.showDone) h += group('완료', 'done', done);
      }
    }
    return h;
  }

  /* ---------- 달력 ---------- */
  function calHTML() {
    var y = C.y, m = C.m, h = '<div class="calnav"><h2>' + y + '년 ' + (m + 1) + '월</h2><button class="btn ghost mini" data-act="ctoday">오늘</button>' +
      '<button class="icon big" data-act="cprev" aria-label="이전 달">‹</button><button class="icon big" data-act="cnext" aria-label="다음 달">›</button></div>';
    h += '<div class="cdow">' + WD.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>';
    var showNotes = unlocked(), by = {};
    (typeof lists !== 'undefined' ? lists : []).forEach(function (l) { if (l.date && !l.deletedAt) (by[l.date] = by[l.date] || { l: [], n: [] }).l.push(l); });
    if (showNotes) live().forEach(function (n) { if (n.date) (by[n.date] = by[n.date] || { l: [], n: [] }).n.push(n); });
    var first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate(), ts = ymd(today());
    h += '<div class="cdays">';
    for (var b = 0; b < first; b++) h += '<span class="cday blank"></span>';
    for (var d = 1; d <= dim; d++) {
      var ds = y + '-' + pad(m + 1) + '-' + pad(d), g = by[ds], dots = '';
      if (g) {
        if (g.l.length) dots += '<i class="cdot dl"></i>';
        var seen = {};
        g.n.filter(function (n) { return !n.done; }).sort(function (a, c) { return orderOf(a.cat) - orderOf(c.cat); }).forEach(function (n) {
          if (!seen[n.cat] && dots.split('<i').length < 5) { seen[n.cat] = 1; dots += '<i class="cdot k' + catInfo(n.cat).c + '"></i>'; }
        });
        if (!dots) dots = '<i class="cdot dn"></i>';
      }
      h += '<button class="cday' + (ds === ts ? ' today' : '') + (ds === C.sel ? ' sel' : '') + '" data-act="cday" data-d="' + ds + '" aria-pressed="' + (ds === C.sel) + '" aria-label="' + (m + 1) + '월 ' + d + '일"><span class="num">' + d + '</span><span class="cdots">' + dots + '</span></button>';
    }
    h += '</div>';
    if (C.sel) {
      var g2 = by[C.sel] || { l: [], n: [] };
      h += '<h3 class="daytitle">' + fLong(C.sel) + '</h3>';
      if (g2.l.length) h += '<div class="lcards">' + g2.l.map(function (l) {
        var v = (l.items || []).filter(function (i) { return !i.deletedAt; }), dn = v.filter(function (i) { return i.done; }).length;
        return '<button class="lcard" data-act="golist" data-l="' + l.id + '"><strong>' + E(l.name) + '</strong><span>' + (v.length ? dn + ' / ' + v.length + ' 챙김' : '준비물 없음') + '</span></button>';
      }).join('') + '</div>';
      if (g2.n.length) h += '<ul>' + g2.n.sort(function (a, b) { return (a.done - b.done) || byNew(a, b); }).map(noteLi).join('') + '</ul>';
      if (!showNotes) h += '<p class="memo">🔒 메모는 잠겨 있어요. 메모 탭에서 열면 여기에도 보여요.</p>';
      if (!g2.l.length && !g2.n.length && showNotes) h += '<p class="memo">이 날은 적어둔 게 없어요.</p>';
      if (showNotes) {
        h += '<form class="nday nsubform" id="nDay"><input data-keep="nday" maxlength="300" placeholder="이 날 일정·메모 적기" autocomplete="off" aria-label="이 날 적기"><select id="nDayCat" aria-label="분류">' +
          N.cats.map(function (c) { return '<option value="' + c.k + '"' + (c.k === C.cat ? ' selected' : '') + '>' + E(c.label) + '</option>'; }).join('') + '</select><button class="btn mini" type="submit">추가</button></form>';
      }
    } else h += '<p class="memo">날짜를 누르면 그날의 목록과 메모가 나와요.</p>';
    return h;
  }

  /* 다시 그리면서 입력 중이던 글자와 커서 위치를 지키고, 키보드는 되살리지 않는다 */
  function paint(el, html) {
    var keep = {}, active = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute('data-keep') : null;
    var sel = null;
    el.querySelectorAll('[data-keep]').forEach(function (i) { keep[i.getAttribute('data-keep')] = i.value; });
    if (active) { var a = document.activeElement; try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) {} }
    el.innerHTML = html;
    el.querySelectorAll('[data-keep]').forEach(function (i) { var v = keep[i.getAttribute('data-keep')]; if (v != null) i.value = v; });
    var f = M.focus; M.focus = null;
    if (f) { var t = el.querySelector(f); if (t) { try { t.focus(); } catch (e) {} } }
    else if (active) { var r = el.querySelector('[data-keep="' + active + '"]'); if (r) { try { r.focus({ preventScroll: true }); if (sel && sel[0] != null) r.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  }
  function hint() {
    var el = document.getElementById('nHint'), inp = document.getElementById('nText'); if (!el || !inp) return;
    var raw = inp.value.trim(), ci = catInfo(M.cat);
    if (!raw) { el.textContent = M.pick ? ci.label + ' · ' + fShort(M.pick) + ' · 내용을 적고 추가를 눌러요' : ci.label + ' · 날짜는 고르거나 글에 써도 돼요 (내일, 토)'; return; }
    var p = parseDate(raw, M.cat), d = M.pick || p.date;
    el.textContent = ci.label + (d ? ' · ' + fShort(d) + '에 들어가요' : ' · 날짜 없음 (아래에서 날짜를 고를 수 있어요)');
  }

  function render() {
    if ((typeof needLogin !== 'undefined' && needLogin)) return;
    var t = tabNow();
    if (t === 'memo') { var el = root('memo'); if (el) { paint(el, memoHTML()); hint(); } }
    else if (t === 'cal') {
      var c = root('cal');
      if (c) {
        if (!C.y) { var n = today(); C.y = n.getFullYear(); C.m = n.getMonth(); C.sel = ymd(n); }
        paint(c, calHTML());
      }
    }
  }
  function refresh() { render(); }

  /* ---------- 동작 ---------- */
  function addNote(text, cat, date) {
    N.notes.push({ id: 'n_' + newId(''), text: text, cat: cat, date: date || '', done: false, created: Date.now() });
    var n = N.notes[N.notes.length - 1]; put(n.id); return n;
  }
  function makeCat(raw) {
    var name = raw.trim().replace(/\s+/g, ' ');
    if (!name) return null;
    if (name.length > 10) { say('분류 이름은 10글자까지예요'); return null; }
    if (N.cats.length >= MAXC) { say('분류는 ' + MAXC + '개까지예요'); return null; }
    if (N.cats.some(function (c) { return c.label.toLowerCase() === name.toLowerCase(); })) { say('이미 있는 분류예요'); return null; }
    var used = N.cats.map(function (c) { return c.c; }), col = -1;
    for (var i = 0; i < PAL; i++) if (used.indexOf(i) < 0) { col = i; break; }
    if (col < 0) col = N.cats.length % PAL;
    var k = 'k' + newId('');
    saveCats(function (a) { return a.concat([{ k: k, label: name, c: col }]); });
    return k;
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-n'), k = el.getAttribute('data-k');
    var inCal = !!e.currentTarget.id && e.currentTarget.id === 'calSec';
    switch (a) {
      case 'ntab': M.tab = k; if (N.cats.some(function (c) { return c.k === k; })) M.cat = k; render(); hint(); return;
      case 'nnew': M.composer = true; M.focus = '#nText'; render(); hint(); try { document.getElementById('nComposer').scrollIntoView({ block: 'start' }); } catch (x) {} return;
      case 'ncompclose': M.composer = false; M.addCat = false; render(); return;
      case 'ncat': M.cat = k; render(); hint(); return;
      case 'naddcat': M.addCat = true; M.focus = '#nCatName'; render(); return;
      case 'naddcatcancel': M.addCat = false; render(); return;
      case 'naddcatok': { var inp = document.getElementById('nCatName'); var nk = makeCat(inp ? inp.value : ''); if (nk) { M.cat = nk; M.addCat = false; var ci = document.getElementById('nCatName'); if (ci) ci.value = ''; render(); hint(); say('분류를 만들었어요'); } return; }
      case 'npick': M.pick = M.pick === el.getAttribute('data-v') ? '' : el.getAttribute('data-v'); render(); hint(); return;
      case 'npickclr': M.pick = ''; render(); hint(); return;
      case 'nmanage': M.manage = !M.manage; M.armedCat = null; render(); return;
      case 'mcol': saveCats(function (arr) { return arr.map(function (c) { return c.k === k ? Object.assign({}, c, { c: (c.c + 1) % PAL }) : c; }); }); return;
      case 'mmove': { var from = orderOf(k), to = from + Number(el.getAttribute('data-d')); if (to < 0 || to >= N.cats.length) return; saveCats(function (arr) { var t = arr[from]; arr[from] = arr[to]; arr[to] = t; return arr; }); return; }
      case 'mreg': { var vi = catInfo(k); saveCats(function (arr) { return arr.concat([{ k: k, label: vi.label, c: vi.c }]); }); return; }
      case 'mdel':
        if (M.armedCat === k) { M.armedCat = null; render(); return; }
        if (countIn(k) > 0) { say('"' + catInfo(k).label + '"에 메모가 ' + countIn(k) + '개 있어요. 먼저 그 메모의 분류를 바꿔 주세요.'); return; }
        if (N.cats.length <= 1) { say('분류는 하나 이상 있어야 해요'); return; }
        M.armedCat = k; M.armAt = Date.now(); render(); return;
      case 'mdelno': M.armedCat = null; render(); return;
      case 'mdelyes': if (Date.now() - M.armAt < 500) return; M.armedCat = null; saveCats(function (arr) { return arr.filter(function (c) { return c.k !== k; }); }); return;
      case 'ntick': patch(id, function (n) { n.done = !n.done; }); return;
      case 'ndel': M.ask = id; M.askAt = Date.now(); M.subAsk = null; render(); return;
      case 'ndelno': M.ask = null; render(); return;
      case 'ndelyes': if (Date.now() - M.askAt < 500) return; M.ask = null; N.notes = N.notes.filter(function (n) { return n.id !== id; }); render(); removeRow(id); return;
      case 'ncatpick': M.catPick = M.catPick === id ? null : id; M.editDate = null; render(); return;
      case 'ncatclose': M.catPick = null; render(); return;
      case 'nsetcat': M.catPick = null; patch(id, function (n) { n.cat = k; }); return;
      case 'ndate': M.editDate = id; M.catPick = null; M.focus = '.ndate'; render(); return;
      case 'ndateclose': M.editDate = null; render(); return;
      case 'ndateclr': M.editDate = null; patch(id, function (n) { n.date = ''; }); return;
      case 'ndone': M.showDone = !M.showDone; render(); return;
      case 'nsubopen': M.subFor = id; M.focus = '[data-keep="sub' + id + '"]'; render(); return;
      case 'nsubclose': M.subFor = null; render(); return;
      case 'nsubtick': patch(id, function (n) { n.sub = (n.sub || []).map(function (s) { return s.id === el.getAttribute('data-s') ? Object.assign({}, s, { done: !s.done }) : s; }); }); return;
      case 'nsubdel': { var key = id + '|' + el.getAttribute('data-s'); M.subAsk = M.subAsk === key ? null : key; M.subAskAt = Date.now(); M.ask = null; render(); return; }
      case 'nsubno': M.subAsk = null; render(); return;
      case 'nsubyes': if (Date.now() - M.subAskAt < 500) return; M.subAsk = null; patch(id, function (n) { n.sub = (n.sub || []).filter(function (s) { return s.id !== el.getAttribute('data-s'); }); }); return;
      case 'lockmenu': M.err = ''; M.pinMode = N.pin ? 'off' : 'set'; M.focus = '[data-keep="pin1"]'; render(); return;
      case 'lockclose': M.pinMode = ''; render(); return;
      case 'lockoff': N.pin = ''; setUnlocked(false); M.pinMode = ''; render(); put('_pin'); say('메모 잠금을 풀었어요'); return;
      case 'cprev': { var d1 = new Date(C.y, C.m - 1, 1); C.y = d1.getFullYear(); C.m = d1.getMonth(); C.sel = ''; render(); return; }
      case 'cnext': { var d2 = new Date(C.y, C.m + 1, 1); C.y = d2.getFullYear(); C.m = d2.getMonth(); C.sel = ''; render(); return; }
      case 'ctoday': { var t0 = today(); C.y = t0.getFullYear(); C.m = t0.getMonth(); C.sel = ymd(t0); render(); return; }
      case 'cday': C.sel = C.sel === el.getAttribute('data-d') ? '' : el.getAttribute('data-d'); render(); return;
      case 'golist': if (window.goList) window.goList(el.getAttribute('data-l')); return;
    }
  }
  async function onSubmit(e) {
    var f = e.target;
    if (f.id === 'nComposer') {
      e.preventDefault();
      var inp = document.getElementById('nText'), raw = inp.value.trim(); if (!raw) return;
      var p = parseDate(raw, M.cat), date = M.pick || p.date, text = p.text || raw;
      addNote(text, M.cat, date); inp.value = ''; M.pick = ''; M.focus = '#nText'; render(); hint();
      say(catInfo(M.cat).label + '에 추가했어요' + (date ? ' · ' + fShort(date) : ''));
    } else if (f.id === 'nDay') {
      e.preventDefault();
      var di = f.querySelector('input'), v = di.value.trim(); if (!v) return;
      var sel = document.getElementById('nDayCat'); C.cat = sel.value;
      addNote(v, C.cat, C.sel); di.value = ''; render();
    } else if (f.id === 'mNew') {
      e.preventDefault();
      var ni = f.querySelector('input'); var k = makeCat(ni.value); if (k) { ni.value = ''; render(); }
    } else if (f.getAttribute('data-nsub')) {
      e.preventDefault();
      var nid = f.getAttribute('data-nsub'), si = f.querySelector('input');
      var names = si.value.split(/\s*[,，]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); if (!names.length) return;
      si.value = ''; M.focus = '[data-keep="sub' + nid + '"]';
      patch(nid, function (n) { n.sub = (n.sub || []).concat(names.map(function (t) { return { id: newId('s'), text: t, done: false }; })); });
    } else if (f.id === 'nUnlock') {
      e.preventDefault();
      var v2 = f.querySelector('input').value.trim(), h = await hashPin(v2);
      if (h === N.pin) { setUnlocked(true); M.err = ''; render(); } else { M.err = '번호가 맞지 않아요'; var er = document.getElementById('nErr'); if (er) er.textContent = M.err; f.querySelector('input').value = ''; }
    } else if (f.id === 'nPinSet') {
      e.preventDefault();
      var pv = f.querySelector('input').value.trim();
      if (!/^\d{4}$/.test(pv)) { M.err = '숫자 4자리로 적어 주세요'; render(); return; }
      N.pin = await hashPin(pv); setUnlocked(true); M.pinMode = ''; M.err = ''; render(); put('_pin'); say('메모에 잠금을 걸었어요');
    }
  }
  function onChange(e) {
    var el = e.target, c = el.getAttribute && el.getAttribute('data-chg'); if (!c) return;
    if (c === 'pickdate') { M.pick = el.value || ''; render(); hint(); }
    else if (c === 'idate') { var id = el.getAttribute('data-n'); M.editDate = null; patch(id, function (n) { n.date = el.value || ''; }); }
    else if (c === 'mrename') {
      var k = el.getAttribute('data-k'), name = el.value.trim().replace(/\s+/g, ' '), cur = catInfo(k).label;
      if (!name || name === cur) { el.value = cur; return; }
      if (N.cats.some(function (x) { return x.k !== k && x.label.toLowerCase() === name.toLowerCase(); })) { say('이미 있는 분류예요'); el.value = cur; return; }
      saveCats(function (arr) { return arr.map(function (x) { return x.k === k ? Object.assign({}, x, { label: name }) : x; }); }); say('이름을 바꿨어요');
    }
  }
  function onInput(e) { if (e.target.id === 'nText') hint(); }
  function onKey(e) {
    if (e.key === 'Enter' && e.target.id === 'nCatName') { e.preventDefault(); var b = document.querySelector('[data-act="naddcatok"]'); if (b) b.click(); }
  }

  function init() {
    loadCache();
    ['memoSec', 'calSec'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('click', onClick); el.addEventListener('submit', onSubmit); el.addEventListener('change', onChange);
      el.addEventListener('input', onInput); el.addEventListener('keydown', onKey);
    });
  }

  window.Notes = { init: init, sync: sync, live: live1, refresh: refresh, resync: resync, _state: function () { return { N: N, M: M, C: C }; } };
})();

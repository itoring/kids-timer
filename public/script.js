/**
 * 低学年向け アナログ＆デジタル タイマー Webアプリ
 * - ES Modules / 外部依存なし
 * - SVGドーナツ扇形で分・秒を表現（12時起点・時計回り）
 * - 表記切替：通常（漢字+カタカナ）⇄ ひらがな
 * - localStorageで表記モード保持
 * - 状態遷移: S0=設定, S1=カウント, S2=一時停止, S3=完了
 * - ボタン有効/無効は状態に応じて制御
 * - 音：完了音、エラー音（Web Audio APIで合成）
 */

 const els = {};
 const state = {
   mode: 'normal', // 'normal' | 'hiragana'（localStorageで復元）
   mTens: 0,
   mOnes: 0,
   sTens: 0,
   sOnes: 0,
   totalMs: 0, // 残り時間（ミリ秒）
   endAt: 0, // エンドタイムスタンプ（基準時刻差分方式）
   timerId: 0, // setInterval ID
   status: 'S0' // 'S0'|'S1'|'S2'|'S3'
 };
 
 const STORAGE_KEY = 'kids-timer:langMode';
 const DIALECT_URL = './ja.json';
 
 /* ========== 初期化 ========== */
 let dict = null;
 
 document.addEventListener('DOMContentLoaded', async () => {
   cacheElements();
   await loadDictionary();
   restoreLangMode();
   setupUITexts();
   layoutDialLabels();
   layoutDialTicks();
   bindEvents();
   updateAllViews(); // 00:00描画
 });
 
 /* 主要要素のキャッシュ */
 function cacheElements() {
   [
     'btn-lang-toggle',
     'dial-svg', 'arc-minutes', 'arc-seconds', 'ring-minutes', 'ring-seconds',
     'btn-m-tens-up','digit-m-tens','btn-m-tens-down',
     'btn-m-ones-up','digit-m-ones','btn-m-ones-down',
     'btn-s-tens-up','digit-s-tens','btn-s-tens-down',
     'btn-s-ones-up','digit-s-ones','btn-s-ones-down',
     'btn-startstop','btn-reset',
     'label-min','label-sec','live','sr-total'
   ].forEach(id => els[id] = document.getElementById(id));
 }
 
 /* 辞書のロード */
 async function loadDictionary() {
   const res = await fetch(DIALECT_URL, { cache: 'no-store' });
   dict = await res.json();
 }
 
 /* 言語モード復元 */
 function restoreLangMode() {
   const saved = localStorage.getItem(STORAGE_KEY);
   if (saved === 'hiragana' || saved === 'normal') {
     state.mode = saved;
   } else {
     state.mode = 'normal'; // 仕様：初期は通常表記
   }
 }
 
 /* 表示テキストセット（ボタン・ラベル・タイトルなど） */
 function t(path) {
   // "buttons.start" のようなパスを dict から引く
   const parts = path.split('.');
   let cur = dict;
   for (const p of parts) {
     if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
     else return '';
   }
   const value = cur?.[state.mode];
   return value ?? '';
 }
 
 function setupUITexts() {
   // タイトル
   document.title = t('app.title');
   const h1 = document.getElementById('app-title-h1');
   if (h1) h1.textContent = t('app.title');
 
   // 単位ラベル
   els['label-min'].textContent = t('units.minutes');
   els['label-sec'].textContent = t('units.seconds');
 
   // 言語トグルボタンの表示テキストと aria
   setLangToggleButtonFace();
 
   // スタート/ストップ・リセット
   refreshStartStopLabel();
   els['btn-reset'].textContent = t('buttons.reset');
 }
 
 /* 言語トグルボタンの顔（仕様：初期は「ひらがな」。押すとUI全体がひらがな化し、ボタンは「かんじ」） */
 function setLangToggleButtonFace() {
   const btn = els['btn-lang-toggle'];
   if (state.mode === 'normal') {
     btn.textContent = dict.app.toggle_button.to_hiragana[state.mode]; // 「ひらがな」
     btn.title = t('aria.toggle_to_hiragana');
     btn.setAttribute('aria-label', t('aria.toggle_to_hiragana'));
   } else {
     btn.textContent = dict.app.toggle_button.to_kanji[state.mode]; // 「かんじ」
     btn.title = t('aria.toggle_to_kanji');
     btn.setAttribute('aria-label', t('aria.toggle_to_kanji'));
   }
 }
 
 /* スタート/ストップボタンの文字を状態に合わせて更新 */
 function refreshStartStopLabel() {
   if (state.status === 'S1') {
     els['btn-startstop'].textContent = t('buttons.stop');
   } else {
     els['btn-startstop'].textContent = t('buttons.start');
   }
 }
 
/* 文字盤に目盛りを入れる
*/
 function layoutDialTicks() {
  const g = document.getElementById('ticks');
  g.innerHTML = '';

  const cx = 120, cy = 130;

  drawTicksForRing(cx, cy, 100); // 外リング
  drawTicksForRing(cx, cy, 60);  // 内リング
}

/* 実際にメモリを描画する
*/
function drawTicksForRing(cx, cy, ringRadius) {
  const g = document.getElementById('ticks');

  // リングから内側に10px入った場所まで線を描く
  const rTickEnd = ringRadius - 2.5;
  const rTickStart = rTickEnd - 5; // 線の長さ 8px（調整OK）

  const labels = [0, 10, 20, 30, 40, 50];
  labels.forEach((_, i) => {
    const deg = -90 + i * 60;
    const rad = deg * Math.PI / 180;

    const x1 = cx + rTickStart * Math.cos(rad);
    const y1 = cy + rTickStart * Math.sin(rad);
    const x2 = cx + rTickEnd * Math.cos(rad);
    const y2 = cy + rTickEnd * Math.sin(rad);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    g.appendChild(line);
  });
}

 /* 文字盤のラベル（0,10,20,30,40,50）を配置
    - 12時起点（0）から時計回りに60度刻み
 */
 function layoutDialLabels() {
   const g = document.getElementById('labels');
   g.innerHTML = '';
   const cx = 120, cy = 130;
   const r = 120; // 外周より少し外に出すと読みやすい
   const labels = [0, 10, 20, 30, 40, 50];
   labels.forEach((val, i) => {
     const deg = -90 + i * 60; // 12時起点
     const rad = (deg * Math.PI) / 180;
     const x = cx + r * Math.cos(rad);
     const y = cy + r * Math.sin(rad);
     const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
     text.setAttribute('x', x.toFixed(2));
     text.setAttribute('y', y.toFixed(2));
     text.textContent = String(val);
     g.appendChild(text);
   });
 }
 
 /* ========== イベント登録 ========== */
 function bindEvents() {
   // 言語トグル
   els['btn-lang-toggle'].addEventListener('click', () => {
     state.mode = state.mode === 'normal' ? 'hiragana' : 'normal';
     localStorage.setItem(STORAGE_KEY, state.mode);
     setupUITexts();
     announceCurrentTotal(); // 画面再読込なしでモード適用時の読み上げ
   });
 
   // 分十
   els['btn-m-tens-up'].addEventListener('click', () => onAdjust('mTens', +1));
   els['btn-m-tens-down'].addEventListener('click', () => onAdjust('mTens', -1));
   // 分一
   els['btn-m-ones-up'].addEventListener('click', () => onAdjust('mOnes', +1));
   els['btn-m-ones-down'].addEventListener('click', () => onAdjust('mOnes', -1));
   // 秒十
   els['btn-s-tens-up'].addEventListener('click', () => onAdjust('sTens', +1));
   els['btn-s-tens-down'].addEventListener('click', () => onAdjust('sTens', -1));
   // 秒一
   els['btn-s-ones-up'].addEventListener('click', () => onAdjust('sOnes', +1));
   els['btn-s-ones-down'].addEventListener('click', () => onAdjust('sOnes', -1));
 
   // スタート/ストップ
   els['btn-startstop'].addEventListener('click', () => {
     if (state.status === 'S1') {
       // Stop
       enterPause();
     } else {
       // Start
       tryStart();
     }
   });
   // リセット
   els['btn-reset'].addEventListener('click', () => {
     resetAll();
   });
 
   // ウィンドウ離脱時に念のためタイマ停止（ブラウザ節電）
   window.addEventListener('visibilitychange', () => {
     if (document.hidden && state.status === 'S1') {
       enterPause();
     }
   });
 }
 
 /* ========== 入力・ガード・仕様ロジック ========== */
 
 /**
  * onAdjust: 各桁の調整処理
  * - 仕様に沿って上限・下限・特例を実装
  * - 無効操作はフィードバック＋エラー音＋aria-live
  */
 function onAdjust(kind, delta) {
   if (!canEdit()) {
     // カウント中はロック
     speak('messages.controls_locked_while_running');
     playErrorBeep();
     flashDigits();
     return;
   }
 
   const before = getCurrentTime();
 
   // 60:00のときの特例（他の上下は無反応、分十↓のみ 50:00 に）
   if (before.m === 60 && before.s === 0) {
     if (kind === 'mTens' && delta < 0) {
       setTime(50, 0);
       updateAllViews();
     } else {
       // 無反応
       speak('messages.max_time_reached');
       playErrorBeep();
       flashDigits();
     }
     return;
   }
 
   let { mTens, mOnes, sTens, sOnes } = state;
 
   const applyInvalid = () => {
     speak('messages.max_time_reached');
     playErrorBeep();
     flashDigits();
   };
 
   if (kind === 'mTens') {
     // 分 十↑：+10。ただし 59:xx でも 60:00 へ
     // 55:30 → 分十↑ → 60:00, 59:59 → 分十↑ → 60:00
     if (delta > 0) {
       const totalM = mTens * 10 + mOnes;
       const newM = totalM + 10;
       if (newM >= 60 || (totalM >= 55)) {
         setTime(60, 0);
       } else {
         mTens = Math.min(5, mTens + 1);
         // 分の総和が60になる操作は最終的に60:00へ寄せる（ただしここでは59まで）
         setDigits({ mTens, mOnes, sTens, sOnes });
       }
     } else {
       // 分 十↓：60:00のときだけ50:00（上で特例処理済み）
       const totalM = mTens * 10 + mOnes;
       if (totalM === 0) {
         // 0未満不可
         applyInvalid();
       } else {
         // 10分単位で-10（ただし0未満不可）
         if (totalM - 10 < 0) {
           applyInvalid();
         } else {
           mTens = Math.max(0, mTens - 1);
           setDigits({ mTens, mOnes, sTens, sOnes });
         }
       }
     }
   } else if (kind === 'mOnes') {
     // 分 一↑↓：0〜59の範囲で±1。60になる操作は無効
     const totalM = mTens * 10 + mOnes + delta;
     if (totalM < 0 || totalM > 59) {
       applyInvalid();
     } else {
       const nmTens = Math.floor(totalM / 10);
       const nmOnes = totalM % 10;
       setDigits({ mTens: nmTens, mOnes: nmOnes, sTens, sOnes });
     }
   } else if (kind === 'sTens') {
     // 秒 十：0〜5の範囲。6不可
     const newVal = sTens + delta;
     if (newVal < 0 || newVal > 5) {
       applyInvalid();
     } else {
       sTens = newVal;
       setDigits({ mTens, mOnes, sTens, sOnes });
     }
   } else if (kind === 'sOnes') {
     // 秒 一：0〜9の範囲。10不可
     const newVal = sOnes + delta;
     if (newVal < 0 || newVal > 9) {
       applyInvalid();
     } else {
       sOnes = newVal;
       setDigits({ mTens, mOnes, sTens, sOnes });
     }
   }
 
   // 59:59 → 秒↑と分一↑ → 無反応（= 上のガードで無効化）
   // 変更後ビュー更新
   updateAllViews();
 }
 
 /* 編集できるのは S0（設定）と S2（一時停止） */
 function canEdit() {
   return state.status === 'S0' || state.status === 'S2';
 }
 
 /* 現在の mm:ss を取得 */
 function getCurrentTime() {
   const m = state.mTens * 10 + state.mOnes;
   const s = state.sTens * 10 + state.sOnes;
   return { m, s };
 }
 
 /* 桁をセット（内部状態のみ） */
 function setDigits({ mTens, mOnes, sTens, sOnes }) {
   state.mTens = mTens;
   state.mOnes = mOnes;
   state.sTens = sTens;
   state.sOnes = sOnes;
 }
 
 /* 分秒をセット（桁へ展開） */
 function setTime(m, s) {
   const mm = Math.max(0, Math.min(60, m));
   const ss = Math.max(0, Math.min(59, s));
   state.mTens = Math.floor(mm / 10);
   state.mOnes = mm % 10;
   state.sTens = Math.floor(ss / 10);
   state.sOnes = ss % 10;
 }
 
 /* スタート試行（ガード: time > 0） */
 function tryStart() {
   if (!(state.status === 'S0' || state.status === 'S2')) return;
 
   const { m, s } = getCurrentTime();
   const total = m * 60 + s;
   if (total <= 0) {
     // 00:00では開始不可
     speak('messages.at_zero_no_start');
     playErrorBeep();
     flashDigits();
     return;
   }
 
   // カウントへ遷移
   enterCounting(total);
 }
 
 /* カウント状態へ遷移 */
 function enterCounting(totalSeconds) {
   state.status = 'S1';
   refreshStartStopLabel();
   updateButtonsEnabled();
 
   // 精度保証：基準時刻差分方式
   const now = performance.now();
   state.totalMs = totalSeconds * 1000;
   state.endAt = now + state.totalMs;
 
   // 1秒毎のtick（UI更新はtick内で差分計算）
   clearInterval(state.timerId);
   state.timerId = setInterval(onTick, 100); // 100ms粒度で残り秒を計算し1秒境界を正しく跨ぐ
 }
 
 /* 一時停止 */
 function enterPause() {
   if (state.status !== 'S1') return;
   // 残り時間を固定
   const remainMs = Math.max(0, state.endAt - performance.now());
   clearInterval(state.timerId);
   state.timerId = 0;
   state.totalMs = remainMs;
   // 残りmsから桁表示へ反映
   applyRemainingMs(remainMs);
   state.status = 'S2';
   refreshStartStopLabel();
   updateButtonsEnabled();
 }
 
 /* リセット（全クリア） */
 function resetAll() {
   clearInterval(state.timerId);
   state.timerId = 0;
   setTime(0, 0);
   state.totalMs = 0;
   state.endAt = 0;
   state.status = 'S0';
   refreshStartStopLabel();
   updateButtonsEnabled();
   updateAllViews();
   speak(''); // ライブリージョンを空に
 }
 
 /* tick処理：現在の残りを計算して表示を更新、到達で完了へ */
 function onTick() {
   const now = performance.now();
   const remain = Math.max(0, state.endAt - now);
   applyRemainingMs(remain);
 
   if (remain <= 0) {
     clearInterval(state.timerId);
     state.timerId = 0;
     state.status = 'S3'; // 完了
     refreshStartStopLabel();
     updateButtonsEnabled();
     speak('messages.finished');
     playFinishBeep();
   }
 }
 
 /* 残りmsから桁に反映し、ダイヤルと表示を更新 */
 function applyRemainingMs(remainMs) {
   const remainSec = Math.ceil(remainMs / 1000); // 0以外は切り上げ表示
   const m = Math.floor(remainSec / 60);
   const s = remainSec % 60;
   setTime(m, s);
   updateAllViews();
 }
 
 /* ボタンの有効/無効（仕様） */
 function updateButtonsEnabled() {
   const enabled = {
//     edit: state.status === 'S0' || state.status === 'S2',
//     start: state.status === 'S0' || state.status === 'S2',
     edit: state.status !== 'S1',
     start: state.status !== 'S1',
     stop: state.status === 'S1',
     reset: state.status !== 'S1' // 到達時はリセットのみ、S0/S2も可
   };
 
   const editBtns = [
     'btn-m-tens-up','btn-m-tens-down',
     'btn-m-ones-up','btn-m-ones-down',
     'btn-s-tens-up','btn-s-tens-down',
     'btn-s-ones-up','btn-s-ones-down'
   ];
   editBtns.forEach(id => els[id].disabled = !enabled.edit);
 
   els['btn-startstop'].disabled = enabled.stop; // カウント中はStopのみ有効なので無効=falseにする
   els['btn-startstop'].setAttribute('aria-pressed', state.status === 'S1');
 
   if (state.status === 'S1') {
     els['btn-startstop'].disabled = false; // Stop可
   } else if (state.status === 'S3') {
     // 完了時：リセットのみ
//     els['btn-startstop'].disabled = true;
     els['btn-startstop'].disabled = false;
   }
 
   els['btn-reset'].disabled = !enabled.reset;
 }
 
 /* ライブリージョンへ辞書メッセージ */
 function speak(keyPath) {
/*
  if (!keyPath) {
     els['live'].textContent = '';
     return;
   }
   els['live'].textContent = t(keyPath);
*/
   }
 
 /* 無効操作時の視覚フィードバック */
 function flashDigits() {
/*
  const boxes = [
     'digit-m-tens','digit-m-ones','digit-s-tens','digit-s-ones'
   ].map(id => els[id]);
   boxes.forEach(el => {
     el.classList.remove('flash');
     // リフロー強制してアニメ再適用
     void el.offsetWidth;
     el.classList.add('flash');
   });
*/
   }
 
 /* 画面全体更新（数字・ダイヤル・SRラベル） */
 function updateAllViews() {
   // 桁表示
   els['digit-m-tens'].textContent = state.mTens;
   els['digit-m-ones'].textContent = state.mOnes;
   els['digit-s-tens'].textContent = state.sTens;
   els['digit-s-ones'].textContent = state.sOnes;
 
   // SVG更新（分×6度, 秒×6度）
   const { m, s } = getCurrentTime();
   const degMin = Math.min(360, m * 6);
   const degSec = Math.min(360, s * 6);
 
   els['arc-minutes'].setAttribute('d', donutPath(120, 130, 97, 62, degMin));
   els['arc-seconds'].setAttribute('d', donutPath(120, 130, 57, 30, degSec));
 
   // SR向け合計時間
   const mm = String(m).padStart(2, '0');
   const ss = String(s).padStart(2, '0');
   els['sr-total'].textContent = `${t('aria.current_total_time')}: ${mm}:${ss}`;
 }
 
 /* スタート/ストップボタンのクリックでラベル更新が必要な場合がある */
 function syncStartStopFace() {
   refreshStartStopLabel();
 }
 
 /* ========== SVGドーナツ扇形：12時起点・時計回り ========== */
 /**
  * donutPath(cx, cy, rOuter, rInner, angleDeg)
  * 角度0で何も描かない。0<angle<360 はドーナツ扇形。360は180度のドーナツ扇形２つで表現する。
  */
function donutPath(cx, cy, rOuter, rInner, angleDeg) {
  const a = Math.max(0, Math.min(360, angleDeg));
  if (a === 0) return '';

  // 12時起点（-90°）
  const startA = (-90) * Math.PI / 180;
  const endA   = (-90 + a) * Math.PI / 180;

  // 360度は特別処理：外周を180°×2、内周も逆回りで180°×2
  if (a === 360) {
    const midA = (90) * Math.PI / 180; // 12時→6時→12時 に戻る

    // 外周: 上(12時)→下(6時)→上(12時)（時計回り）
    const xOuterTop = cx + rOuter * Math.cos(startA);
    const yOuterTop = cy + rOuter * Math.sin(startA);
    const xOuterBot = cx + rOuter * Math.cos(midA);
    const yOuterBot = cy + rOuter * Math.sin(midA);

    // 内周: 上→下→上（反時計回りで戻る）
    const xInnerTop = cx + rInner * Math.cos(startA);
    const yInnerTop = cy + rInner * Math.sin(startA);
    const xInnerBot = cx + rInner * Math.cos(midA);
    const yInnerBot = cy + rInner * Math.sin(midA);

    // large-arc=1, sweep: 外=1(時計回り), 内=0(反時計回り)
    return [
      // 外周をぐるっと一周
      `M ${xOuterTop} ${yOuterTop}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${xOuterBot} ${yOuterBot}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${xOuterTop} ${yOuterTop}`,
      // 内周へ移動して逆回り
      `L ${xInnerTop} ${yInnerTop}`,
      `A ${rInner} ${rInner} 0 1 0 ${xInnerBot} ${yInnerBot}`,
      `A ${rInner} ${rInner} 0 1 0 ${xInnerTop} ${yInnerTop}`,
      'Z'
    ].join(' ');
  }

  // 0 < a < 360 は通常のドーナツ扇形
  const x0 = cx + rOuter * Math.cos(startA);
  const y0 = cy + rOuter * Math.sin(startA);
  const x1 = cx + rOuter * Math.cos(endA);
  const y1 = cy + rOuter * Math.sin(endA);

  const xi0 = cx + rInner * Math.cos(endA);
  const yi0 = cy + rInner * Math.sin(endA);
  const xi1 = cx + rInner * Math.cos(startA);
  const yi1 = cy + rInner * Math.sin(startA);

  const largeArc = a > 180 ? 1 : 0;

  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${xi0} ${yi0}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${xi1} ${yi1}`,
    'Z'
  ].join(' ');
}

 
 /* ========== サウンド（Web Audio API） ========== */
 let audioCtx = null;
 function getAudio() {
   if (!audioCtx) {
     audioCtx = new (window.AudioContext || window.webkitAudioContext)();
   }
   return audioCtx;
 }
 
 /* エラー音：短いビープ（低→高の2トーン） */
 function playErrorBeep() {
   const ctx = getAudio();
   const now = ctx.currentTime;
   const osc1 = ctx.createOscillator();
   const g1 = ctx.createGain();
   osc1.type = 'square';
   osc1.frequency.value = 320;
   g1.gain.setValueAtTime(0.0001, now);
   g1.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
   g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
   osc1.connect(g1).connect(ctx.destination);
   osc1.start(now);
   osc1.stop(now + 0.11);
 
   const osc2 = ctx.createOscillator();
   const g2 = ctx.createGain();
   osc2.type = 'square';
   osc2.frequency.value = 520;
   g2.gain.setValueAtTime(0.0001, now + 0.12);
   g2.gain.exponentialRampToValueAtTime(0.18, now + 0.13);
   g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
   osc2.connect(g2).connect(ctx.destination);
   osc2.start(now + 0.12);
   osc2.stop(now + 0.24);
 }
 
 /* 完了音：上昇アルペジオ風（教育現場でも耳障りになりにくい短音） */
 function playFinishBeep() {
   const ctx = getAudio();
   const base = ctx.currentTime;
   const notes = [660, 880, 990]; // 短い上昇
   notes.forEach((freq, i) => {
     const osc = ctx.createOscillator();
     const g = ctx.createGain();
     osc.type = 'sine';
     osc.frequency.value = freq;
     const t0 = base + i * 0.09;
     g.gain.setValueAtTime(0.0001, t0);
     g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
     g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
     osc.connect(g).connect(ctx.destination);
     osc.start(t0);
     osc.stop(t0 + 0.19);
   });
 }
 
 /* ========== アナウンス・ユーティリティ ========== */
 function announceCurrentTotal() {
   const { m, s } = getCurrentTime();
   const mm = String(m).padStart(2, '0');
   const ss = String(s).padStart(2, '0');
   els['sr-total'].textContent = `${t('aria.current_total_time')}: ${mm}:${ss}`;
 }
 
 /* ========== 受け入れテスト補助（開発時のみ手動チェックに使う） ========== */
 /* 手動でコンソールから:
    setTime(55,30); updateAllViews();
    などで確認可能。 */
 
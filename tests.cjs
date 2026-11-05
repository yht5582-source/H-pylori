// Run: node tests.cjs
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function block(a, b) {
  const s = html.indexOf(a), e = html.indexOf(b);
  assert(s > 0 && e > s, 'missing block ' + a);
  return html.slice(s, e);
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(block('/*ENGINE-START*/', '/*ENGINE-END*/') + ';this.HP=HP;', ctx);
vm.runInContext(block('/*TEACH-START*/', '/*TEACH-END*/') + ';this.TEACH=TEACH;', ctx);
const { HP, TEACH } = ctx;

let n = 0;
function t(name, fn) {
  try { fn(); n++; } catch (e) { console.error('FAIL ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
const key = o => HP.recommend(o).key;

// --- Named clinical paths ---
t('first-line default is BQT', () => assert.strictEqual(key({}), 'BQT'));
t('first-line allergy is BQT', () => assert.strictEqual(key({ allergy: 'confirmed' }), 'BQT'));
t('low resistance keeps BQT main, triple as alternative', () => {
  const r = HP.recommend({ resistance: 'low' });
  assert.strictEqual(r.key, 'BQT');
  assert(r.alts.some(a => a.key === 'TRIPLE'));
});
t('prior macrolide removes the low-resistance triple', () => {
  assert(!HP.recommend({ resistance: 'low', macrolide: true }).alts.some(a => a.key === 'TRIPLE'));
});
t('clarithromycin-sensitive first line can use triple', () => assert.strictEqual(key({ astClari: 'S' }), 'TRIPLE'));
t('BQT unavailable, no allergy: vonoprazan dual', () => assert.strictEqual(key({ bqtOff: true }), 'VA'));
t('BQT unavailable with allergy: refer', () => assert.strictEqual(HP.recommend({ bqtOff: true, allergy: 'reported' }).status, 'refer'));
t('after triple: BQT', () => assert.strictEqual(key({ line: 'rescue', clari: true }), 'BQT'));
t('after BQT: rifabutin', () => assert.strictEqual(key({ line: 'rescue', bqt: true }), 'RIF'));
t('after BQT, levofloxacin sensitive: levofloxacin triple', () => assert.strictEqual(key({ line: 'rescue', bqt: true, astLevo: 'S' }), 'LEVO_T'));
t('after BQT and rifabutin: high-dose dual', () => assert.strictEqual(key({ line: 'rescue', bqt: true, rif: true }), 'HDDT'));
t('all used: refer', () => assert.strictEqual(HP.recommend({ line: 'rescue', bqt: true, rif: true, dual: true, levo: true, clari: true }).status, 'refer'));
t('old bug: allergy + failed BQT honours prior regimen', () => {
  const r = HP.recommend({ line: 'rescue', allergy: 'confirmed', bqt: true });
  assert.strictEqual(r.status, 'refer');
  assert.notStrictEqual(r.key, 'BQT');
});
t('allergy + failed BQT + levofloxacin S', () => assert.strictEqual(key({ line: 'rescue', allergy: 'confirmed', bqt: true, astLevo: 'S' }), 'LEVO_M'));
t('allergy + failed BQT + clarithromycin S', () => assert.strictEqual(key({ line: 'rescue', allergy: 'confirmed', bqt: true, astClari: 'S' }), 'PCM'));
t('special population gets no regimen', () => {
  const r = HP.recommend({ special: true });
  assert.strictEqual(r.status, 'defer');
  assert.strictEqual(r.meds.length, 0);
});
t('alarm adds a red alert', () => assert(HP.recommend({ alarm: true }).alerts.some(a => a.level === 'red')));
t('two failures prompt susceptibility testing', () => assert(HP.recommend({ line: 'rescue', fails: 2, clari: true, bqt: true }).alerts.some(a => /藥敏/.test(a.text))));
t('rescue with no history warns', () => assert(HP.recommend({ line: 'rescue' }).alerts.some(a => /用藥史/.test(a.text))));

// --- Exhaustive safety invariants over every input combination ---
const bools = [false, true];
let combos = 0;
for (const line of ['first', 'rescue'])
for (const allergy of ['none', 'reported', 'confirmed'])
for (const resistance of ['high', 'low'])
for (const macrolide of bools)
for (const astClari of ['unknown', 'S', 'R'])
for (const astLevo of ['unknown', 'S', 'R'])
for (const clari of bools) for (const levo of bools) for (const bqt of bools) for (const rif of bools) for (const dual of bools)
for (const bqtOff of bools) {
  const input = { line, allergy, resistance, macrolide, astClari, astLevo, fails: 1, clari, levo, bqt, rif, dual, bqtOff };
  const r = HP.recommend(input);
  const label = JSON.stringify(input);
  const options = (r.status === 'rx' ? [{ meds: r.meds, key: r.key }] : []).concat(r.alts);
  combos++;
  assert(r.status === 'rx' || r.status === 'refer', label);
  if (r.status === 'rx') assert(r.meds.length > 0 && r.duration, label);
  options.forEach(o => {
    const text = o.meds.join(' ');
    if (allergy !== 'none') assert(!/Amoxicillin/.test(text), 'amoxicillin in allergy ' + o.key + ' ' + label);
    if (astClari === 'R') assert(!/Clarithromycin/.test(text), 'clari R ' + o.key + ' ' + label);
    if (astLevo === 'R') assert(!/Levofloxacin/.test(text), 'levo R ' + o.key + ' ' + label);
    if (line === 'rescue') {
      if (clari) assert(!/Clarithromycin/.test(text), 'clari reuse ' + o.key + ' ' + label);
      if (levo) assert(!/Levofloxacin/.test(text), 'levo reuse ' + o.key + ' ' + label);
      if (bqt) assert(o.key !== 'BQT', 'BQT reuse ' + label);
      if (rif) assert(o.key !== 'RIF', 'rifabutin reuse ' + label);
      if (dual) assert(o.key !== 'HDDT' && o.key !== 'VA', 'dual reuse ' + label);
    } else {
      assert(!/Levofloxacin/.test(text), 'empiric levofloxacin first line ' + label);
    }
    if (bqtOff) assert(o.key !== 'BQT', 'BQT offered while unavailable ' + label);
  });
}
t('exhaustive combos ran', () => assert(combos > 10000, String(combos)));

// --- Verified doses and coverage (checked 2026-11-05) ---
t('every regimen has a coverage note', () => Object.keys(HP.REG).forEach(k => assert(HP.REG[k].nhi && HP.REG[k].nhi.length > 10, k)));
t('high-dose dual uses standard-dose PPI QID', () => {
  assert.deepStrictEqual(Array.from(HP.REG.HDDT.meds), ['PPI 標準劑量，每日 4 次', 'Amoxicillin 750 mg，每日 4 次']);
});
t('levofloxacin-bismuth quadruple doses', () => assert(HP.REG.LBQ.meds.some(m => /Amoxicillin 500 mg，每日 4 次/.test(m))));
t('amoxicillin-free P-CAB doses', () => {
  const m = HP.REG.PCAB_NOAMOX.meds.join(' ');
  assert(/Tetracycline 500 mg，每日 3 次/.test(m) && /Minocycline 100 mg，每日 2 次/.test(m) && !/Amoxicillin/.test(m));
  assert.strictEqual(HP.REG.PCAB_NOAMOX.duration, '14 天');
});
t('levofloxacin regimens flag the NHI rule', () => ['LEVO_T', 'LEVO_M', 'LBQ'].forEach(k => assert(/未列幽門桿菌/.test(HP.REG[k].nhi), k)));
t('vonoprazan regimens flag no NHI listing', () => ['VA', 'PCAB_NOAMOX'].forEach(k => assert(/查無 Vonoprazan/.test(HP.REG[k].nhi), k)));
t('P-CAB hold is labelled an assumption', () => assert(HP.TOC.some(x => /P-CAB/.test(x) && /假設/.test(x))));
t('BQT unavailable lists an option without vonoprazan', () => {
  const r = HP.recommend({ bqtOff: true });
  assert(r.alts.some(a => a.key === 'HDDT') && r.alts.some(a => a.key === 'RIF'));
  assert(r.notes.some(n => /Vonoprazan/.test(n)));
});
t('unverified brand name not on page', () => assert(!/福速胃/.test(html)));

// --- Teaching content ---
t('6 cases', () => assert.strictEqual(TEACH.CASES.length, 6));
TEACH.CASES.forEach(c => t('case matches engine: ' + c.id, () => assert.strictEqual(HP.recommend(c.input).key, c.expect)));
t('case 6 raises the alarm', () => assert(HP.recommend(TEACH.CASES[5].input).alerts.some(a => a.level === 'red')));
t('20 questions, 10 basic then 10 advanced', () => {
  assert.strictEqual(TEACH.QUIZ.length, 20);
  TEACH.QUIZ.forEach((q, i) => assert.strictEqual(q.lv, i < 10 ? 'b' : 'a'));
});
t('answers balanced, A-D 5 each', () => {
  const c = [0, 0, 0, 0];
  TEACH.QUIZ.forEach(q => c[q.a]++);
  assert.deepStrictEqual(c, [5, 5, 5, 5]);
});
TEACH.QUIZ.forEach((q, i) => t('question well formed ' + (i + 1), () => {
  assert.strictEqual(q.o.length, 4);
  assert.strictEqual(new Set(q.o).size, 4);
  assert(q.a >= 0 && q.a < 4 && q.why.length > 10);
}));
t('correct option is not usually the longest', () => {
  const longest = TEACH.QUIZ.filter(q => {
    const m = Math.max(...q.o.map(o => o.length));
    return q.o[q.a].length === m && q.o.filter(o => o.length === m).length === 1;
  }).length;
  assert(longest <= 6, 'correct is uniquely longest in ' + longest + ' of 20');
});
t('mind map has branches', () => assert(TEACH.MAP.length >= 5));

// --- Page-level regressions ---
t('no third-party scripts', () => assert(!/<script[^>]+src=/.test(html)));
t('zoom is allowed', () => assert(!/user-scalable=no|maximum-scale/.test(html)));
t('no blob manifest', () => assert(!/createObjectURL/.test(html)));
t('no unsourced prognosis label', () => assert(!/預估除菌率/.test(html)));
t('no persistent storage', () => assert(!/localStorage|sessionStorage|indexedDB/.test(html)));
t('offline files exist', () => ['sw.js', 'manifest.webmanifest', 'icon.svg'].forEach(f => assert(fs.existsSync(__dirname + '/' + f), f)));

console.log(process.exitCode ? 'FAILED' : 'ok', n + ' tests,', combos + ' input combinations checked');

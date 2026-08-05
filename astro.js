/* ===========================================================
   astro.js ― デモ用の天体計算
   JPL「Keplerian Elements for Approximate Positions of the
   Major Planets」(1800-2050) を使った近似計算。
   誤差は内惑星で±1°程度、外惑星はもっと小さい。
   本番は swisseph に差し替える前提。
   =========================================================== */

const SIGNS = ["牡羊座","牡牛座","双子座","蟹座","獅子座","乙女座",
               "天秤座","蠍座","射手座","山羊座","水瓶座","魚座"];
/* U+FE0E（異体字セレクタ）を付けて絵文字化を防ぐ */
const VS = "︎";
const SIGN_GLYPH = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"].map(g => g + VS);

const rad  = x => x * Math.PI / 180;
const deg  = x => x * 180 / Math.PI;
const norm = x => ((x % 360) + 360) % 360;

/* JST の日時 → J2000 からの経過日数（UT基準） */
function jdays(y, m, d, h, mi) {
  const utc = Date.UTC(y, m - 1, d, h, mi) - 9 * 3600 * 1000;
  return utc / 86400000 - 10957.5;
}

/* ---- 太陽（見かけの黄経・高精度） ---- */
function sunLon(n) {
  const L = 280.460 + 0.9856474 * n;
  const g = rad(norm(357.528 + 0.9856003 * n));
  return norm(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

/* ---- 月（Meeus 簡略版・誤差 約0.3°） ---- */
function moonLon(n) {
  const L = norm(218.316 + 13.176396 * n),
        M = rad(norm(134.963 + 13.064993 * n)),
        D = rad(norm(297.850 + 12.190749 * n)),
        S = rad(norm(357.529 +  0.985600 * n));
  return norm(L
    + 6.289 * Math.sin(M)       + 1.274 * Math.sin(2*D - M)   + 0.658 * Math.sin(2*D)
    - 0.186 * Math.sin(S)       - 0.059 * Math.sin(2*M - 2*D) - 0.057 * Math.sin(M - 2*D + S)
    + 0.053 * Math.sin(M + 2*D) + 0.046 * Math.sin(2*D - S)   - 0.041 * Math.sin(M - S)
    - 0.035 * Math.sin(D)       - 0.031 * Math.sin(M + S));
}

/* ---- 惑星の軌道要素（J2000元期・毎世紀の変化率） ----
   [a, e, I, L, peri, node] と、その rate                        */
const ELEM = {
  水星: [[0.38709927, 0.20563593,  7.00497902,  252.25032350,  77.45779628,  48.33076593],
         [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689,  -0.12534081]],
  金星: [[0.72333566, 0.00677672,  3.39467605,  181.97909950, 131.60246718,  76.67984255],
         [0.00000390,-0.00004107, -0.00078890,  58517.81538729, 0.00268329,  -0.27769418]],
  地球: [[1.00000261, 0.01671123, -0.00001531,  100.46457166, 102.93768193,   0.00000000],
         [0.00000562,-0.00004392, -0.01294668,  35999.37244981, 0.32327364,   0.00000000]],
  火星: [[1.52371034, 0.09339410,  1.84969142,   -4.55343205, -23.94362959,  49.55953891],
         [0.00001847, 0.00007882, -0.00813131,  19140.30268499, 0.44441088,  -0.29257343]],
  木星: [[5.20288700, 0.04838624,  1.30439695,   34.39644051,  14.72847983, 100.47390909],
         [-0.00011607,-0.00013253,-0.00183714,   3034.74612775, 0.21252668,   0.20469106]],
  土星: [[9.53667594, 0.05386179,  2.48599187,   49.95424423,  92.59887831, 113.66242448],
         [-0.00125060,-0.00050991, 0.00193609,   1222.49362201,-0.41897216,  -0.28867794]],
  天王星:[[19.18916464,0.04725744,  0.77263783,  313.23810451, 170.95427630,  74.01692503],
         [-0.00196176,-0.00004397,-0.00242939,    428.48202785, 0.40805281,   0.04240589]],
  海王星:[[30.06992276,0.00859048,  1.77004347,  -55.12002969,  44.96476227, 131.78422574],
         [0.00026291, 0.00005105,  0.00035372,    218.45945325,-0.32241464,  -0.00508664]],
  冥王星:[[39.48211675,0.24882730, 17.14001206,  238.92903833, 224.06891629, 110.30393684],
         [-0.00031596,0.00005170,  0.00004818,    145.20780515,-0.04062942,  -0.01183482]]
};

/* 軌道要素 → 太陽中心の黄道直交座標 */
function helio(name, T) {
  const [e0, dr] = ELEM[name];
  const a = e0[0] + dr[0]*T, e = e0[1] + dr[1]*T, I = rad(e0[2] + dr[2]*T);
  const L = e0[3] + dr[3]*T, w = e0[4] + dr[4]*T, O = rad(e0[5] + dr[5]*T);

  let M = norm(L - w); if (M > 180) M -= 360;
  // ケプラー方程式を反復で解く
  let E = M + deg(e) * Math.sin(rad(M));
  for (let i = 0; i < 8; i++) {
    const dM = M - (E - deg(e) * Math.sin(rad(E)));
    E += dM / (1 - e * Math.cos(rad(E)));
  }
  const xo = a * (Math.cos(rad(E)) - e);
  const yo = a * Math.sqrt(1 - e*e) * Math.sin(rad(E));

  const wp = rad(w) - O, cw = Math.cos(wp), sw = Math.sin(wp),
        cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw*cO - sw*sO*cI)*xo + (-sw*cO - cw*sO*cI)*yo,
    (cw*sO + sw*cO*cI)*xo + (-sw*sO + cw*cO*cI)*yo,
    (sw*sI)*xo + (cw*sI)*yo
  ];
}

/* 地球中心の黄経
   軌道要素は J2000 分点基準なので、占星術で使う「その時点の分点」へ
   歳差補正する（約 1.397°/世紀）。太陽・月の式は元から of-date。 */
function planetLon(name, n) {
  const T = n / 36525;
  const p = helio(name, T), e = helio("地球", T);
  const lam = deg(Math.atan2(p[1] - e[1], p[0] - e[0]));
  return norm(lam + 1.396971 * T);
}

/* ---- ASC / MC ---- */
function ascmc(n, lat, lon) {
  const gmst  = norm(280.46061837 + 360.98564736629 * n);
  const ramc  = rad(norm(gmst + lon));
  const eps   = rad(23.4393 - 0.0000004 * n);
  const phi   = rad(lat);

  const mc  = norm(deg(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps))));
  let asc = norm(deg(Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))
  )));
  // ASC は黄道順で MC の 0〜180° 先にある。裏を引いていたら反転させる
  if (norm(asc - mc) > 180) asc = norm(asc + 180);
  return { asc, mc };
}

/* ===========================================================
   5度前ルール
   天体がハウスのカスプの手前5度以内にあるときは、
   すでに次のハウスに入っているとみなす（おます式）。
   イコールハウスなので「位置に5度足してから割る」だけで済む。
   プラシーダスに切り替えるときは、カスプごとに個別判定が要る。
   =========================================================== */
const RULE_5DEG = true;   // 5度前ルールを使うか
const ORB_5DEG  = 5;      // 何度前から次のハウスとみなすか

/* "apply" … ルールどおり次のハウスに入れる（おますの流儀・既定）
   "note"  … 配置は標準のまま、「◯室寄り」の注記だけ付ける
   ※ "note" は真木あかり等の一般的な占いサイトと一致する。
     切り替えると鑑定書との整合が崩れるので、変更は本人裁定で。 */
const RULE_5DEG_MODE = "apply";

/* カスプ表（1〜12の黄経）の中で、ある黄経がどの部屋に入るか */
function inWhichHouse(lon, cusps) {
  for (let n = 1; n <= 12; n++) {
    const a = cusps[n], b = cusps[n === 12 ? 1 : n + 1];
    if (norm(lon - a) < norm(b - a)) return n;
  }
  return 1;
}

/* cusps は 12室のカスプ黄経。
   ハウスは標準どおり（カスプで区切る）を正とする。
   5度前ルールは「次の部屋の入口が5度以内に迫っている」という
   注記として持たせ、置き場所そのものは動かさない。 */
function houseOf(lon, cusps) {
  const plain = inWhichHouse(lon, cusps);
  const ruled = RULE_5DEG ? inWhichHouse(norm(lon + ORB_5DEG), cusps) : plain;
  const moved = ruled !== plain;
  return RULE_5DEG_MODE === "apply"
    ? { house: ruled, moved, next: ruled, plain }   // 繰り上げて確定
    : { house: plain, moved, next: ruled, plain };  // 標準のまま注記だけ
}

/* イコールハウスのカスプ表を作る */
function equalCusps(asc) {
  const c = {};
  for (let n = 1; n <= 12; n++) c[n] = norm(asc + 30 * (n - 1));
  return c;
}

/* ---- チャート一式を組み立てる ---- */
const PLANETS = ["太陽","月","水星","金星","火星","木星","土星","天王星","海王星","冥王星"];
const GLYPH = {太陽:"☉"+VS,月:"☾"+VS,水星:"☿"+VS,金星:"♀"+VS,火星:"♂"+VS,木星:"♃"+VS,
               土星:"♄"+VS,天王星:"♅"+VS,海王星:"♆"+VS,冥王星:"♇"+VS,ASC:"Asc",MC:"MC"};

function lonOf(name, n) {
  if (name === "太陽") return sunLon(n);
  if (name === "月")   return moonLon(n);
  return planetLon(name, n);
}

function buildChart(y, m, d, h, mi, lat, lon) {
  const n = jdays(y, m, d, h, mi);
  const { asc, mc } = ascmc(n, lat, lon);

  // カスプ表を先に作る。プラシーダスなら 11/12/2/3 を反復で求め、残りは向かい側
  let cusps;
  if (HOUSE_SYS === "placidus") {
    const gmst = norm(280.46061837 + 360.98564736629 * n);
    const ramc = norm(gmst + lon);
    const eps  = rad(23.4393 - 0.0000004 * n);
    const p = placidusCusps(ramc, eps, lat);
    cusps = { 1: asc, 10: mc, 11: p[11], 12: p[12], 2: p[2], 3: p[3] };
    for (const k of [1, 2, 3, 10, 11, 12]) cusps[k > 6 ? k - 6 : k + 6] = norm(cusps[k] + 180);
  } else {
    cusps = equalCusps(asc);
  }

  const bodies = PLANETS.map(name => {
    const L = lonOf(name, n);
    const h = houseOf(L, cusps);
    return {
      name, lon: L,
      sign: SIGNS[Math.floor(L / 30)],
      glyph: GLYPH[name],
      signGlyph: SIGN_GLYPH[Math.floor(L / 30)],
      deg: (L % 30),
      house: h.house,          // カスプで区切った本来のハウス
      houseMoved: h.moved,     // 次の部屋の入口が5度以内に迫っているか
      houseNext: h.next        // その場合の「寄っている先」
    };
  });
  return { n, asc, mc, cusps, bodies };
}

/* ===========================================================
   ハウスを読むための道具
   カスプのサイン → その支配星 → 支配星が実際どこにいるか、
   というホロスコープの基本の読み筋をチャートから算出する。
   =========================================================== */
const RULER = {
  牡羊座:"火星", 牡牛座:"金星", 双子座:"水星", 蟹座:"月",
  獅子座:"太陽", 乙女座:"水星", 天秤座:"金星", 蠍座:"冥王星",
  射手座:"木星", 山羊座:"土星", 水瓶座:"天王星", 魚座:"海王星"
};

/* ===========================================================
   ハウス分割
   HOUSE_SYS = "placidus" でプラシーダス、"equal" でイコールハウス。
   プラシーダスは 11・12・2・3 室を半弧の3分割から反復で求め、
   残りは向かい側（+180°）を取る。
   =========================================================== */
const HOUSE_SYS = "placidus";

function placidusCusps(ramcDeg, epsRad, latDeg) {
  const phi = rad(latDeg), ramc = ramcDeg;
  const lonOfRA = ra => norm(deg(Math.atan2(Math.sin(rad(ra)), Math.cos(rad(ra)) * Math.cos(epsRad))));

  // 11・12・2・3 室。offset は RAMC からの初期値、fn が半弧の取り方
  const spec = {
    11: r => ramc + (90 + r) / 3,
    12: r => ramc + 2 * (90 + r) / 3,
     2: r => ramc + 180 - 2 * (90 - r) / 3,
     3: r => ramc + 180 - (90 - r) / 3
  };
  const init = { 11: ramc + 30, 12: ramc + 60, 2: ramc + 120, 3: ramc + 150 };

  const out = {};
  for (const h of [11, 12, 2, 3]) {
    let ra = init[h];
    for (let i = 0; i < 40; i++) {
      const lam = rad(lonOfRA(ra));
      const dec = Math.asin(Math.sin(epsRad) * Math.sin(lam));
      let x = Math.tan(phi) * Math.tan(dec);
      x = Math.max(-1, Math.min(1, x));          // 高緯度で発散しないよう抑える
      const ad = deg(Math.asin(x));
      const next = spec[h](ad);
      if (Math.abs(next - ra) < 1e-9) { ra = next; break; }
      ra = next;
    }
    out[h] = lonOfRA(ra);
  }
  return out;
}

/* n室のカスプ黄経 */
function cuspLon(natal, n) {
  if (HOUSE_SYS !== "placidus" || !natal.cusps) return norm(natal.asc + 30 * (n - 1));
  return natal.cusps[n];
}

/* ネイタルの ASC を基準に、任意の黄経がどのハウスに入るか（5度前ルール込み） */
function houseOfLon(lon, natal) { return houseOf(lon, natal.cusps).house; }

/* n室について、チャートから読み取れることを全部集める */
function houseInfo(natal, transit, n) {
  const cusp = cuspLon(natal, n);
  const cuspSign = SIGNS[Math.floor(cusp / 30)];
  const rulerName = RULER[cuspSign];
  const ruler = natal.bodies.find(b => b.name === rulerName) || null;

  return {
    n, cusp, cuspSign,
    cuspGlyph: SIGN_GLYPH[Math.floor(cusp / 30)],
    cuspDeg: cusp % 30,
    rulerName, ruler,                                   // 支配星と、その実際の位置
    occupants: natal.bodies.filter(b => b.house === n), // 在住天体
    transits:  transit.bodies.filter(b => houseOfLon(b.lon, natal) === n)
  };
}

/* ===========================================================
   進行（セカンダリ・プログレッション）の月
   「出生から1日進む＝人生1年ぶん」という換算。
   進行の月は約2年半で1ハウス、約27年半で一周する。
   人生をハウスごとの時期に区切って見せられる。
   =========================================================== */

/* 進行の月がハウスを移った日を、出生から maxAge 歳まで拾う */
function progressedMoonPeriods(natal, birthY, birthM, birthD, birthH, birthMi, maxAge) {
  const n0 = jdays(birthY, birthM, birthD, birthH, birthMi);
  const birthMs = Date.UTC(birthY, birthM - 1, birthD, birthH, birthMi) - 9 * 3600 * 1000;
  const YEAR = 365.2422;

  const ageToDate = a => new Date(birthMs + a * YEAR * 86400000 + 9 * 3600 * 1000);
  const houseAt   = a => houseOf(moonLon(n0 + a), natal.cusps).house;

  const out = [];
  let cur = houseAt(0), start = 0;
  for (let a = 0.01; a <= maxAge; a += 0.01) {
    const h = houseAt(a);
    if (h !== cur) {
      out.push({ house: cur, fromAge: start, toAge: a, from: ageToDate(start), to: ageToDate(a) });
      cur = h; start = a;
    }
  }
  out.push({ house: cur, fromAge: start, toAge: maxAge, from: ageToDate(start), to: ageToDate(maxAge) });
  return out;
}

/* いまがどの期間かを返す */
function currentProgPeriod(periods, ageNow) {
  return periods.find(p => ageNow >= p.fromAge && ageNow < p.toAge) || null;
}

/* ある天体が、どのハウスのカスプを支配しているか（表の「支配するハウス」列） */
function rulesHouses(planetName, natal) {
  const out = [];
  for (let n = 1; n <= 12; n++) {
    const s = SIGNS[Math.floor(cuspLon(natal, n) / 30)];
    if (RULER[s] === planetName) out.push(n);
  }
  return out;
}

/* ---- アスペクト ---- */
const ASPECTS = [
  { name:"コンジャンクション", glyph:"☌"+VS, angle:  0, orb:8, type:"neutral" },
  { name:"セクスタイル",       glyph:"✳"+VS, angle: 60, orb:5, type:"soft"    },
  { name:"スクエア",           glyph:"□"+VS, angle: 90, orb:7, type:"hard"    },
  { name:"トライン",           glyph:"△"+VS, angle:120, orb:7, type:"soft"    },
  { name:"オポジション",       glyph:"☍"+VS, angle:180, orb:8, type:"hard"    }
];

function aspectBetween(a, b) {
  let diff = Math.abs(norm(a - b));
  if (diff > 180) diff = 360 - diff;
  for (const as of ASPECTS) {
    const orb = Math.abs(diff - as.angle);
    if (orb <= as.orb) return { ...as, orb };
  }
  return null;
}

/* 2つのチャート間のアスペクト（同じチャート内なら same=true） */
function findAspects(A, B, same) {
  const out = [];
  A.forEach((p, i) => {
    B.forEach((q, j) => {
      if (same && j <= i) return;
      const as = aspectBetween(p.lon, q.lon);
      if (as) out.push({ a: p, b: q, ...as });
    });
  });
  return out;
}

/* ===========================================================
   転機の日付を求める
   トランジットの木星・土星が、ネイタルの個人天体／ASC／MC に
   ぴったり重なる（オーブ0°になる）日を日単位で探す。
   =========================================================== */
const SLOW   = ["木星","土星"];                         // ゆっくり動く＝転機を作る星
const TARGET = ["太陽","月","水星","金星","火星"];      // 効き目が体感しやすい天体

/* 探索対象になるネイタル側の点 */
function turningTargets(natal, hasTime) {
  const pts = natal.bodies.filter(b => TARGET.includes(b.name))
                          .map(b => ({ name: b.name, lon: b.lon, glyph: b.glyph }));
  if (hasTime) {
    pts.push({ name:"ASC", lon: natal.asc, glyph:"Asc" });
    pts.push({ name:"MC",  lon: natal.mc,  glyph:"MC"  });
  }
  return pts;
}

/* 指定した日数ぶん先（負なら過去）を走査して、オーブが極小になる日を拾う */
function scanHits(pts, fromDays, toDays, aspectFilter) {
  const hits = [];
  const prev = new Map();   // キーごとに前日のオーブを覚えておく

  for (let n = fromDays; n <= toDays; n++) {
    for (const slow of SLOW) {
      const sl = lonOf(slow, n);
      for (const p of pts) {
        for (const as of ASPECTS) {
          if (aspectFilter && !aspectFilter.includes(as.name)) continue;
          let diff = Math.abs(norm(sl - p.lon));
          if (diff > 180) diff = 360 - diff;
          const orb = Math.abs(diff - as.angle);
          const key = slow + "/" + p.name + "/" + as.name;
          const before = prev.get(key);
          // 前日より縮んでいたのが、今日から広がりはじめた＝昨日が最接近
          if (before !== undefined && before.orb <= orb && before.falling && before.orb < 0.5) {
            hits.push({ n: n - 1, slow, point: p, aspect: as, orb: before.orb });
          }
          prev.set(key, { orb, falling: before === undefined ? false : orb < before.orb });
        }
      }
    }
  }
  return hits;
}

/* J2000 からの経過日数 → JSTの Date */
function daysToDate(n) {
  return new Date((n + 10957.5) * 86400000 + 9 * 3600 * 1000);
}

/* これから訪れる転機を、近い順に並べて返す */
function nextTurnings(natal, hasTime, todayN, count) {
  const pts = turningTargets(natal, hasTime);
  const hits = scanHits(pts, Math.floor(todayN) + 1, Math.floor(todayN) + 1400)
                 .sort((a, b) => a.n - b.n);
  const out = [];
  for (const h of hits) {
    // 同じ日に重なったものは1つにまとめる
    if (out.length && Math.abs(h.n - out[out.length - 1].n) < 20) continue;
    out.push({ n: h.n, date: daysToDate(h.n), slow: h.slow,
               point: h.point.name, aspect: h.aspect.name });
    if (out.length >= (count || 2)) break;
  }
  return out;
}

/* いちばん近い1件だけ */
function nextTurning(natal, hasTime, todayN) {
  return nextTurnings(natal, hasTime, todayN, 1)[0] || null;
}

/* 過去にあった、いちばん近いハードな時期（呼びかけに使う） */
function pastHardTime(natal, todayN) {
  const pts = natal.bodies.filter(b => ["太陽","月"].includes(b.name))
                          .map(b => ({ name:b.name, lon:b.lon }));
  const hits = scanHits(pts, Math.floor(todayN) - 3650, Math.floor(todayN) - 200,
                        ["スクエア","オポジション","コンジャンクション"])
                 .filter(h => h.slow === "土星")
                 .sort((a, b) => b.n - a.n);
  if (!hits.length) return null;
  const h = hits[0];
  return { date: daysToDate(h.n), point: h.point.name, aspect: h.aspect.name };
}

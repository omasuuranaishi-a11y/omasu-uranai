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
const RULE_5DEG   = true;   // 5度前ルールを使うか
const ORB_5DEG    = 5;      // 何度前から次のハウスとみなすか

function houseOf(lon, asc) {
  const shift = RULE_5DEG ? ORB_5DEG : 0;
  const plain = Math.floor(norm(lon - asc) / 30) + 1;              // ルールなしの場合
  const ruled = Math.floor(norm(lon - asc + shift) / 30) + 1;      // ルールありの場合
  return { house: ruled, moved: ruled !== plain, plain };
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

  const bodies = PLANETS.map(name => {
    const L = lonOf(name, n);
    const h = houseOf(L, asc);
    return {
      name, lon: L,
      sign: SIGNS[Math.floor(L / 30)],
      glyph: GLYPH[name],
      signGlyph: SIGN_GLYPH[Math.floor(L / 30)],
      deg: (L % 30),
      house: h.house,          // 5度前ルール適用後
      houseMoved: h.moved,     // このルールで1つ繰り上がったか
      housePlain: h.plain      // ルールを使わない場合のハウス
    };
  });
  return { n, asc, mc, bodies };
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

/* これから訪れる、いちばん近い転機 */
function nextTurning(natal, hasTime, todayN) {
  const pts = turningTargets(natal, hasTime);
  const hits = scanHits(pts, Math.floor(todayN) + 1, Math.floor(todayN) + 900)
                 .sort((a, b) => a.n - b.n);
  if (!hits.length) return null;
  const h = hits[0];
  return { date: daysToDate(h.n), slow: h.slow, point: h.point.name, aspect: h.aspect.name };
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

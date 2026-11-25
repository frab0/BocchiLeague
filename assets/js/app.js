{
/* ===== Bocchi League: sito a pagina unica che legge i dati da /data ===== */
const $app = document.getElementById('app');
const cache = {};
const load = n => cache[n] ||= fetch(`data/${n}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(n); return r.json(); });
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lbl = s => s.replace('-', '/');
const fp = x => x == null ? '–' : Number(x).toLocaleString('it-IT', { minimumFractionDigits: x % 1 ? 1 : 0, maximumFractionDigits: 1 });
const slug = s => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const data = d => { const [y, m, g] = d.split('-').map(Number); return `${g} ${MESI[m - 1]} ${y}`; };
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const CREST_PATH = '<svg viewBox="0 0 24 24" class="ico"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>';

let CFG, MIS, ALBO;
const S = {}; // stagioni caricate

async function boot() {
  [CFG, MIS, ALBO] = await Promise.all([load('config'), load('mister'), load('albo')]);
  document.getElementById('anno').textContent = new Date().getFullYear();
  await Promise.all(CFG.stagioni.map(async id => { S[id] = prepara(await load('stagione-' + id)); }));
  window.addEventListener('hashchange', route);
  route();
}

/* ---------- dati derivati ---------- */
function prepara(st) {
  const G = st.giornate;
  st.haDati = G.length > 0;
  st.ultima = G.at(-1);
  st.finale = st.haDati ? st.ultima.classifica : (st.finale?.classifica || []);
  st.finalePunti = st.haDati ? st.ultima.classificaPunti
    : [...(st.finale || [])].sort((a, b) => b.fp - a.fp).map((r, i) => ({ pos: i + 1, squadra: r.squadra, fp: r.fp }));
  st.squadre = Object.keys(MIS.stagioni[st.id] || {});
  return st;
}
const mister = (sid, team) => MIS.stagioni[sid]?.[team] || '';
const colore = m => CFG.coloriMister[m] || '#9AB0A5';
const sigla = t => CFG.sigle[t] || t.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
function badge(team, sid, size = 36) {
  const m = mister(sid, team), img = CFG.stemmi[team];
  return `<span class="badge${img ? ' img' : ''}" style="--c:${colore(m)};--s:${size}px" aria-hidden="true">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('img');this.replaceWith('${esc(sigla(team))}')">` : esc(sigla(team))}</span>`;
}
const badgeMister = (m, size) => badge(Object.entries(MIS.stagioni[CFG.stagioneCorrente]).find(([, x]) => x === m)?.[0] || m, CFG.stagioneCorrente, size);
const teamCell = (team, sid, size) => `<span class="team">${badge(team, sid, size)}<span><b>${esc(team)}</b><small>${esc(mister(sid, team))}</small></span></span>`;
function risultato(p, team) {
  const [a, b] = p.casa === team ? [p.gc, p.gt] : [p.gt, p.gc];
  return a > b ? 'v' : a < b ? 's' : 'p';
}
function forma(st, team, n, k = 5) {
  const out = [];
  for (const g of st.giornate) {
    if (g.n > n) break;
    const p = g.partite.find(x => x.casa === team || x.trasferta === team);
    if (p) out.push(risultato(p, team));
  }
  return out.slice(-k);
}
function records() {
  const r = { best: null, worst: null, gap: null, goals: null };
  for (const id of CFG.stagioni) {
    const st = S[id];
    for (const g of st.giornate) {
      for (const [t, v] of Object.entries(g.punteggi)) {
        if (!r.best || v > r.best.v) r.best = { v, t, id, n: g.n };
        if (!r.worst || v < r.worst.v) r.worst = { v, t, id, n: g.n };
      }
      for (const p of g.partite) {
        const d = Math.abs(p.gc - p.gt), s = p.gc + p.gt;
        if (!r.gap || d > r.gap.d) r.gap = { d, p, id, n: g.n };
        if (!r.goals || s > r.goals.s) r.goals = { s, p, id, n: g.n };
      }
    }
  }
  return r;
}
function palmares() {
  const P = {};
  for (const m of MIS.mister) P[m] = { campionato: [], costruttori: [], ultimo: [] };
  for (const [id, a] of Object.entries(ALBO)) for (const k of ['campionato', 'costruttori', 'ultimo']) P[a[k].mister]?.[k].push(id);
  return P;
}
const coppa = n => `<span class="trophy" title="${n} titoli"><svg viewBox="0 0 24 24" fill="none" stroke="#FF8A1F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3M12 14v4m-4 3h8"/></svg>${n}</span>`;
const stagioniConDati = () => CFG.stagioni.filter(id => S[id].haDati);
const stagioneUltima = () => stagioniConDati()[0];
const stagioneCampione = () => CFG.stagioni.find(id => ALBO[id]);

/* ---------- componenti ---------- */
const chipsStagione = (attiva, base, soloDati) => `<div class="chips" role="tablist" aria-label="Stagione">${CFG.stagioni
  .filter(id => !soloDati || S[id].haDati || id === CFG.stagioneCorrente)
  .map(id => `<a class="chip${id === attiva ? ' on' : ''}" href="#${base}-${id}" role="tab" aria-selected="${id === attiva}">${lbl(id)}</a>`).join('')}</div>`;

function matchCard(st, g, p, i, apribile) {
  const pc = g.punteggi[p.casa], pt = g.punteggi[p.trasferta];
  const lc = p.gc < p.gt, lt = p.gt < p.gc;
  return `<article class="match" data-i="${i}">
    <button type="button" ${apribile ? 'aria-expanded="false"' : 'tabindex="-1" style="cursor:default"'} aria-label="${esc(p.casa)} ${p.gc}, ${esc(p.trasferta)} ${p.gt}">
      <span class="sb"><span class="s${lc ? ' l' : ''}">${badge(p.casa, st.id, 30)}<b>${esc(sigla(p.casa))}</b><small>${fp(pc)}</small></span>
      <span class="x"><span class="${lc ? 'l' : ''}">${p.gc}</span><i>–</i><span class="${lt ? 'l' : ''}">${p.gt}</span></span>
      <span class="s r${lt ? ' l' : ''}">${badge(p.trasferta, st.id, 30)}<b>${esc(sigla(p.trasferta))}</b><small>${fp(pt)}</small></span></span>
      <span class="names"><span>${esc(p.casa)}</span><span>${esc(p.trasferta)}</span></span>
    </button>${apribile ? '<span class="more">Tocca per le formazioni</span>' : ''}
  </article>`;
}
function lineup(list) {
  if (!list) return '<p class="mute">Formazione non disponibile</p>';
  const row = x => `<div class="pl${x.ok ? (x.tit ? '' : ' in') : ' off'}"><span class="r ${x.r}">${x.r}</span><span class="n">${esc(x.nome)}</span><span class="v">${x.fv == null ? '–' : fp(x.fv)}</span></div>`;
  const tit = list.filter(x => x.tit), pan = list.filter(x => !x.tit && x.ok);
  return tit.map(row).join('') + (pan.length ? `<div class="bench">Entrati dalla panchina</div>${pan.map(row).join('')}` : '');
}
function tabella(st, righe, punti, n) {
  const ultimo = righe.length;
  return `<table class="table"><thead><tr><th class="pos">#</th><th>Squadra</th>
    ${punti ? '<th>Fantapunti</th>' : `<th>Pt</th><th class="hide-s">V-P-S</th><th class="hide-s">GF:GS</th><th class="hide-s">Forma</th><th>FP</th>`}</tr></thead><tbody>
    ${righe.map(r => `<tr class="${r.pos <= 1 ? 'top' : ''}${r.pos === ultimo ? ' last' : ''}">
      <td class="pos">${r.pos}</td><td>${teamCell(r.squadra, st.id, 34)}</td>
      ${punti ? `<td class="pt">${fp(r.fp)}</td>` : `<td><span class="pt">${r.pt}</span>${r.pen ? `<span class="pen" title="Penalità">${r.pen}</span>` : ''}</td>
      <td class="hide-s num">${r.v != null ? `${r.v}-${r.p}-${r.s}` : '–'}</td>
      <td class="hide-s num">${r.gf != null ? `${r.gf}:${r.gs}` : '–'}</td>
      <td class="hide-s"><span class="form">${forma(st, r.squadra, n ?? 99).map(x => `<i class="${x}" title="${{ v: 'Vittoria', p: 'Pareggio', s: 'Sconfitta' }[x]}"></i>`).join('')}</span></td>
      <td class="num mute">${fp(r.fp)}</td>`}
    </tr>`).join('')}</tbody></table>`;
}
const vuoto = (t, p, cta = '') => `<div class="empty"><b>${t}</b><p>${p}</p>${cta}</div>`;
const locandina = (sid, n) => CFG.locandine?.includes(`${sid}-${n}`) ? `<section class="section">
  <div class="section-head"><h2>La locandina</h2></div>
  <div class="poster"><img src="assets/img/locandine/${sid}-${n}.png" alt="Locandina della giornata ${n}" loading="lazy">
  <div class="poster-act"><button type="button" class="btn primary" data-share="assets/img/locandine/${sid}-${n}.png" data-nome="bocchi-league-${sid}-g${n}.png">Condividi</button><a class="btn" href="assets/img/locandine/${sid}-${n}.png" download="bocchi-league-${sid}-g${n}.png">Scarica</a></div></div>
</section>` : '';
const doc = f => /^https?:/.test(f) ? f : (CFG.docBase || '') + f;
const navBtn = (sid, n, t) => n != null ? `<a class="btn" href="#giornate-${sid}-${n}">${t}</a>` : `<span class="btn" aria-disabled="true">${t}</span>`;
const totale = id => CFG.totaleGiornate?.[id] ?? 38;

/* ---------- viste ---------- */
const V = {};

V.home = async () => {
  const [boll, gaz] = await Promise.all([load('bollettino'), load('gazzetta')]);
  const curr = S[CFG.stagioneCorrente], last = S[stagioneUltima()];
  const sc = stagioneCampione(), champ = ALBO[sc];
  const g = last.ultima, rec = records();
  const art = gaz[0];
  const rose = curr.rose.andata || {};
  const spesa = Object.entries(rose).map(([t, l]) => [t, l.reduce((s, x) => s + x.costo, 0)]).sort((a, b) => b[1] - a[1]);
  const maxS = Math.max(...spesa.map(x => x[1]), 1);
  return `<div class="view">
  <section class="hero">
    <picture><source media="(min-width: 700px)" srcset="assets/img/collage-largo.jpg"><img src="assets/img/collage-alto.jpg" alt="" fetchpriority="high"></picture>
    <div class="hero-in">
      <img class="hero-logo" src="assets/img/logo.jpg" alt="">
      <h1>Bocchi League</h1>
      <span class="hero-sub">Stagione ${lbl(CFG.stagioneCorrente)}${curr.haDati ? ` · dopo ${curr.ultima.n} giornate` : ''}</span>
    </div>
  </section>
  ${art ? `<section class="section">
    <span class="kicker">Giornata ${art.giornata} · ${lbl(art.stagione)}</span>
    <h2 style="font-size:clamp(34px,9vw,56px);line-height:.98">${esc(art.titolo)}</h2>
    <p class="mute" style="max-width:60ch">${esc(art.sommario)}</p>
    <a class="btn primary" style="justify-self:start" href="#gazzetta-${art.stagione}-${art.giornata}">Leggi la Gazzetta</a>
  </section>` : ''}

  <section class="section">
    <div class="section-head"><h2>Risultati · G${g.n}</h2><a href="#giornate-${last.id}-${g.n}">Dettaglio giornata</a></div>
    <div class="matches">${g.partite.map((p, i) => matchCard(last, g, p, i, false)).join('')}</div>
  </section>

  ${curr.haDati ? `<section class="section">
    <div class="section-head"><h2>Classifica</h2><a href="#classifica-${curr.id}">Completa</a></div>
    <div class="card" style="padding:8px 8px">${tabella(curr, curr.ultima.classifica, false)}</div>
  </section>` : ''}

  ${curr.prossime?.length ? `<section class="section">
    <div class="section-head"><h2>Prossimo turno · G${curr.prossime[0].n}</h2><a href="#giornate-${curr.id}-${curr.prossime[0].n}">Calendario</a></div>
    <div class="matches">${curr.prossime[0].partite.map(p => fixture(curr.id, p)).join('')}</div>
  </section>` : ''}

  <section class="card champ" aria-label="Campione in carica">
    <span class="k">Campione in carica · ${lbl(sc)}</span>
    <div class="row">${badge(champ.campionato.squadra, sc, 60)}<div><h3>${esc(champ.campionato.squadra)}</h3><span class="mute">Mister ${esc(champ.campionato.mister)}</span></div></div>
    <div class="facts"><span><b>${champ.campionato.punti}</b> punti</span>${champ.costruttori.mister === champ.campionato.mister ? `<span>Anche <b>Costruttori</b> con ${fp(champ.costruttori.fantapunti)} fantapunti</span>` : ''}<a href="#albo" style="color:var(--red);font-weight:700;text-decoration:none">Albo d'oro</a></div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Record della lega</h2><a href="#albo">Tutti i record</a></div>
    <div class="grid3">
      ${statTile(fp(rec.best.v), 'Miglior punteggio in una giornata', `${rec.best.t} · G${rec.best.n} ${lbl(rec.best.id)}`)}
      ${statTile(`${rec.gap.p.gc}–${rec.gap.p.gt}`, 'Vittoria più larga', `${rec.gap.p.casa} – ${rec.gap.p.trasferta} · ${lbl(rec.gap.id)}`)}
      ${statTile(`${rec.goals.p.gc}–${rec.goals.p.gt}`, 'Partita con più gol', `${rec.goals.p.casa} – ${rec.goals.p.trasferta} · ${lbl(rec.goals.id)}`)}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>Il mercato ${lbl(curr.id)}</h2><a href="#rose-${curr.id}">Rose</a></div>
    <div class="card"><div class="bars">${spesa.map(([t, s], i) => `<div class="bar"><span class="t${i === 0 ? ' best' : ''}"><i style="width:${(s / maxS * 100).toFixed(1)}%"></i>${esc(t)}</span><span class="num">${s}</span></div>`).join('')}</div><p class="mute" style="margin-top:10px;font-size:14px">Valore d'acquisto delle rose attuali, scambi compresi.</p></div>
  </section>
  </div>`;
};
const statTile = (big, l, who) => `<div class="stat"><span class="big">${big}</span><span class="lbl">${esc(l)}</span><span class="who">${esc(who)}</span></div>`;
function crest() {
  return `<svg class="crest" viewBox="0 0 260 260" role="img" aria-label="Stemma della Bocchi League">
    <defs><clipPath id="cc"><circle cx="130" cy="130" r="94"/></clipPath><path id="rp" d="M130,130 m-112,0 a112,112 0 1,1 224,0 a112,112 0 1,1 -224,0"/></defs>
    <circle cx="130" cy="130" r="128" fill="#0A1712" stroke="#FF8A1F" stroke-width="3"/>
    <g class="ring"><text><textPath href="#rp" textLength="700" lengthAdjust="spacing">BOCCHI LEAGUE · FEDERAZIONE · DAL ${CFG.fondazione} ·</textPath></text></g>
    <circle cx="130" cy="130" r="97" fill="#FF8A1F"/>
    <image href="assets/img/logo.jpg" x="36" y="36" width="188" height="188" clip-path="url(#cc)" preserveAspectRatio="xMidYMid slice"/>
  </svg>`;
}
function decreto(c, short) {
  const corpo = c.tipo === 'immagine' ? `<img class="att" src="${esc(c.immagine)}" alt="Allegato al comunicato" loading="lazy">`
    : c.tipo === 'citazione' ? `<blockquote>${c.testo.map(md).join('')}</blockquote><p>Fonte: <a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.fonte)}</a></p>`
    : c.testo.map(t => `<p>${md(t)}</p>`).join('');
  return `<article class="decree${short ? ' short' : ''}" id="comunicato-${c.id}">
    <header><img src="assets/img/logo.jpg" alt=""><div><div class="ente">Federazione Bocchi League</div><div class="prot">Comunicato ufficiale n. ${c.id} · ${data(c.data)}</div></div></header>
    <h3>${esc(c.titolo)}</h3>${short && c.tipo === 'testo' ? `<p>${md(c.testo[0])}</p>` : corpo}
    ${short ? `<a href="#bollettino">Leggi il comunicato</a>` : `<div class="firma">Il Presidente federale<b>La Presidenza</b></div>`}
  </article>`;
}

V.classifica = async (sid, modo) => {
  sid = sid || stagioneUltima();
  const st = S[sid];
  const punti = modo === 'costruttori';
  let corpo;
  if (!st.finale.length) corpo = vuoto(`Classifica ${lbl(sid)} in arrivo`, 'La stagione è iniziata: la classifica comparirà qui con il primo aggiornamento dei risultati.', `<a class="btn" href="#rose-${sid}">Guarda le rose</a>`);
  else {
    const righe = punti ? st.finalePunti : st.finale;
    const conclusa = st.haDati && st.ultima.n === totale(sid);
    corpo = `<div class="card" style="padding:12px 10px">${tabella(st, righe, punti)}</div>
      ${!punti && st.haDati ? `<div class="legend"><span>Pt = punti, V-P-S = vittorie, pareggi, sconfitte, FP = fantapunti</span><span><b style="color:var(--loss)">−1</b> = penalità</span></div>` : ''}
      <p class="mute">${st.haDati ? (conclusa ? 'Classifica finale.' : `Aggiornata alla giornata ${st.ultima.n}.`) : 'Classifica finale. Per questa stagione non abbiamo il dettaglio delle giornate.'}</p>
      ${st.haDati ? `<section class="section"><h3>Andamento</h3><div class="card"><div class="fig" id="bump"></div></div></section>` : ''}`;
  }
  return `<div class="view">
    <div class="head"><h2>Classifica</h2></div>
    ${chipsStagione(sid, 'classifica')}
    <div><div class="seg" role="tablist"><button class="${punti ? '' : 'on'}" data-go="#classifica-${sid}">Campionato</button><button class="${punti ? 'on' : ''}" data-go="#classifica-${sid}-costruttori">Costruttori</button></div></div>
    ${corpo}
  </div>`;
};
function disegnaBump(st, punti) {
  const el = document.getElementById('bump');
  if (!el) return;
  const draw = () => {
    const W = el.clientWidth, H = el.clientHeight, padL = 8, padR = 46, padT = 14, padB = 22;
    const G = st.giornate, n = G.length;
    const x = i => padL + i * (W - padL - padR) / Math.max(n - 1, 1);
    const y = p => padT + (p - 1) * (H - padT - padB) / 5;
    let s = '';
    for (let p = 1; p <= 6; p++) s += `<line x1="${padL}" x2="${W - padR}" y1="${y(p)}" y2="${y(p)}" stroke="rgba(234,241,236,.06)"/>`;
    const step = W < 520 ? 10 : 5;
    G.forEach((g, i) => { if (g.n % step === 0) s += `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">G${g.n}</text>`; });
    for (const team of st.squadre) {
      const pts = G.map((g, i) => { const r = (punti ? g.classificaPunti : g.classifica).find(r => r.squadra === team); return r ? `${x(i).toFixed(1)},${y(r.pos).toFixed(1)}` : null; }).filter(Boolean);
      const c = colore(mister(st.id, team));
      const last = pts.at(-1).split(',');
      s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" opacity=".9"/>
        <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${c}"/><text x="${+last[0] + 8}" y="${+last[1] + 4}" style="fill:${c};font-weight:700">${esc(sigla(team))}</text>`;
    }
    el.innerHTML = `<svg role="img" aria-label="Posizione in classifica giornata per giornata">${s}</svg>`;
  };
  const ro = new ResizeObserver(draw); ro.observe(el);
}

V.giornate = async (sid, n) => {
  sid = sid || stagioneUltima();
  const st = S[sid];
  if (!st.haDati) return `<div class="view"><div class="head"><h2>Giornate</h2></div>${chipsStagione(sid, 'giornate')}
    ${vuoto(`Giornate ${lbl(sid)} in arrivo`, sid === CFG.stagioneCorrente ? 'Risultati, formazioni e punteggi compariranno qui con il primo aggiornamento.' : 'Per questa stagione abbiamo solo la classifica finale.', `<a class="btn" href="#classifica-${sid}">Vai alla classifica</a>`)}</div>`;
  const fut = (st.prossime || []).find(x => x.n === +n);
  if (fut) return giornataFutura(st, fut);
  const G = st.giornate;
  const g = G.find(x => x.n === +n) || st.ultima;
  const i = G.indexOf(g);
  const form = CFG.formazioni?.includes(sid);
  const art = (await load('gazzetta')).find(a => a.stagione === sid && a.giornata === g.n);
  const pun = Object.entries(g.punteggi).sort((a, b) => b[1] - a[1]);
  const maxP = pun[0][1], minP = Math.min(...pun.map(x => x[1])) - 8;
  return `<div class="view">
    <div class="head"><h2>Giornata ${g.n}</h2><p>Stagione ${lbl(sid)}${g.serieA ? ` · ${g.serieA}ª di Serie A` : ''}</p></div>
    ${chipsStagione(sid, 'giornate')}
    ${chipsGiornate(st, g.n)}
    ${art ? `<a class="issue" href="#gazzetta-${sid}-${g.n}"><span class="n">${g.n}</span><span><small>La Gazzetta Bocchi League</small><h3>${esc(art.titolo)}</h3></span></a>` : ''}
    <section class="section"><div class="matches" id="partite">${g.partite.map((p, k) => matchCard(st, g, p, k, form)).join('')}</div></section>
    <div class="gsplit">
      <section class="card section"><h3>Punteggi di giornata</h3><div class="bars">${pun.map(([t, v], k) => `<div class="bar"><span class="t${k === 0 ? ' best' : ''}"><i style="width:${((v - minP) / (maxP - minP) * 100).toFixed(1)}%"></i>${esc(t)}</span><span class="num">${fp(v)}</span></div>`).join('')}</div></section>
      <section class="card section" style="padding:12px 10px"><h3 style="padding:4px 8px 0">Classifica dopo la ${g.n}ª</h3><div class="scroll">${tabella(st, g.classifica, false, g.n)}</div></section>
    </div>
    ${locandina(sid, g.n)}
    <div class="nav-g">${navBtn(sid, G[i - 1]?.n, 'Precedente')}${navBtn(sid, G[i + 1]?.n ?? st.prossime?.[0]?.n, 'Successiva')}</div>
  </div>`;
};
function chipsGiornate(st, att) {
  const tutte = [...st.giornate.map(x => [x.n, false]), ...(st.prossime || []).map(x => [x.n, true])];
  return `<div class="chips" id="gchips" aria-label="Giornata">${tutte.map(([k, f]) => `<a class="chip g${k === att ? ' on' : ''}${f ? ' fut' : ''}" href="#giornate-${st.id}-${k}">${k}</a>`).join('')}</div>`;
}
const fixture = (sid, p) => `<article class="match"><span class="sb"><span class="s">${badge(p.casa, sid, 30)}<b>${esc(sigla(p.casa))}</b></span><span class="x vs">VS</span><span class="s r">${badge(p.trasferta, sid, 30)}<b>${esc(sigla(p.trasferta))}</b></span></span><span class="names"><span>${esc(p.casa)}</span><span>${esc(p.trasferta)}</span></span></article>`;
const teamCellInner = (team, sid) => `<span><b>${esc(team)}</b><small>${esc(mister(sid, team))}</small></span>`;
function giornataFutura(st, f) {
  const i = st.prossime.indexOf(f), prev = i ? st.prossime[i - 1].n : st.ultima?.n, next = st.prossime[i + 1]?.n;
  return `<div class="view">
    <div class="head"><h2>Giornata ${f.n}</h2><p>Stagione ${lbl(st.id)} · ${f.serieA}ª di Serie A · da giocare</p></div>
    ${chipsStagione(st.id, 'giornate')}
    ${chipsGiornate(st, f.n)}
    <div class="matches">${f.partite.map(p => fixture(st.id, p)).join('')}</div>
    <div class="nav-g">${navBtn(st.id, prev, 'Precedente')}${navBtn(st.id, next, 'Successiva')}</div>
  </div>`;
}
function dopoGiornate(sid, n) {
  document.querySelector('#gchips .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const st = S[sid || stagioneUltima()];
  if (!st?.haDati || !CFG.formazioni?.includes(st.id)) return;
  const g = st.giornate.find(x => x.n === +n) || st.ultima;
  document.getElementById('partite')?.addEventListener('click', async e => {
    const art = e.target.closest('.match'); if (!art) return;
    const btn = art.querySelector('button');
    const open = art.querySelector('.lineups');
    if (open) { open.remove(); btn.setAttribute('aria-expanded', 'false'); art.querySelector('.more').textContent = 'Tocca per le formazioni'; return; }
    const F = await load('formazioni-' + st.id);
    const p = g.partite[art.dataset.i], f = F[g.n] || {};
    art.insertAdjacentHTML('beforeend', `<div class="lineups"><div class="lineup">${lineup(f[p.casa])}</div><div class="lineup">${lineup(f[p.trasferta])}</div></div>`);
    btn.setAttribute('aria-expanded', 'true');
    art.querySelector('.more').textContent = 'Chiudi';
  });
}

V.mister = async (nome) => {
  if (nome) return misterScheda(MIS.mister.find(m => slug(m) === nome));
  const P = palmares();
  const ordine = [...MIS.mister].sort((a, b) => (P[b].campionato.length * 10 + P[b].costruttori.length) - (P[a].campionato.length * 10 + P[a].costruttori.length));
  return `<div class="view"><div class="head"><h2>I Mister</h2><p>Sei allenatori, sempre gli stessi dal ${CFG.fondazione}. Cambiano solo i nomi delle squadre.</p></div>
    <div class="grid2">${ordine.map(m => {
      const cur = Object.entries(MIS.stagioni[CFG.stagioneCorrente]).find(([, x]) => x === m)?.[0];
      return `<a class="mcard" href="#mister-${slug(m)}">
        <div class="mhead">${badge(cur, CFG.stagioneCorrente, 56)}<div><h3>${esc(m)}</h3><span class="mute">${esc(cur)}</span></div></div>
        <div class="facts"><span>${coppa(P[m].campionato.length)} ${P[m].campionato.length === 1 ? 'Scudetto' : 'Scudetti'}</span><span><b>${P[m].costruttori.length}</b> Costruttori</span>${P[m].ultimo.length ? `<span><b style="color:var(--loss)">${P[m].ultimo.length}</b> ${P[m].ultimo.length === 1 ? 'volta' : 'volte'} ultimo</span>` : ''}</div>
        <div class="career">${carriera(m).map(c => `<div><span class="y">${lbl(c.id)}</span><span>${esc(c.team)}</span><span class="p${c.pos === 1 && !c.inCorso ? ' g' : ''}">${c.pos ? c.pos + 'º' : '–'}</span></div>`).join('')}</div>
      </a>`;
    }).join('')}</div></div>`;
};
function carriera(m) {
  return CFG.stagioni.map(id => {
    const team = Object.entries(MIS.stagioni[id] || {}).find(([, x]) => x === m)?.[0];
    const r = S[id].finale.find(r => r.squadra === team);
    return { id, team, pos: r?.pos ?? null, inCorso: id === CFG.stagioneCorrente, r };
  }).filter(c => c.team);
}
function misterScheda(m) {
  if (!m) return vuoto('Mister non trovato', 'Torna all\'elenco dei Mister.', '<a class="btn" href="#mister">Tutti i Mister</a>');
  const P = palmares()[m];
  const t = { g: 0, v: 0, p: 0, s: 0, gf: 0, gs: 0, fp: 0, ns: 0, best: null, worst: null };
  const h2h = {};
  for (const id of stagioniConDati()) {
    const st = S[id], team = Object.entries(MIS.stagioni[id]).find(([, x]) => x === m)?.[0];
    for (const g of st.giornate) {
      const v = g.punteggi[team];
      if (v != null) {
        t.fp += v; t.ns++;
        if (!t.best || v > t.best.v) t.best = { v, id, n: g.n };
        if (!t.worst || v < t.worst.v) t.worst = { v, id, n: g.n };
      }
      const p = g.partite.find(x => x.casa === team || x.trasferta === team);
      if (!p) continue;
      const casa = p.casa === team, gf = casa ? p.gc : p.gt, gs = casa ? p.gt : p.gc;
      const avv = mister(id, casa ? p.trasferta : p.casa), r = risultato(p, team);
      t.g++; t[r]++; t.gf += gf; t.gs += gs;
      h2h[avv] ||= { v: 0, p: 0, s: 0 }; h2h[avv][r]++;
    }
  }
  const car = carriera(m);
  const cur = car[0];
  return `<div class="view">
    <a href="#mister" class="mute" style="text-decoration:none">← Tutti i Mister</a>
    <div class="mhead">${badge(cur.team, cur.id, 76)}<div><h2>${esc(m)}</h2><span class="mute">Oggi alla guida di ${esc(cur.team)}</span></div></div>
    <div class="grid3">
      ${statTile(P.campionato.length, 'Scudetti', P.campionato.map(lbl).join(', ') || 'Nessuno, per ora')}
      ${statTile(P.costruttori.length, 'Titoli Costruttori', P.costruttori.map(lbl).join(', ') || 'Nessuno, per ora')}
      ${statTile(t.ns ? fp(Math.round(t.fp / t.ns * 10) / 10) : '–', 'Media fantapunti a giornata', `${t.ns} giornate dal 24/25`)}
      ${statTile(t.best ? fp(t.best.v) : '–', 'Miglior giornata', t.best ? `G${t.best.n} ${lbl(t.best.id)}` : '')}
    </div>
    <section class="section"><h3>Bilancio dal 24/25</h3>
      <div class="card"><div class="facts" style="font-size:17px"><span><b>${t.v}</b> vittorie</span><span><b>${t.p}</b> pareggi</span><span><b>${t.s}</b> sconfitte</span><span><b>${t.gf}</b> gol fatti</span><span><b>${t.gs}</b> gol subiti</span></div></div>
    </section>
    <section class="section"><h3>Testa a testa</h3>
      <div class="card" style="padding:12px 10px"><table class="table"><thead><tr><th class="pos"></th><th>Contro</th><th>V</th><th>P</th><th>S</th></tr></thead><tbody>
      ${Object.entries(h2h).sort((a, b) => (b[1].v - b[1].s) - (a[1].v - a[1].s)).map(([a, r]) => `<tr><td class="pos">${badgeMister(a, 30)}</td><td><a href="#mister-${slug(a)}" style="text-decoration:none;font-weight:600">${esc(a)}</a></td><td class="num" style="color:var(--win)">${r.v}</td><td class="num">${r.p}</td><td class="num" style="color:var(--loss)">${r.s}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="section"><h3>Carriera</h3>
      <div class="card career">${car.map(c => `<div><span class="y">${lbl(c.id)}</span><span class="team">${badge(c.team, c.id, 28)}<span>${esc(c.team)}</span></span><span class="p${c.pos === 1 && !c.inCorso ? ' g' : ''}">${c.pos ? c.pos + 'º' + (c.inCorso ? ' <small class="mute" style="font-size:12px;font-weight:500">ora</small>' : '') : 'in corso'}</span></div>`).join('')}</div>
    </section>
  </div>`;
}

V.albo = async () => {
  const P = palmares(), rec = records();
  const aw = (k, a, id, cls = '') => `<div class="award">${badge(a.squadra, id, 40)}<div><div class="k">${k}</div><b>${esc(a.squadra)}</b> <span class="mute">${esc(a.mister)}</span></div></div>`;
  return `<div class="view">
    <div class="head"><h2>Albo d'oro</h2><p>Scudetto al primo in classifica, titolo Costruttori al primo per fantapunti, e un posto d'onore per chi chiude ultimo.</p></div>
    <div class="honours">${Object.keys(ALBO).map(id => `<div class="season-row"><span class="yr">${lbl(id)}</span><div class="awards">
      ${aw('Scudetto', ALBO[id].campionato, id)}${aw('Costruttori', ALBO[id].costruttori, id)}${aw('Ultimo classificato', ALBO[id].ultimo, id)}
    </div></div>`).join('')}</div>
    <section class="section"><h3>Bacheca per Mister</h3>
      <div class="card" style="padding:12px 10px"><table class="table"><thead><tr><th class="pos"></th><th>Mister</th><th>Scudetti</th><th>Costr.</th><th>Ultimo</th></tr></thead><tbody>
      ${MIS.mister.map(m => [m, P[m]]).sort((a, b) => (b[1].campionato.length - a[1].campionato.length) || (b[1].costruttori.length - a[1].costruttori.length)).map(([m, p]) => `<tr><td class="pos">${badgeMister(m, 30)}</td><td><a href="#mister-${slug(m)}" style="text-decoration:none;font-weight:600">${esc(m)}</a></td><td class="pt">${p.campionato.length}</td><td class="num">${p.costruttori.length}</td><td class="num" style="color:var(--loss)">${p.ultimo.length}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="section"><h3>Record dal 24/25</h3><div class="grid3">
      ${statTile(fp(rec.best.v), 'Miglior punteggio in una giornata', `${rec.best.t} · G${rec.best.n} ${lbl(rec.best.id)}`)}
      ${statTile(fp(rec.worst.v), 'Peggior punteggio in una giornata', `${rec.worst.t} · G${rec.worst.n} ${lbl(rec.worst.id)}`)}
      ${statTile(`${rec.gap.p.gc}–${rec.gap.p.gt}`, 'Vittoria più larga', `${rec.gap.p.casa} – ${rec.gap.p.trasferta} · G${rec.gap.n} ${lbl(rec.gap.id)}`)}
      ${statTile(`${rec.goals.p.gc}–${rec.goals.p.gt}`, 'Partita con più gol', `${rec.goals.p.casa} – ${rec.goals.p.trasferta} · G${rec.goals.n} ${lbl(rec.goals.id)}`)}
    </div></section>
  </div>`;
};

V.bollettino = async () => {
  const b = await load('bollettino');
  return `<div class="view"><div class="head"><h2>Bollettino della Federazione</h2><p>Comunicati ufficiali, sentenze e atti della Presidenza, dal più recente.</p></div>
    <div style="display:grid;gap:18px;max-width:760px">${b.map(c => decreto(c, false)).join('')}</div></div>`;
};

V.regolamento = async () => `<div class="view">
  <div class="head"><h2>Regolamento ${lbl(CFG.stagioneCorrente)}</h2><p>Il testo firmato da tutti i Mister, con le correzioni a penna. Fa fede il PDF.</p></div>
  <div><a class="btn primary" href="${doc('common/stagione26_27/regolamento26_27.pdf')}" target="_blank" rel="noopener">Scarica il regolamento (PDF)</a></div>
  <div class="pages">${[1, 2, 3].map(i => `<a href="assets/img/regolamento/r2627-${i}.jpg" target="_blank" rel="noopener" aria-label="Pagina ${i} di 3"><img src="assets/img/regolamento/r2627-${i}.jpg" alt="Pagina ${i} del regolamento" loading="lazy"></a>`).join('')}</div>
  <section class="section"><h3>Stagioni precedenti</h3><div class="links"><a class="link dl" href="${doc('common/stagione25_26/regolamento25_26.pdf')}" target="_blank" rel="noopener"><span>Regolamento 25/26<small>PDF</small></span><svg class="dl-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg></a></div></section>
</div>`;

V.rose = async (sid, team) => {
  sid = sid || CFG.stagioneCorrente;
  const st = S[sid];
  const fasi = Object.keys(st.rose);
  if (!fasi.length) return `<div class="view"><div class="head"><h2>Rose</h2></div>${chipsStagione(sid, 'rose')}${vuoto('Rose non disponibili', 'Per questa stagione non abbiamo l\'elenco delle rose.')}</div>`;
  const fase = fasi.at(-1), R = st.rose[fase];
  const ordine = 'PDCA';
  return `<div class="view"><div class="head"><h2>Rose</h2><p>${fase === 'ritorno' ? 'Girone di ritorno, dopo l\'asta di riparazione.' : sid === CFG.stagioneCorrente ? 'Dopo l\'asta di inizio stagione.' : 'Girone d\'andata.'} Accanto a ogni giocatore, i crediti spesi.</p></div>
    ${chipsStagione(sid, 'rose')}
    <div class="chips" aria-label="Vai alla squadra">${Object.keys(R).map((t, k) => `<button type="button" class="chip" data-jump="rosa-${k}">${esc(t)}</button>`).join('')}</div>
    <div class="grid2">${Object.entries(R).map(([t, l], k) => `<section class="card section" id="rosa-${k}">
      <div class="section-head">${teamCell(t, sid, 40)}<span class="num" style="font-size:22px;text-align:right">${l.reduce((s, x) => s + x.costo, 0)}<small class="mute" style="font-size:13px"> cr spesi</small>${st.crediti?.[t] != null ? `<small class="mute" style="display:block;font-size:13px;font-weight:500">${st.crediti[t]} residui</small>` : ''}</span></div>
      <div class="roster">${[...l].sort((a, b) => ordine.indexOf(a.r) - ordine.indexOf(b.r) || b.costo - a.costo).map(x => `<div class="pl"><span class="r ${x.r}">${x.r}</span><span class="n">${esc(x.nome)}${x.club ? `<span class="club">${esc(x.club)}</span>` : ''}</span><span class="v num">${x.costo}</span></div>`).join('')}</div>
    </section>`).join('')}</div></div>`;
};

V.gazzetta = async (sid, n) => {
  const gaz = await load('gazzetta');
  if (sid && n) {
    const a = gaz.find(x => x.stagione === sid && x.giornata === +n);
    if (a) return articolo(a);
  }
  return `<div class="view"><div class="head"><h2>La Gazzetta Bocchi League</h2><p>Il racconto di ogni giornata: risultati, sorpassi, record e le parole dei Mister.</p></div>
    <div style="display:grid;gap:8px;max-width:760px">${gaz.map(a => `<a class="issue" href="#gazzetta-${a.stagione}-${a.giornata}"><span class="n">${a.giornata}</span><span><small>Giornata ${a.giornata} · ${lbl(a.stagione)} · ${data(a.data)}</small><h3>${esc(a.titolo)}</h3></span></a>`).join('')}</div></div>`;
};
function articolo(a) {
  const st = S[a.stagione], g = st.giornate.find(x => x.n === a.giornata);
  const prima = st.giornate.find(x => x.n === a.giornata - 1);
  const mov = t => { if (!prima) return ''; const d = prima.classifica.find(r => r.squadra === t).pos - g.classifica.find(r => r.squadra === t).pos; return d > 0 ? '<span style="color:var(--win)">▲</span>' : d < 0 ? '<span style="color:var(--red)">▼</span>' : '<span class="mute">–</span>'; };
  return `<div class="view"><article class="paper">
    <a href="#gazzetta" class="mute" style="text-decoration:none;font-size:14px">← La Gazzetta Bocchi League</a>
    <span class="kicker">Giornata ${a.giornata}${g?.serieA ? ` · ${g.serieA}ª di Serie A` : ''}</span>
    <h1 style="font-size:clamp(36px,10vw,60px)">${esc(a.titolo)}</h1>
    <p class="lead">${esc(a.sommario)}</p>
    <span class="by">Redazione federale · ${data(a.data)}</span>
    ${a.pezzi.map(z => `<section class="section">
      ${g ? matchCard(st, g, g.partite[z.partita], z.partita, false) : ''}
      <h2>${esc(z.titolo)}</h2>
      <div class="body section">${z.testo.map(t => `<p>${esc(t)}</p>`).join('')}</div>
      ${(z.dichiarazioni || []).map(d => `<div class="quote"><b>${esc(d.ruolo || 'Parla il Mister')} · ${esc(d.mister)}</b><p>“${esc(d.testo)}”</p></div>`).join('')}
    </section>`).join('')}
    ${a.top ? `<div class="topflop"><div><span class="k" style="color:var(--win)">TOP DELLA GIORNATA</span><span class="big">${fp(a.top.valore)}</span><b>${esc(a.top.squadra)}</b><small class="mute">${esc(a.top.nota)}</small></div><div><span class="k" style="color:var(--red)">FLOP DELLA GIORNATA</span><span class="big">${fp(a.flop.valore)}</span><b>${esc(a.flop.squadra)}</b><small class="mute">${esc(a.flop.nota)}</small></div></div>` : ''}
    ${g ? `<section class="section"><h2>La classifica dopo la ${g.n}ª</h2><div class="card" style="padding:4px 12px">${g.classifica.map(r => `<div style="display:grid;grid-template-columns:30px minmax(0,1fr) 20px 40px;gap:10px;align-items:center;min-height:50px;border-bottom:1px solid var(--line)"><span class="num" style="font-size:22px;text-align:center;color:${r.pos === 1 ? 'var(--red)' : 'var(--faint)'}">${r.pos}</span>${teamCell(r.squadra, st.id, 28)}${mov(r.squadra)}<span class="num" style="font-size:24px;text-align:right">${r.pt}</span></div>`).join('')}</div></section>` : ''}
    ${locandina(a.stagione, a.giornata)}
    ${a.chiusura ? `<section class="section"><h2>${esc(a.chiusura.titolo)}</h2><div class="body"><p>${esc(a.chiusura.testo)}</p></div></section>` : ''}
  </article></div>`;
}

V.archivio = async () => `<div class="view"><div class="head"><h2>Archivio stagioni</h2><p>Tutte le stagioni dal ${CFG.fondazione}, con i file originali esportati dall'app.</p></div>
  ${CFG.stagioni.map(id => {
    const st = S[id], a = ALBO[id];
    return `<section class="card section"><div class="section-head"><h3>Stagione ${lbl(id)}</h3>${a ? `<span class="mute">Scudetto a <b style="color:var(--ink)">${esc(a.campionato.squadra)}</b></span>` : '<span class="live">In corso</span>'}</div>
      <div class="chips"><a class="chip" href="#classifica-${id}">Classifica</a>${st.haDati ? `<a class="chip" href="#giornate-${id}">Giornate</a>` : ''}${Object.keys(st.rose).length ? `<a class="chip" href="#rose-${id}">Rose</a>` : ''}</div>
      <div class="links">${(CFG.documenti[id] || []).map(d => `<a class="link dl" href="${doc(d.file)}" target="_blank" rel="noopener"><span>${esc(d.titolo)}<small>${/^https?:/.test(d.file) ? 'Sito esterno' : esc(d.file.split('.').pop().toUpperCase())}</small></span><svg class="dl-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg></a>`).join('')}</div>
    </section>`;
  }).join('')}</div>`;

const ICO = {
  gazzetta: '<path d="M5 4h11v16H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM16 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3"/>',
  mister: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/>',
  albo: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3M12 14v4m-4 3h8"/>',
  bollettino: '<path d="M4 9v6h4l6 4V5L8 9zM18 9a4 4 0 0 1 0 6"/>',
  regolamento: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/>',
  rose: '<path d="M8 4h8l4 3-2 4h-2v9H8v-9H6L4 7z"/>',
  archivio: '<path d="M4 5h16v4H4zM5 9h14v11H5zM10 13h4"/>'
};
const voce = (h, k, t, d) => `<a class="link" href="#${h}"><span class="lt"><span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg></span><span>${t}<small>${d}</small></span></span></a>`;
V.altro = async () => `<div class="view"><div class="head"><h2>Tutta la lega</h2></div><div class="links">
  ${voce('gazzetta', 'gazzetta', 'La Gazzetta Bocchi League', 'Il racconto di ogni giornata')}
  ${voce('mister', 'mister', 'I Mister', 'Carriere, titoli e testa a testa')}
  ${voce('albo', 'albo', "Albo d'oro", 'Scudetti, Costruttori e record')}
  ${voce('bollettino', 'bollettino', 'Bollettino della Federazione', 'Comunicati ufficiali')}
  ${voce('regolamento', 'regolamento', `Regolamento ${lbl(CFG.stagioneCorrente)}`, 'Da scaricare in PDF')}
  ${voce('rose', 'rose', 'Rose', "Squadre e crediti spesi all'asta")}
  ${voce('archivio', 'archivio', 'Archivio stagioni', `File originali dal ${CFG.fondazione}`)}
</div></div>`;

/* ---------- router ---------- */
const TAB = { home: 'home', classifica: 'classifica', giornate: 'giornate', gazzetta: 'gazzetta', mister: 'mister', albo: 'albo', bollettino: 'bollettino' };
async function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || 'home';
  const [nome, ...rest] = h.split('-');
  const sid = rest.length >= 2 && /^\d\d$/.test(rest[0]) ? `${rest[0]}-${rest[1]}` : null;
  const extra = sid ? rest.slice(2).join('-') : rest.join('-');
  const view = V[nome] ? nome : 'home';
  let html;
  try {
    html = view === 'mister' ? await V.mister(extra) : await V[view](sid, extra);
  } catch (e) {
    console.error(e);
    html = vuoto('Pagina non disponibile', 'Non riesco a caricare questi dati. Ricarica la pagina o torna alla home.', '<a class="btn" href="#home">Torna alla home</a>');
  }
  $app.innerHTML = html;
  const tab = TAB[view] || 'altro';
  const tabBasso = ['home', 'classifica', 'giornate', 'gazzetta'].includes(tab) ? tab : 'altro';
  document.querySelectorAll('.topnav [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  document.querySelectorAll('.tabbar [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === tabBasso));
  document.title = view === 'home' ? 'Bocchi League' : `${$app.querySelector('h2')?.textContent || ''} · Bocchi League`;
  window.scrollTo(0, 0);
  if (view === 'classifica' && S[sid || stagioneUltima()]?.haDati) disegnaBump(S[sid || stagioneUltima()], extra === 'costruttori');
  if (view === 'giornate') dopoGiornate(sid, extra);
}
async function condividi(url, nome) {
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], nome, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Bocchi League' }); return; }
  } catch (err) { if (err?.name === 'AbortError') return; }
  window.open(url, '_blank', 'noopener');
}
$app.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (b) location.hash = b.dataset.go;
  const sh = e.target.closest('[data-share]');
  if (sh) condividi(sh.dataset.share, sh.dataset.nome);
  const j = e.target.closest('[data-jump]'); if (j) document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

boot().catch(e => { console.error(e); $app.innerHTML = vuoto('Sito non disponibile', 'Non riesco a caricare i dati della lega. Ricarica la pagina tra poco.'); });
}

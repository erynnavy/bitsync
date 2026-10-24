'use strict';

/* BitSync drills: interactive extras (kind "drill") — Cisco IOS CLI, subnetting, VLSM.
   Loaded before app.js; everything here runs only when a drill is opened, so it may use
   app.js helpers ($, esc, inline, prefs, state, prog, saveSoon, toast, ICON) at call time. */

/* ================= IPv4 helpers ================= */

const ipToInt = (s) => {
  const m = String(s ?? '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
};
const intToIp = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const prefixMask = (len) => (len <= 0 ? 0 : (0xffffffff << (32 - len)) >>> 0);
const maskStr = (len) => intToIp(prefixMask(len));
const maskToPrefix = (s) => {
  const n = ipToInt(s);
  if (n === null) return null;
  const bits = n.toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? bits.indexOf('0') === -1 ? 32 : bits.indexOf('0') : null;
};
const netOf = (ip, len) => (ip & prefixMask(len)) >>> 0;
const bcastOf = (ip, len) => (netOf(ip, len) + 2 ** (32 - len) - 1) >>> 0;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sameIp = (input, want) => ipToInt(input) !== null && ipToInt(input) === ipToInt(want);
const sameNum = (input, want) => String(input ?? '').trim().replace(/^\//, '') !== '' && Number(String(input).trim().replace(/^\//, '').replace(/,/g, '')) === Number(want);

// The octet (0–3) where a prefix's interval lives, and the interval itself.
function intervalInfo(len) {
  const oct = Math.min(3, Math.floor((len - 1) / 8));
  return { oct, size: 2 ** (8 * (oct + 1) - len), octName: ['1st', '2nd', '3rd', '4th'][oct] };
}
const octetBits = (len, oct) => { const b = Math.max(0, Math.min(8, len - oct * 8)); return '1'.repeat(b) + '0'.repeat(8 - b); };

// Random base networks in the style of the class exercises.
function randomBase(kinds = ['A', 'B', 'C']) {
  const k = pick(kinds);
  if (k === 'A') return { net: ipToInt('10.0.0.0'), len: 8 };
  if (k === 'B') return { net: ipToInt(`172.${rnd(16, 31)}.0.0`), len: 16 };
  return { net: ipToInt(`192.168.${rnd(0, 99)}.0`), len: 24 };
}

/* ================= subnetting (fixed-length) ================= */

// One table problem: "Subnet X/len into N subnets" or "...largest segment needs H hosts".
function makeSubnetProblem() {
  const base = randomBase();
  const byHosts = Math.random() < 0.35;
  let bits, need;
  if (byHosts) {
    const hostBits = { 8: rnd(8, 18), 16: rnd(4, 12), 24: rnd(2, 6) }[base.len];
    bits = 32 - hostBits - base.len;
    need = rnd(2 ** (hostBits - 1) - 1, 2 ** hostBits - 2);
  } else {
    bits = { 8: rnd(2, 10), 16: rnd(2, 8), 24: rnd(2, 5) }[base.len];
    need = rnd(2 ** (bits - 1) + 1, 2 ** bits);
  }
  const len = base.len + bits;
  const count = 2 ** bits;
  const block = 2 ** (32 - len);
  const sns = count <= 3 ? [...Array(count).keys()] : [0, rnd(1, count - 2), count - 1];
  const rows = sns.map((sn) => {
    const na = (base.net + sn * block) >>> 0;
    return { sn, na: intToIp(na), first: intToIp(na + 1), last: intToIp(na + block - 2), ba: intToIp(na + block - 1) };
  });
  return { base, byHosts, need, bits, len, count, block, mask: maskStr(len), rows, ...intervalInfo(len) };
}

function subnetQuestion(pr) {
  const b = `${intToIp(pr.base.net)}/${pr.base.len}`;
  return pr.byHosts
    ? `You are given **${b}**. The largest segment needs **${pr.need} hosts**. Subnet it so every segment fits, then fill the table for the listed subnets.`
    : `Subnet the **${b}** address space into **${pr.need} subnets**, then fill the table for the listed subnets.`;
}

function subnetSolution(pr) {
  const steps = [];
  const b = `/${pr.base.len}`;
  if (pr.byHosts) {
    const hb = 32 - pr.len;
    steps.push({ do: `Find the host bits: $2^H - 2 \\ge ${pr.need}$, so $H = ${hb}$.`,
      why: `$2^{${hb}} - 2 = ${2 ** hb - 2}$ usable hosts is enough, while $2^{${hb - 1}} - 2 = ${2 ** (hb - 1) - 2}$ is too few. We subtract 2 for the network and broadcast addresses.` });
    steps.push({ do: `New prefix: $32 - ${hb} = /${pr.len}$. Borrowed bits: $${pr.len} - ${pr.base.len} = ${pr.bits}$, so there are $2^{${pr.bits}} = ${pr.count}$ subnets.`,
      why: 'Whatever is not a host bit belongs to the network part.' });
  } else {
    steps.push({ do: `Find the borrowed bits: $2^N \\ge ${pr.need}$, so $N = ${pr.bits}$.`,
      why: `$2^{${pr.bits}} = ${pr.count}$ subnets is enough, while $2^{${pr.bits - 1}} = ${2 ** (pr.bits - 1)}$ is too few.` });
    steps.push({ do: `New prefix: $${b} + ${pr.bits} = /${pr.len}$.`, why: 'Each borrowed bit moves from the host part to the network part.' });
  }
  steps.push({ do: `Subnet mask: the ${pr.octName} octet becomes \`${octetBits(pr.len, pr.oct)}\`, so the mask is **${pr.mask}**.`,
    why: 'Add the place values 128, 64, 32, 16, 8, 4, 2, 1 of every 1 bit in that octet.' });
  steps.push({ do: `Interval (block size): $256 - ${(prefixMask(pr.len) >>> (8 * (3 - pr.oct))) & 255} = ${pr.size}$ in the ${pr.octName} octet.`,
    why: 'Each new subnet starts this far after the previous one. It is also the value of the last 1 bit in the mask octet.' });
  for (const r of pr.rows) {
    steps.push({ do: `SN ${r.sn}: NA = ${r.na}, HA = ${r.first} to ${r.last}, BA = ${r.ba}.`,
      why: `The network address is $${r.sn} \\times ${pr.size}$ intervals after the start. Hosts run from NA + 1 to BA − 1, and the broadcast is one less than the next subnet's network address.` });
  }
  return steps;
}

/* ================= VLSM ================= */

const SEGMENT_NAMES = 'ABCDEFGHIJKL'.split('');

// A VLSM table problem: LANs of different sizes plus point-to-point links, assigned largest first.
function makeVlsmProblem(size) {
  for (let tries = 0; tries < 200; tries++) {
    const big = Math.random() < 0.3;
    const base = big ? { net: ipToInt(`172.${rnd(16, 31)}.${rnd(0, 63) * 2}.0`), len: 23 } : { net: ipToInt(`192.168.${rnd(0, 99)}.0`), len: 24 };
    const lanCount = size === 'full' ? rnd(4, 5) : rnd(2, 3);
    const linkCount = size === 'full' ? rnd(2, 3) : 1;
    const maxHosts = big ? 250 : 120;
    const lans = Array.from({ length: lanCount }, () => rnd(3, maxHosts));
    const segs = [...lans.map((h) => ({ need: h })), ...Array.from({ length: linkCount }, () => ({ need: 2 }))];
    segs.forEach((s, i) => { s.name = SEGMENT_NAMES[i]; s.hb = Math.ceil(Math.log2(s.need + 2)); s.block = 2 ** s.hb; });
    const total = segs.reduce((a, s) => a + s.block, 0);
    if (total > 2 ** (32 - base.len)) continue;
    const order = segs.slice().sort((a, b) => b.need - a.need);
    let at = base.net;
    for (const s of order) {
      s.len = 32 - s.hb; s.possible = s.block - 2; s.mask = maskStr(s.len);
      s.na = intToIp(at); s.first = intToIp(at + 1); s.last = intToIp(at + s.block - 2); s.ba = intToIp(at + s.block - 1);
      at += s.block;
    }
    return { base, segs, order, used: total };
  }
  return null;
}

function vlsmSolution(pr) {
  const steps = [{ do: `List the segments from largest to smallest: ${pr.order.map((s) => `${s.name} (${s.need})`).join(', ')}.`,
    why: 'VLSM assigns the biggest subnet first, so every block starts on a boundary that fits its size and no space is wasted.' }];
  for (const s of pr.order) {
    steps.push({ do: `**${s.name}** needs ${s.need} hosts. Block of ${s.block} (possible hosts ${s.possible}), so **/${s.len}**, mask ${s.mask}.`,
      why: `$2^{${s.hb}} - 2 = ${s.possible} \\ge ${s.need}$${s.hb > 2 ? `, while $2^{${s.hb - 1}} - 2 = ${2 ** (s.hb - 1) - 2}$ is too few` : ''}. Prefix = $32 - ${s.hb}$ host bits.` });
    steps.push({ do: `${s.name}: NA ${s.na}, HA ${s.first} to ${s.last}, BA ${s.ba}.`,
      why: `It starts where the previous block ended. Broadcast = NA + ${s.block} − 1; hosts sit between them.` });
  }
  const left = 2 ** (32 - pr.base.len) - pr.used;
  steps.push({ do: `${pr.used} of ${2 ** (32 - pr.base.len)} addresses used; ${left} left for growth.`, why: 'Checking the total confirms every block fits inside the given network.' });
  return steps;
}

/* ================= quick questions ================= */

// Each generator returns { q, answer, check(input), steps }.
const QUICK = {
  mask() { const len = rnd(8, 30); return { q: `What is the subnet mask for **/${len}**?`, answer: maskStr(len), check: (v) => sameIp(v, maskStr(len)),
    steps: [{ do: `/${len} means ${len} ones from the left.`, why: `Full octets of ones are 255; the ${intervalInfo(len).octName} octet is \`${octetBits(len, intervalInfo(len).oct)}\`.` }] }; },
  prefix() { const len = rnd(8, 30); return { q: `Write **${maskStr(len)}** in slash notation.`, answer: `/${len}`, check: (v) => sameNum(v, len),
    steps: [{ do: `Count the 1 bits: ${maskStr(len).split('.').map((o) => (+o).toString(2).replace(/0/g, '').length).join(' + ')} = ${len}.`, why: 'Each octet of the mask contributes the number of 1 bits it contains.' }] }; },
  hosts() { const len = rnd(16, 30); const h = 2 ** (32 - len) - 2; return { q: `How many **usable hosts** are in a **/${len}** subnet?`, answer: String(h), check: (v) => sameNum(v, h),
    steps: [{ do: `Host bits = 32 − ${len} = ${32 - len}. $2^{${32 - len}} - 2 = ${h}$.`, why: 'The first address is the network address and the last is the broadcast, so they cannot go to hosts.' }] }; },
  block() { const len = pick([17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30]); const i = intervalInfo(len); return { q: `What is the **block size (interval)** of a **/${len}**, and in which octet?`, answer: `${i.size} (${i.octName} octet)`, check: (v) => sameNum(String(v).split(/[\s(]/)[0], i.size),
    steps: [{ do: `The ${i.octName} octet of the mask is \`${octetBits(len, i.oct)}\`, whose last 1 bit is worth ${i.size}.`, why: `So subnets go up in steps of ${i.size} in the ${i.octName} octet.` }] }; },
  network() { const len = rnd(17, 30); const host = len <= 24 ? ipToInt(`172.16.${rnd(0, 255)}.${rnd(1, 254)}`) : ipToInt(`192.168.${rnd(0, 255)}.${rnd(1, 254)}`); const n = netOf(host, len); const i = intervalInfo(len);
    return { q: `What is the **network address** of **${intToIp(host)}/${len}**?`, answer: intToIp(n), check: (v) => sameIp(v, intToIp(n)),
      steps: [{ do: `Interval ${i.size} in the ${i.octName} octet. ${intToIp(host).split('.')[i.oct]} falls in the block that starts at ${intToIp(n).split('.')[i.oct]}.`, why: `Multiples of ${i.size}: the largest one not bigger than ${intToIp(host).split('.')[i.oct]} is ${intToIp(n).split('.')[i.oct]}. Octets after it become 0.` }] }; },
  broadcast() { const len = rnd(17, 30); const host = len <= 24 ? ipToInt(`10.${rnd(0, 255)}.${rnd(0, 255)}.${rnd(1, 254)}`) : ipToInt(`192.168.${rnd(0, 255)}.${rnd(1, 254)}`); const b = bcastOf(host, len); const i = intervalInfo(len);
    return { q: `What is the **broadcast address** of **${intToIp(host)}/${len}**?`, answer: intToIp(b), check: (v) => sameIp(v, intToIp(b)),
      steps: [{ do: `Network address: ${intToIp(netOf(host, len))}. Next network: ${intToIp(b + 1)}.`, why: `The broadcast is the last address before the next block (interval ${i.size} in the ${i.octName} octet).` }] }; },
  lastHost() { const len = rnd(19, 29); const host = ipToInt(`172.${rnd(16, 31)}.${rnd(0, 255)}.${rnd(1, 254)}`); const b = bcastOf(host, len);
    return { q: `What is the **last usable host** in the subnet of **${intToIp(host)}/${len}**?`, answer: intToIp(b - 1), check: (v) => sameIp(v, intToIp(b - 1)),
      steps: [{ do: `Broadcast is ${intToIp(b)}; one less is ${intToIp(b - 1)}.`, why: 'The last usable host is always broadcast − 1 (and the first is network + 1).' }] }; },
  subnets() { const from = pick([16, 24]); const to = rnd(from + 2, Math.min(from + 8, 30)); const n = 2 ** (to - from);
    return { q: `A **/${from}** network is divided into **/${to}** subnets. How many subnets?`, answer: String(n), check: (v) => sameNum(v, n),
      steps: [{ do: `Borrowed bits = ${to} − ${from} = ${to - from}. $2^{${to - from}} = ${n}$.`, why: 'Each borrowed bit doubles the number of subnets.' }] }; },
  next() { const len = rnd(18, 29); const host = len <= 24 ? ipToInt(`10.${rnd(0, 200)}.${rnd(0, 255)}.0`) : ipToInt(`192.168.${rnd(0, 200)}.${rnd(0, 250)}`); const n = netOf(host, len); const nx = (n + 2 ** (32 - len)) >>> 0;
    return { q: `What is the **next network** after **${intToIp(n)}/${len}**?`, answer: intToIp(nx), check: (v) => sameIp(v, intToIp(nx)),
      steps: [{ do: `Add the block size: ${intervalInfo(len).size} in the ${intervalInfo(len).octName} octet.`, why: `${intToIp(n)} + one block = ${intToIp(nx)}.` }] }; },
  borrow() { const base = pick([8, 16, 24]); const bits = rnd(2, base === 24 ? 5 : 8); const need = rnd(2 ** (bits - 1) + 1, 2 ** bits);
    return { q: `You must make **${need} subnets** from a **/${base}**. What is the new prefix?`, answer: `/${base + bits}`, check: (v) => sameNum(v, base + bits),
      steps: [{ do: `$2^N \\ge ${need}$, so N = ${bits} (since $2^{${bits}} = ${2 ** bits}$).`, why: `New prefix = /${base} + ${bits} = /${base + bits}.` }] }; },
  fitHosts() { const need = rnd(3, 1000); const hb = Math.ceil(Math.log2(need + 2)); return { q: `Which prefix is the smallest subnet that fits **${need} hosts**?`, answer: `/${32 - hb}`, check: (v) => sameNum(v, 32 - hb),
    steps: [{ do: `$2^{${hb}} - 2 = ${2 ** hb - 2} \\ge ${need}$, but $2^{${hb - 1}} - 2 = ${2 ** (hb - 1) - 2}$ is not.`, why: `So ${hb} host bits: /${32 - hb}.` }] }; },
  possible() { const need = rnd(3, 250); const hb = Math.ceil(Math.log2(need + 2)); return { q: `A segment needs **${need} hosts**. How many **possible hosts** does its VLSM block give?`, answer: String(2 ** hb - 2), check: (v) => sameNum(v, 2 ** hb - 2),
    steps: [{ do: `Smallest block with at least ${need} + 2 addresses: ${2 ** hb}.`, why: `Possible hosts = ${2 ** hb} − 2 = ${2 ** hb - 2}.` }] }; },
  first() { const needs = shuffle([rnd(100, 200), rnd(40, 99), rnd(10, 39), 2]); const big = Math.max(...needs);
    return { q: `In VLSM, which segment is assigned **first**: ${needs.map((n) => `${n} hosts`).join(', ')}?`, answer: String(big), check: (v) => sameNum(String(v).replace(/hosts?/i, ''), big),
      steps: [{ do: `The largest: ${big} hosts.`, why: 'VLSM always allocates from largest to smallest so the blocks line up without gaps.' }] }; },
  klass() { const first = pick([rnd(1, 126), rnd(128, 191), rnd(192, 223)]); const ip = `${first}.${rnd(0, 255)}.${rnd(0, 255)}.${rnd(1, 254)}`; const k = first < 128 ? 'A' : first < 192 ? 'B' : 'C';
    return { q: `Is **${ip}** a class A, B or C address?`, answer: k, check: (v) => String(v).trim().toUpperCase().replace(/^CLASS\s*/, '') === k,
      steps: [{ do: `First octet ${first}.`, why: 'Class A: 1–126, class B: 128–191, class C: 192–223.' }] }; },
};
const QUICK_SETS = {
  subnetting: ['mask', 'prefix', 'hosts', 'block', 'network', 'broadcast', 'lastHost', 'subnets', 'next', 'borrow', 'klass'],
  vlsm: ['fitHosts', 'possible', 'first', 'mask', 'hosts', 'next', 'network', 'broadcast'],
};

/* ================= Cisco IOS simulator (one device) ================= */

const portRange = (type, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${type}0/${from + i}`);
const IOS_MODELS = {
  1841: { kind: 'router', label: 'Cisco 1841 router', name: 'Router', ports: ['FastEthernet0/0', 'FastEthernet0/1', 'Serial0/0/0', 'Serial0/0/1'] },
  2911: { kind: 'router', label: 'Cisco 2911 router', name: 'Router', ports: ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2', 'Serial0/0/0', 'Serial0/0/1'] },
  2960: { kind: 'switch', label: 'Cisco 2960 switch', name: 'Switch', ports: [...portRange('FastEthernet', 1, 24), 'GigabitEthernet0/1', 'GigabitEthernet0/2'] },
  'l2-24g': { kind: 'switch', label: 'Layer 2 switch (24 gigabit ports)', name: 'Switch', ports: portRange('GigabitEthernet', 1, 24) },
  'l3-24g': { kind: 'l3switch', label: 'Multilayer switch (24 gigabit ports)', name: 'Switch', ports: portRange('GigabitEthernet', 1, 24) },
};
const IF_TYPES = [['FastEthernet', 'Fa'], ['GigabitEthernet', 'Gi'], ['Serial', 'Se'], ['Vlan', 'Vlan']];
const shortIf = (n) => { for (const [full, s] of IF_TYPES) if (n.startsWith(full)) return s + n.slice(full.length); return n; };

const newLine = () => ({ password: null, login: false, local: false, transport: null, sync: false, timeout: null });
function newIface(name, kind) {
  const sub = name.includes('.');
  const svi = name.startsWith('Vlan');
  const l2 = kind !== 'router' && !svi;
  return { ip: null, mask: null, shut: sub ? false : svi || kind === 'router', desc: null, l2, mode: l2 ? 'dynamic' : null,
    access: 1, allowed: null, native: 1, portfast: false, encap: null, clock: null };
}

function iosDevice(spec = {}) {
  const model = IOS_MODELS[spec.model] || IOS_MODELS[1841];
  const d = {
    model, hostname: spec.hostname || model.name, mode: 'user', ctx: [], pending: null,
    enableSecret: null, enablePassword: null, banner: null, encrypt: false, domainLookup: true, domainName: null,
    ssh: null, rsa: 0, ipRouting: model.kind === 'router', gateway: null, users: {},
    con: newLine(), vty: Array.from({ length: 16 }, newLine), ifaces: {}, vlans: {}, startup: null,
  };
  for (const n of model.ports) d.ifaces[n] = newIface(n, model.kind);
  if (model.kind !== 'router') { d.vlans[1] = 'default'; d.ifaces.Vlan1 = newIface('Vlan1', model.kind); }
  return d;
}

const CONFIG_KEYS = ['hostname', 'enableSecret', 'enablePassword', 'banner', 'encrypt', 'domainLookup', 'domainName', 'ssh', 'rsa',
  'ipRouting', 'gateway', 'users', 'con', 'vty', 'ifaces', 'vlans'];
const configOf = (d) => JSON.stringify(CONFIG_KEYS.map((k) => d[k]));
const isSaved = (d) => d.startup !== null && d.startup === configOf(d);
function restoreConfig(d, snap) {
  const fresh = iosDevice({ model: Object.keys(IOS_MODELS).find((k) => IOS_MODELS[k] === d.model) });
  const vals = snap ? JSON.parse(snap) : CONFIG_KEYS.map((k) => fresh[k]);
  CONFIG_KEYS.forEach((k, i) => { d[k] = vals[i]; });
}

function iosPrompt(d) {
  if (d.pending) return d.pending.prompt;
  return d.hostname + { user: '>', priv: '#', config: '(config)#', if: '(config-if)#', subif: '(config-subif)#',
    range: '(config-if-range)#', line: '(config-line)#', vlan: '(config-vlan)#' }[d.mode];
}

// IOS accepts any prefix of a keyword that is long enough to be unambiguous on a real device (`min`).
const ab = (tok, word, min = 1) => typeof tok === 'string' && tok.length >= min && word.startsWith(tok.toLowerCase());
class IosError { constructor(kind, at, text) { this.kind = kind; this.at = at; this.text = text; } }
const need = (c, i, word, min) => { if (c.toks[i] === undefined) throw new IosError('incomplete'); if (!ab(c.toks[i], word, min)) throw new IosError('invalid', i); };
const arg = (c, i) => { if (c.toks[i] === undefined) throw new IosError('incomplete'); return c.toks[i]; };
const end = (c, i) => { if (c.toks[i] !== undefined) throw new IosError('invalid', i); };
const num = (c, i, lo, hi) => { const v = arg(c, i); if (!/^\d+$/.test(v) || +v < lo || +v > hi) throw new IosError('invalid', i); return +v; };
const choose = (c, i, opts) => {
  const t = arg(c, i);
  const hits = opts.filter(([w]) => w.startsWith(t.toLowerCase()));
  const ok = hits.filter(([w, min]) => t.length >= (min || 1) || w === t.toLowerCase());
  if (ok.length === 1) return ok[0][0];
  if (hits.length) throw new IosError('ambiguous', i);
  throw new IosError('invalid', i);
};
const rest = (c, i) => { if (c.toks[i] === undefined) throw new IosError('incomplete'); return c.raw.slice(c.pos[i]); };
const ipArg = (c, i) => { const v = arg(c, i); if (ipToInt(v) === null) throw new IosError('invalid', i); return v; };
const toPriv = (d) => { d.mode = 'priv'; d.ctx = []; return ['%SYS-5-CONFIG_I: Configured from console by console']; };

// Parses "fa0/1", "gigabitEthernet 0/10", "g0/0.10", "vlan 99" into a canonical interface name.
function parseIface(d, text) {
  const m = String(text).trim().match(/^([a-z]+)\s*(\d+(?:\/\d+){0,2})(?:\.(\d+))?$/i);
  if (!m) return null;
  const word = m[1].toLowerCase();
  const type = IF_TYPES.find(([full]) => full.toLowerCase().startsWith(word) && (full !== 'Vlan' || word.length >= 2));
  if (!type) return null;
  if (type[0] === 'Vlan') {
    if (d.model.kind === 'router' || m[2].includes('/') || m[3] || +m[2] < 1 || +m[2] > 4094) return null;
    return `Vlan${+m[2]}`;
  }
  const base = type[0] + m[2];
  if (!d.model.ports.includes(base)) return null;
  if (m[3] !== undefined) return d.model.kind === 'router' && type[0] !== 'Serial' && +m[3] > 0 ? `${base}.${+m[3]}` : null;
  return base;
}
function ensureIface(d, name) {
  if (!d.ifaces[name]) d.ifaces[name] = newIface(name, d.model.kind);
  return d.ifaces[name];
}

function parseVlanList(text) {
  const out = new Set();
  for (const part of String(text).split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b > 4094 || b < a) return null;
    for (let v = a; v <= b; v++) out.add(v);
  }
  return [...out].sort((x, y) => x - y);
}
const vlanListText = (list) => {
  if (!list) return 'all';
  const parts = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    parts.push(j > i + 1 ? `${list[i]}-${list[j]}` : j === i + 1 ? `${list[i]},${list[j]}` : String(list[i]));
    i = j;
  }
  return parts.join(',');
};

/* ---- password display (service password-encryption uses Cisco type 7) ---- */
const XLAT = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';
function type7(pw) {
  const seed = pw.length % 16;
  let out = String(seed).padStart(2, '0');
  for (let i = 0; i < pw.length; i++) out += (pw.charCodeAt(i) ^ XLAT.charCodeAt((seed + i) % XLAT.length)).toString(16).toUpperCase().padStart(2, '0');
  return out;
}
function type5(pw) {
  const abc = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let h = 2166136261;
  const chars = [];
  for (let i = 0; i < 26; i++) { h ^= pw.charCodeAt(i % pw.length) + i; h = Math.imul(h, 16777619) >>> 0; chars.push(abc[h % 64]); }
  return `$1$${chars.slice(0, 4).join('')}$${chars.slice(4).join('')}`;
}
const linePw = (d, pw) => (d.encrypt ? `password 7 ${type7(pw)}` : `password ${pw}`);

/* ---- show commands ---- */

function cols(rows) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? String(c) : String(c).padEnd(w[i] + 1))).join('').trimEnd());
}
function ifaceOrder(d) {
  return Object.keys(d.ifaces).sort((a, b) => {
    const rank = (n) => (n.startsWith('Vlan') ? 2 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 2) return +a.slice(4) - +b.slice(4);
    const ia = d.model.ports.indexOf(a.split('.')[0]), ib = d.model.ports.indexOf(b.split('.')[0]);
    return ia - ib || (+(a.split('.')[1] || 0) - +(b.split('.')[1] || 0));
  });
}
function ifStatus(d, n) {
  const f = d.ifaces[n];
  if (f.shut || (n.includes('.') && d.ifaces[n.split('.')[0]].shut)) return ['administratively down', 'down'];
  if (f.l2 && f.mode === 'dynamic' && !f.desc) return ['down', 'down'];
  return ['up', 'up'];
}

function runningConfig(d) {
  const L = ['Building configuration...', '', `Current configuration : ${900 + configOf(d).length} bytes`, '!', 'version 15.1',
    d.encrypt ? 'service password-encryption' : 'no service password-encryption', '!', `hostname ${d.hostname}`, '!'];
  if (d.enableSecret) L.push(`enable secret 5 ${type5(d.enableSecret)}`);
  if (d.enablePassword) L.push(d.encrypt ? `enable password 7 ${type7(d.enablePassword)}` : `enable password ${d.enablePassword}`);
  if (d.enableSecret || d.enablePassword) L.push('!');
  if (!d.domainLookup) L.push('no ip domain-lookup');
  if (d.domainName) L.push(`ip domain-name ${d.domainName}`);
  if (d.ipRouting && d.model.kind === 'l3switch') L.push('ip routing');
  for (const [u, x] of Object.entries(d.users)) {
    L.push(`username ${u}${x.privilege !== undefined ? ` privilege ${x.privilege}` : ''} ${x.secret ? `secret 5 ${type5(x.secret)}` : linePw(d, x.password)}`);
  }
  if (d.ssh) L.push(`ip ssh version ${d.ssh}`);
  L.push('!');
  for (const n of ifaceOrder(d)) {
    const f = d.ifaces[n];
    L.push(`interface ${n}`);
    if (f.desc) L.push(` description ${f.desc}`);
    if (f.encap) L.push(` encapsulation dot1Q ${f.encap}${f.encapNative ? ' native' : ''}`);
    if (f.l2) {
      if (f.access !== 1) L.push(` switchport access vlan ${f.access}`);
      if (f.native !== 1) L.push(` switchport trunk native vlan ${f.native}`);
      if (f.allowed) L.push(` switchport trunk allowed vlan ${vlanListText(f.allowed)}`);
      if (f.mode === 'access' || f.mode === 'trunk') L.push(` switchport mode ${f.mode}`);
      if (f.portfast) L.push(' spanning-tree portfast');
    } else if (d.model.kind === 'l3switch' && !n.startsWith('Vlan')) L.push(' no switchport');
    if (f.ip) L.push(` ip address ${f.ip} ${f.mask}`);
    else if (!f.l2) L.push(' no ip address');
    if (f.clock) L.push(` clock rate ${f.clock}`);
    if (f.shut) L.push(' shutdown');
    L.push('!');
  }
  if (d.gateway) L.push(`ip default-gateway ${d.gateway}`, '!');
  if (d.banner !== null) L.push(`banner motd ^C${d.banner}^C`, '!');
  L.push('line con 0');
  if (d.con.timeout) L.push(` exec-timeout ${d.con.timeout}`);
  if (d.con.password) L.push(` ${linePw(d, d.con.password)}`);
  if (d.con.sync) L.push(' logging synchronous');
  if (d.con.login) L.push(d.con.local ? ' login local' : ' login');
  const groups = [[0, 4], [5, 15]];
  for (const [a, b] of groups) {
    const l = d.vty[a];
    L.push(`line vty ${a} ${b}`);
    if (l.password) L.push(` ${linePw(d, l.password)}`);
    if (l.login) L.push(l.local ? ' login local' : ' login');
    if (l.transport) L.push(` transport input ${l.transport}`);
  }
  L.push('!', 'end');
  return L;
}

function showIpIntBrief(d) {
  const rows = [['Interface', 'IP-Address', 'OK?', 'Method', 'Status', 'Protocol']];
  for (const n of ifaceOrder(d)) {
    const f = d.ifaces[n];
    const [st, pr] = ifStatus(d, n);
    rows.push([n, f.ip || 'unassigned', 'YES', f.ip ? 'manual' : 'unset', st, pr]);
  }
  return cols(rows);
}
function showVlanBrief(d) {
  const ids = Object.keys(d.vlans).map(Number).sort((a, b) => a - b);
  const rows = [['VLAN', 'Name', 'Status', 'Ports'], ['----', '----', '------', '-----']];
  for (const id of ids) {
    const ports = d.model.ports.filter((n) => { const f = d.ifaces[n]; return f.l2 && f.mode !== 'trunk' && f.access === id; }).map(shortIf);
    const chunks = [];
    for (let i = 0; i < ports.length; i += 2) chunks.push(ports.slice(i, i + 2).join(', '));
    rows.push([String(id), d.vlans[id], 'active', chunks[0] || '']);
    for (const ch of chunks.slice(1)) rows.push(['', '', '', ch]);
  }
  return cols(rows);
}
function showTrunks(d) {
  const t = d.model.ports.filter((n) => d.ifaces[n].l2 && d.ifaces[n].mode === 'trunk');
  if (!t.length) return [];
  return [...cols([['Port', 'Mode', 'Encapsulation', 'Status', 'Native vlan'], ...t.map((n) => [shortIf(n), 'on', '802.1q', 'trunking', String(d.ifaces[n].native)])]), '',
    ...cols([['Port', 'Vlans allowed on trunk'], ...t.map((n) => [shortIf(n), d.ifaces[n].allowed ? vlanListText(d.ifaces[n].allowed) : '1-4094'])])];
}
function showIpRoute(d) {
  if (!d.ipRouting) return [d.gateway ? `Default gateway is ${d.gateway}` : 'Default gateway is not set'];
  const L = ['Codes: L - local, C - connected, S - static', '', 'Gateway of last resort is not set', ''];
  for (const n of ifaceOrder(d)) {
    const f = d.ifaces[n];
    if (!f.ip || ifStatus(d, n)[1] !== 'up') continue;
    const len = maskToPrefix(f.mask);
    L.push(`C    ${intToIp(netOf(ipToInt(f.ip), len))}/${len} is directly connected, ${n}`, `L    ${f.ip}/32 is directly connected, ${n}`);
  }
  return L;
}

// Remembers which show commands were run, so a task can ask for one ({"show": "vlan brief"}).
function runShow(d, c, i, priv) {
  const out = showOutput(d, c, i, priv);
  if (!d.shows) d.shows = new Set();
  d.shows.add(c.toks.slice(i).map((t) => t.toLowerCase()).join(' ').replace(/^ru\S*$/, 'running-config').replace(/^star\S*$/, 'startup-config')
    .replace(/^ip int\S* br\S*$/, 'ip interface brief').replace(/^vl\S*( br\S*)?$/, 'vlan brief').replace(/^int\S* tr\S*$/, 'interfaces trunk')
    .replace(/^ip ro\S*$/, 'ip route'));
  return out;
}
function showOutput(d, c, i, priv) {
  const what = choose(c, i, [['running-config', 2], ['startup-config', 4], ['ip', 2], ['vlan', 2], ['interfaces', 3], ['version', 3],
    ['mac', 2], ['cdp', 2], ['clock', 2], ['history', 2], ['users', 2], ['flash', 2], ['spanning-tree', 2]]);
  if ((what === 'running-config' || what === 'startup-config') && !priv) throw new IosError('invalid', i);
  if (what === 'running-config') { end(c, i + 1); return runningConfig(d); }
  if (what === 'startup-config') {
    end(c, i + 1);
    if (!d.startup) return ['startup-config is not present'];
    const now = configOf(d);
    const copy = { ...d };
    CONFIG_KEYS.forEach((k, j) => { copy[k] = JSON.parse(d.startup)[j]; });
    return d.startup === now ? runningConfig(d).slice(2) : runningConfig(copy).slice(2);
  }
  if (what === 'ip') {
    const sub = choose(c, i + 1, [['interface', 3], ['route', 2]]);
    if (sub === 'interface') { need(c, i + 2, 'brief', 2); end(c, i + 3); return showIpIntBrief(d); }
    end(c, i + 2);
    return showIpRoute(d);
  }
  if (what === 'vlan') {
    if (d.model.kind === 'router') throw new IosError('invalid', i);
    if (c.toks[i + 1] !== undefined) { need(c, i + 1, 'brief', 2); end(c, i + 2); }
    return showVlanBrief(d);
  }
  if (what === 'interfaces') {
    if (c.toks[i + 1] !== undefined && ab(c.toks[i + 1], 'trunk', 2)) { end(c, i + 2); return showTrunks(d); }
    return ['(This drill shows: show ip interface brief, show interfaces trunk, show vlan brief, show running-config.)'];
  }
  if (what === 'version') return [`Cisco IOS Software (simulated ${d.model.label})`, `${d.hostname} uptime is 12 minutes`, `${d.model.ports.length} interfaces`, 'Configuration register is 0x2102'];
  return ['(This drill does not simulate that show command.)'];
}

/* ---- command tables per mode ---- */

function sessionEnd(d) {
  d.mode = 'user'; d.ctx = [];
  d.pending = { type: 'return', prompt: '' };
  return ['', `${d.hostname} con0 is now available`, '', 'Press RETURN to get started.'];
}
function askEnable(d) {
  if (!d.enableSecret && !d.enablePassword) { d.mode = 'priv'; return []; }
  d.pending = { type: 'enable', prompt: 'Password: ', secret: true, tries: 0 };
  return [];
}
function save(d) { d.startup = configOf(d); return ['Building configuration...', '[OK]']; }
function ping(d, c, i) {
  const ip = ipArg(c, i);
  const mine = Object.entries(d.ifaces).some(([n, f]) => f.ip === ip && ifStatus(d, n)[1] === 'up');
  return ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`,
    ...(mine ? ['!!!!!', 'Success rate is 100 percent (5/5)'] : ['.....', 'Success rate is 0 percent (0/5)', '(This drill simulates one device, so only its own addresses answer.)'])];
}

const EXEC_CMDS = {
  user: {
    enable: [2, (d, c) => { end(c, 1); return askEnable(d); }],
    exit: [2, (d, c) => { end(c, 1); return sessionEnd(d); }],
    logout: [2, (d) => sessionEnd(d)],
    ping: [2, (d, c) => ping(d, c, 1)],
    show: [2, (d, c) => runShow(d, c, 1, false)],
  },
  priv: {
    configure: [4, (d, c) => {
      if (c.toks[1] === undefined) { d.pending = { type: 'configure', prompt: 'Configuring from terminal, memory, or network [terminal]? ' }; return []; }
      need(c, 1, 'terminal', 1); end(c, 2);
      d.mode = 'config';
      return ['Enter configuration commands, one per line.  End with CNTL/Z.'];
    }],
    copy: [3, (d, c) => {
      need(c, 1, 'running-config', 2); need(c, 2, 'startup-config', 3); end(c, 3);
      d.pending = { type: 'copy', prompt: 'Destination filename [startup-config]? ' };
      return [];
    }],
    disable: [4, (d) => { d.mode = 'user'; return []; }],
    enable: [2, () => []],
    erase: [3, (d, c) => {
      need(c, 1, 'startup-config', 3); end(c, 2);
      d.pending = { type: 'erase', prompt: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]' };
      return [];
    }],
    exit: [2, (d) => sessionEnd(d)],
    logout: [2, (d) => sessionEnd(d)],
    ping: [2, (d, c) => ping(d, c, 1)],
    reload: [3, (d, c) => {
      end(c, 1);
      d.pending = isSaved(d) || !d.startup && configOf(d) === configOf(iosDevice({ model: Object.keys(IOS_MODELS).find((k) => IOS_MODELS[k] === d.model) }))
        ? { type: 'reload', prompt: 'Proceed with reload? [confirm]' }
        : { type: 'reload-save', prompt: 'System configuration has been modified. Save? [yes/no]: ' };
      return [];
    }],
    show: [2, (d, c) => runShow(d, c, 1, true)],
    write: [2, (d, c) => { if (c.toks[1] !== undefined) { need(c, 1, 'memory', 1); end(c, 2); } return save(d); }],
  },
};

const GLOBAL_CMDS = {
  banner: [2, (d, c) => {
    need(c, 1, 'motd', 1);
    const text = rest(c, 2);
    const delim = text[0];
    const close = text.indexOf(delim, 1);
    if (close > 0) { d.banner = text.slice(1, close); return []; }
    d.pending = { type: 'banner', prompt: '', delim, text: text.slice(1) };
    return [`Enter TEXT message.  End with the character '${delim}'.`];
  }],
  crypto: [2, (d, c) => {
    need(c, 1, 'key', 1); need(c, 2, 'generate', 1); need(c, 3, 'rsa', 1);
    if (d.hostname === d.model.name) return [`% Please define a hostname other than ${d.model.name}.`];
    if (!d.domainName) return ['% Please define a domain-name first.'];
    const head = [`The name for the keys will be: ${d.hostname}.${d.domainName}`];
    let i = 4;
    if (ab(c.toks[i], 'general-keys', 1)) i++;
    if (c.toks[i] !== undefined) { need(c, i, 'modulus', 1); const bits = num(c, i + 1, 360, 4096); end(c, i + 2); return [...head, ...genKeys(d, bits)]; }
    d.pending = { type: 'modulus', prompt: 'How many bits in the modulus [512]: ' };
    return [...head, 'Choose the size of the key modulus in the range of 360 to 4096 for your', '  General Purpose Keys. Choosing a key modulus greater than 512 may take', '  a few minutes.', ''];
  }],
  do: [2, (d, c) => {
    const sub = { toks: c.toks.slice(1), pos: c.pos.slice(1), raw: c.raw };
    if (!sub.toks.length) throw new IosError('incomplete');
    const mode = d.mode, ctx = d.ctx;
    d.mode = 'priv';
    try { return dispatch(d, sub, EXEC_CMDS.priv); } finally { if (d.mode === 'priv') { d.mode = mode; d.ctx = ctx; } }
  }],
  enable: [3, (d, c) => {
    const kind = choose(c, 1, [['secret', 1], ['password', 1]]);
    let v = arg(c, 2);
    if (v === '0' && c.toks[3] !== undefined) v = c.toks[3];
    if (kind === 'secret') d.enableSecret = v; else d.enablePassword = v;
    return [];
  }],
  end: [3, (d, c) => { end(c, 1); return toPriv(d); }],
  exit: [2, (d) => toPriv(d)],
  hostname: [2, (d, c) => {
    const name = arg(c, 1); end(c, 2);
    if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(name)) return ['% Hostname contains one or more illegal characters.'];
    d.hostname = name;
    return [];
  }],
  interface: [2, (d, c) => {
    if (ab(c.toks[1], 'range', 1) && c.toks[1].length >= 1 && /^r/i.test(c.toks[1])) {
      const text = rest(c, 2).replace(/\s*-\s*/g, '-');
      const names = [];
      for (const part of text.split(',')) {
        const m = part.trim().match(/^(.*?)(\d+)-(\d+)$/);
        const items = m ? Array.from({ length: +m[3] - +m[2] + 1 }, (_, k) => `${m[1]}${+m[2] + k}`) : [part.trim()];
        for (const it of items) { const n = parseIface(d, it); if (!n || n.startsWith('Vlan')) throw new IosError('invalid', 2); names.push(n); }
      }
      d.mode = 'range'; d.ctx = names;
      return [];
    }
    const name = parseIface(d, rest(c, 1));
    if (!name) throw new IosError('invalid', 1);
    ensureIface(d, name);
    d.mode = name.includes('.') ? 'subif' : 'if'; d.ctx = [name];
    return [];
  }],
  ip: [2, (d, c) => {
    const t = (c.toks[1] || '').toLowerCase();
    if (/^domain-l/.test(t) && 'domain-lookup'.startsWith(t)) { end(c, 2); d.domainLookup = true; return []; }
    if (/^domain-n/.test(t) && 'domain-name'.startsWith(t)) { d.domainName = arg(c, 2); end(c, 3); return []; }
    const sub = choose(c, 1, [['domain', 3], ['default-gateway', 9], ['routing', 5], ['ssh', 2], ['route', 5]]);
    if (sub === 'domain') {
      const w = choose(c, 2, [['lookup', 1], ['name', 1]]);
      if (w === 'lookup') { end(c, 3); d.domainLookup = true; } else { d.domainName = arg(c, 3); end(c, 4); }
      return [];
    }
    if (sub === 'default-gateway') { d.gateway = ipArg(c, 2); end(c, 3); return []; }
    if (sub === 'routing') { if (d.model.kind === 'switch') throw new IosError('invalid', 1); end(c, 2); d.ipRouting = true; return []; }
    if (sub === 'ssh') { need(c, 2, 'version', 1); d.ssh = num(c, 3, 1, 2); end(c, 4); return []; }
    return ['(Static routes are not part of this drill.)'];
  }],
  line: [2, (d, c) => {
    const kind = choose(c, 1, [['console', 1], ['vty', 1]]);
    if (kind === 'console') { if (num(c, 2, 0, 0) !== 0) throw new IosError('invalid', 2); end(c, 3); d.ctx = ['con']; }
    else {
      const a = num(c, 2, 0, 15);
      const b = c.toks[3] !== undefined ? num(c, 3, a, 15) : a;
      end(c, 4);
      d.ctx = Array.from({ length: b - a + 1 }, (_, k) => `vty${a + k}`);
    }
    d.mode = 'line';
    return [];
  }],
  no: [2, (d, c) => {
    const w = choose(c, 1, [['ip', 2], ['enable', 3], ['service', 3], ['banner', 2], ['vlan', 2], ['hostname', 2], ['username', 2]]);
    if (w === 'ip') {
      const t = (c.toks[2] || '').toLowerCase();
      if (/^domain-l/.test(t) && 'domain-lookup'.startsWith(t)) { end(c, 3); d.domainLookup = false; return []; }
      const sub = choose(c, 2, [['domain', 3], ['default-gateway', 9], ['routing', 5], ['domain-name', 8]]);
      if (sub === 'domain') { const x = choose(c, 3, [['lookup', 1], ['name', 1]]); if (x === 'lookup') d.domainLookup = false; else d.domainName = null; return []; }
      if (sub === 'domain-name') { d.domainName = null; return []; }
      if (sub === 'default-gateway') { d.gateway = null; return []; }
      if (d.model.kind === 'switch') throw new IosError('invalid', 2);
      d.ipRouting = false;
      return [];
    }
    if (w === 'enable') { const k = choose(c, 2, [['secret', 1], ['password', 1]]); if (k === 'secret') d.enableSecret = null; else d.enablePassword = null; return []; }
    if (w === 'service') { need(c, 2, 'password-encryption', 1); d.encrypt = false; return []; }
    if (w === 'banner') { need(c, 2, 'motd', 1); d.banner = null; return []; }
    if (w === 'hostname') { d.hostname = d.model.name; return []; }
    if (w === 'username') { delete d.users[arg(c, 2)]; return []; }
    if (d.model.kind === 'router') throw new IosError('invalid', 1);
    const id = num(c, 2, 2, 4094);
    delete d.vlans[id];
    return [];
  }],
  service: [3, (d, c) => { need(c, 1, 'password-encryption', 1); end(c, 2); d.encrypt = true; return []; }],
  username: [2, (d, c) => {
    const name = arg(c, 1);
    let i = 2;
    const u = {};
    if (ab(c.toks[i], 'privilege', 1) && /^p/i.test(c.toks[i]) && !ab(c.toks[i], 'password', 2)) { u.privilege = num(c, i + 1, 0, 15); i += 2; }
    const kind = choose(c, i, [['secret', 1], ['password', 2]]);
    let v = arg(c, i + 1);
    if (v === '0' && c.toks[i + 2] !== undefined) v = c.toks[i + 2];
    u[kind] = v;
    d.users[name] = u;
    return [];
  }],
  vlan: [2, (d, c) => {
    if (d.model.kind === 'router') throw new IosError('invalid', 0);
    const id = num(c, 1, 1, 4094); end(c, 2);
    if (id >= 1002 && id <= 1005) return [`% Default VLAN ${id} may not have its name changed.`];
    if (!d.vlans[id]) d.vlans[id] = `VLAN${String(id).padStart(4, '0')}`;
    d.mode = 'vlan'; d.ctx = [id];
    return [];
  }],
};

function genKeys(d, bits) {
  d.rsa = bits;
  return [`% Generating ${bits} bit RSA keys, keys will be non-exportable...[OK]`, '%SSH-5-ENABLED: SSH 1.99 has been enabled'];
}

// Commands inside interface / subinterface / range mode. `d.ctx` holds the interface names.
const IF_CMDS = {
  description: [3, (d, c) => { const t = rest(c, 1); d.ctx.forEach((n) => { d.ifaces[n].desc = t; }); return []; }],
  encapsulation: [3, (d, c) => {
    if (d.mode !== 'subif') throw new IosError('invalid', 0);
    need(c, 1, 'dot1q', 1);
    const v = num(c, 2, 1, 4094);
    const nat = c.toks[3] !== undefined ? (need(c, 3, 'native', 1), true) : false;
    end(c, nat ? 4 : 3);
    Object.assign(d.ifaces[d.ctx[0]], { encap: v, encapNative: nat });
    return [];
  }],
  clock: [2, (d, c) => {
    if (!d.ctx[0].startsWith('Serial')) throw new IosError('invalid', 0);
    need(c, 1, 'rate', 1); d.ifaces[d.ctx[0]].clock = num(c, 2, 1200, 8000000); end(c, 3);
    return [];
  }],
  ip: [2, (d, c) => {
    need(c, 1, 'address', 2);
    if (d.mode === 'range') throw new IosError('invalid', 0);
    const n = d.ctx[0];
    const f = d.ifaces[n];
    if (f.l2) throw new IosError('invalid', 0);
    const ip = ipArg(c, 2);
    const mask = ipArg(c, 3);
    end(c, 4);
    const len = maskToPrefix(mask);
    if (len === null || len > 30 && len !== 32) return [`% Bad mask /${len ?? '?'} for address ${ip}`];
    const ipn = ipToInt(ip);
    if (len < 31 && (ipn === netOf(ipn, len) || ipn === bcastOf(ipn, len))) return [`% Bad mask /${len} for address ${ip}`];
    if (n.includes('.') && !f.encap) return ['% Configuring IP routing on a LAN subinterface is only allowed if that', 'subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,', 'or ISL vLAN.'];
    for (const [other, g] of Object.entries(d.ifaces)) {
      if (other !== n && g.ip && netOf(ipToInt(g.ip), maskToPrefix(g.mask)) === netOf(ipn, len)) return [`% ${intToIp(netOf(ipn, len))} overlaps with ${other}`];
    }
    Object.assign(f, { ip, mask });
    return [];
  }],
  shutdown: [2, (d, c) => { end(c, 1); return setShut(d, true); }],
  'spanning-tree': [2, (d, c) => {
    need(c, 1, 'portfast', 5); end(c, 2);
    if (d.ctx.some((n) => !d.ifaces[n].l2)) throw new IosError('invalid', 0);
    d.ctx.forEach((n) => { d.ifaces[n].portfast = true; });
    return ['%Warning: portfast should only be enabled on ports connected to a single', ' host. Connecting hubs, concentrators, switches, bridges, etc... to this', ' interface  when portfast is enabled, can cause temporary bridging loops.', ' Use with CAUTION'];
  }],
  switchport: [2, (d, c) => {
    if (d.ctx.some((n) => !d.ifaces[n].l2)) throw new IosError('invalid', 0);
    const what = choose(c, 1, [['mode', 2], ['access', 2], ['trunk', 2], ['nonegotiate', 2]]);
    const each = (fn) => d.ctx.forEach((n) => fn(d.ifaces[n]));
    if (what === 'mode') {
      const m = choose(c, 2, [['access', 2], ['trunk', 1], ['dynamic', 1]]);
      if (m === 'dynamic') choose(c, 3, [['auto', 1], ['desirable', 1]]);
      each((f) => { f.mode = m === 'dynamic' ? 'dynamic' : m; });
      return [];
    }
    if (what === 'access') {
      need(c, 2, 'vlan', 1); const id = num(c, 3, 1, 4094); end(c, 4);
      const out = [];
      if (!d.vlans[id]) { d.vlans[id] = `VLAN${String(id).padStart(4, '0')}`; out.push('% Access VLAN does not exist. Creating vlan ' + id); }
      each((f) => { f.access = id; });
      return out;
    }
    if (what === 'trunk') {
      const t = choose(c, 2, [['allowed', 2], ['native', 2], ['encapsulation', 1]]);
      if (t === 'encapsulation') { need(c, 3, 'dot1q', 1); return []; }
      need(c, 3, 'vlan', 1);
      if (t === 'native') { const id = num(c, 4, 1, 4094); end(c, 5); each((f) => { f.native = id; }); return []; }
      const op = (c.toks[4] || '').toLowerCase();
      if (['add', 'remove', 'all', 'except', 'none'].includes(op)) {
        if (op === 'all') { each((f) => { f.allowed = null; }); return []; }
        if (op === 'none') { each((f) => { f.allowed = []; }); return []; }
        const list = parseVlanList(arg(c, 5));
        if (!list) throw new IosError('invalid', 5);
        each((f) => {
          const cur = f.allowed || Array.from({ length: 4094 }, (_, k) => k + 1);
          f.allowed = op === 'add' ? [...new Set([...cur, ...list])].sort((x, y) => x - y) : cur.filter((v) => !list.includes(v));
        });
        return [];
      }
      const list = parseVlanList(arg(c, 4));
      if (!list) throw new IosError('invalid', 4);
      each((f) => { f.allowed = list; });
      return [];
    }
    return [];
  }],
};
// "no ..." inside interface mode.
const IF_NO = {
  shutdown: [2, (d) => setShut(d, false)],
  ip: [2, (d, c) => { need(c, 2, 'address', 2); d.ctx.forEach((n) => { Object.assign(d.ifaces[n], { ip: null, mask: null }); }); return []; }],
  description: [3, (d) => { d.ctx.forEach((n) => { d.ifaces[n].desc = null; }); return []; }],
  switchport: [2, (d, c) => {
    if (d.model.kind !== 'l3switch' || d.ctx.some((n) => n.startsWith('Vlan'))) throw new IosError('invalid', 1);
    end(c, 2);
    d.ctx.forEach((n) => { Object.assign(d.ifaces[n], { l2: false, mode: null }); });
    return [];
  }],
  'spanning-tree': [2, (d) => { d.ctx.forEach((n) => { d.ifaces[n].portfast = false; }); return []; }],
};
function setShut(d, shut) {
  const out = [];
  for (const n of d.ctx) {
    const f = d.ifaces[n];
    if (f.shut === shut) continue;
    f.shut = shut;
    if (n.includes('.')) continue;
    if (shut) out.push(`%LINK-5-CHANGED: Interface ${n}, changed state to administratively down`);
    else {
      const [st, pr] = ifStatus(d, n);
      out.push(`%LINK-5-CHANGED: Interface ${n}, changed state to ${st === 'up' ? 'up' : 'down'}`);
      if (pr === 'up') out.push(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${n}, changed state to up`);
    }
  }
  return out;
}

const LINE_CMDS = {
  'exec-timeout': [6, (d, c) => { const m = num(c, 1, 0, 35791); const s = c.toks[2] !== undefined ? num(c, 2, 0, 2147483) : 0; end(c, 3); eachLine(d, (l) => { l.timeout = `${m} ${s}`; }); return []; }],
  logging: [4, (d, c) => { need(c, 1, 'synchronous', 1); end(c, 2); eachLine(d, (l) => { l.sync = true; }); return []; }],
  login: [4, (d, c) => {
    const local = c.toks[1] !== undefined ? (need(c, 1, 'local', 1), true) : false;
    end(c, local ? 2 : 1);
    eachLine(d, (l) => { l.login = true; l.local = local; });
    return local || lineOf(d).password ? [] : ['% Login disabled on line, until \'password\' is set'];
  }],
  password: [3, (d, c) => { let v = arg(c, 1); if (v === '0' && c.toks[2] !== undefined) v = c.toks[2]; eachLine(d, (l) => { l.password = v; }); return []; }],
  transport: [2, (d, c) => {
    need(c, 1, 'input', 1);
    const ways = c.toks.slice(2).map((_, k) => choose(c, 2 + k, [['ssh', 1], ['telnet', 1], ['all', 1], ['none', 1]]));
    if (!ways.length) throw new IosError('incomplete');
    eachLine(d, (l) => { l.transport = ways.join(' '); });
    return [];
  }],
};
const LINE_NO = {
  login: [4, (d) => { eachLine(d, (l) => { l.login = false; l.local = false; }); return []; }],
  password: [3, (d) => { eachLine(d, (l) => { l.password = null; }); return []; }],
};
const lineOf = (d) => (d.ctx[0] === 'con' ? d.con : d.vty[+d.ctx[0].slice(3)]);
const eachLine = (d, fn) => d.ctx.forEach((n) => fn(n === 'con' ? d.con : d.vty[+n.slice(3)]));

const VLAN_CMDS = {
  name: [2, (d, c) => { const v = arg(c, 1); end(c, 2); d.vlans[d.ctx[0]] = v; return []; }],
};

const SUB_EXIT = {
  exit: [2, (d, c) => { end(c, 1); d.mode = 'config'; d.ctx = []; return []; }],
  end: [3, (d, c) => { end(c, 1); return toPriv(d); }],
};

// Finds the command for the first word: exact name, else the unique long-enough prefix.
function lookup(table, tok) {
  const t = tok.toLowerCase();
  if (table[t]) return { name: t };
  const hits = Object.keys(table).filter((w) => w.startsWith(t));
  const ok = hits.filter((w) => t.length >= table[w][0]);
  if (ok.length === 1) return { name: ok[0] };
  if (hits.length) return { ambiguous: true };
  return null;
}
function dispatch(d, c, table) {
  const hit = lookup(table, c.toks[0]);
  if (!hit) throw new IosError('invalid', 0);
  if (hit.ambiguous) throw new IosError('ambiguous', 0);
  return table[hit.name][1](d, c);
}

function modeTables(d) {
  switch (d.mode) {
    case 'user': return { cmds: EXEC_CMDS.user };
    case 'priv': return { cmds: EXEC_CMDS.priv };
    case 'config': return { cmds: GLOBAL_CMDS };
    case 'if': case 'subif': case 'range': return { cmds: { ...IF_CMDS, ...SUB_EXIT }, no: IF_NO };
    case 'line': return { cmds: { ...LINE_CMDS, ...SUB_EXIT }, no: LINE_NO };
    case 'vlan': return { cmds: { ...VLAN_CMDS, ...SUB_EXIT }, no: {} };
    default: return { cmds: {} };
  }
}

// Answers to a question the device asked (Password:, [confirm], banner text…).
function pendingInput(d, line) {
  const p = d.pending;
  d.pending = null;
  const yes = line.trim() === '' || /^y/i.test(line.trim());
  switch (p.type) {
    case 'return':
      if (d.con.login && (d.con.password || d.con.local)) { d.pending = { type: 'login', prompt: 'Password: ', secret: true, tries: 0 }; return ['', 'User Access Verification', '']; }
      return [];
    case 'login':
    case 'enable': {
      const want = p.type === 'enable' ? [d.enableSecret || d.enablePassword]
        : d.con.local ? Object.values(d.users).map((u) => u.secret || u.password) : [d.con.password];
      if (want.includes(line)) { if (p.type === 'enable') d.mode = 'priv'; return []; }
      if (++p.tries >= 3) { if (p.type === 'login') { d.pending = { type: 'return', prompt: '' }; return ['% Password:  timeout expired!', '', 'Press RETURN to get started.']; } return ['% Bad secrets', '']; }
      d.pending = p;
      return [];
    }
    case 'configure':
      if (line.trim() && !ab(line.trim(), 'terminal', 1)) return ['?Must be "terminal", "memory" or "network"'];
      d.mode = 'config';
      return ['Enter configuration commands, one per line.  End with CNTL/Z.'];
    case 'copy':
      if (line.trim() && line.trim() !== 'startup-config') return ['%Error opening tftp:' + line.trim() + ' (Timed out)'];
      return save(d);
    case 'erase':
      if (!yes) return [];
      d.startup = null;
      return ['[OK]', 'Erase of nvram: complete'];
    case 'reload-save':
      if (/^y/i.test(line.trim())) save(d);
      else if (!/^n/i.test(line.trim())) { d.pending = p; return ['% Please answer \'yes\' or \'no\'.']; }
      d.pending = { type: 'reload', prompt: 'Proceed with reload? [confirm]' };
      return [];
    case 'reload':
      if (!yes) return [];
      restoreConfig(d, d.startup);
      d.mode = 'user'; d.ctx = [];
      d.pending = { type: 'return', prompt: '' };
      return ['', 'System Bootstrap, Version 15.1 (simulated)', 'Loading the startup configuration...', '', 'Press RETURN to get started.'];
    case 'modulus': {
      const bits = line.trim() === '' ? 512 : +line.trim();
      if (!(bits >= 360 && bits <= 4096)) return ['% A decimal number between 360 and 4096.'];
      return genKeys(d, bits);
    }
    case 'banner': {
      const close = line.indexOf(p.delim);
      if (close < 0) { d.pending = { ...p, text: p.text + '\n' + line }; return []; }
      d.banner = (p.text + '\n' + line.slice(0, close)).replace(/^\n/, '');
      return [];
    }
    default:
      return [];
  }
}

// Runs one line typed at the prompt and returns the device's output lines.
function iosRun(d, input) {
  const raw = String(input ?? '');
  const prompt = iosPrompt(d);
  if (d.pending) return pendingInput(d, raw);
  const line = raw.trim();
  if (!line) return [];
  const c = { toks: [], pos: [], raw: line };
  line.replace(/\S+/g, (m, at) => { c.toks.push(m); c.pos.push(at); return m; });
  if (line.endsWith('?')) return iosHelp(d, line.slice(0, -1));
  const t = modeTables(d);
  const fail = (err) => {
    if (err.kind === 'incomplete') return ['% Incomplete command.'];
    if (err.kind === 'ambiguous') return [`% Ambiguous command:  "${line}"`];
    const exec = d.mode === 'user' || d.mode === 'priv';
    if (exec && err.at === 0 && c.toks.length === 1) {
      return [...(d.domainLookup ? [`Translating "${c.toks[0]}"...domain server (255.255.255.255)`] : []), '% Unknown command or computer name, or unable to find computer address'];
    }
    return [' '.repeat(prompt.length + (c.pos[err.at ?? 0] || 0)) + '^', "% Invalid input detected at '^' marker."];
  };
  try {
    if (t.no && ab(c.toks[0], 'no', 2) && c.toks.length > 1) {
      const sub = { toks: c.toks.slice(1), pos: c.pos.slice(1), raw: line };
      const hit = lookup(t.no, sub.toks[0]);
      if (hit && !hit.ambiguous) return t.no[hit.name][1](d, { ...sub, toks: c.toks, pos: c.pos });
    }
    const hit = lookup(t.cmds, c.toks[0]);
    if (hit && hit.ambiguous) return fail(new IosError('ambiguous', 0));
    if (hit) return t.cmds[hit.name][1](d, c);
    // Global commands also work from a sub-mode on IOS; they leave the sub-mode ("do" keeps it).
    const global = ['if', 'subif', 'range', 'line', 'vlan'].includes(d.mode) && lookup(GLOBAL_CMDS, c.toks[0]);
    if (global && global.name === 'do') return GLOBAL_CMDS.do[1](d, c);
    if (global) {
      const mode = d.mode, ctx = d.ctx;
      d.mode = 'config'; d.ctx = [];
      try { return dispatch(d, c, GLOBAL_CMDS); } catch (err) { d.mode = mode; d.ctx = ctx; throw err; }
    }
    return fail(new IosError('invalid', 0));
  } catch (err) {
    if (err instanceof IosError) return fail(err);
    throw err;
  }
}

const HELP = {
  user: [['enable', 'Turn on privileged commands'], ['exit', 'Exit from the EXEC'], ['ping', 'Send echo messages'], ['show', 'Show running system information']],
  priv: [['configure', 'Enter configuration mode'], ['copy', 'Copy from one file to another'], ['disable', 'Turn off privileged commands'], ['erase', 'Erase a filesystem'],
    ['exit', 'Exit from the EXEC'], ['ping', 'Send echo messages'], ['reload', 'Halt and perform a cold restart'], ['show', 'Show running system information'], ['write', 'Write running configuration to memory']],
  config: [['banner', 'Define a login banner'], ['crypto', 'Encryption module'], ['do', 'To run exec commands in config mode'], ['enable', 'Modify enable password parameters'],
    ['end', 'Exit from configure mode'], ['exit', 'Exit from configure mode'], ['hostname', 'Set system\'s network name'], ['interface', 'Select an interface to configure'],
    ['ip', 'Global IP configuration subcommands'], ['line', 'Configure a terminal line'], ['no', 'Negate a command or set its defaults'], ['service', 'Modify use of network based services'],
    ['username', 'Establish User Name Authentication'], ['vlan', 'VLAN commands (switches)']],
  if: [['description', 'Interface specific description'], ['encapsulation', 'Set encapsulation type (subinterfaces)'], ['exit', 'Exit from interface configuration mode'],
    ['ip', 'Interface Internet Protocol config commands'], ['no', 'Negate a command or set its defaults'], ['shutdown', 'Shutdown the selected interface'],
    ['spanning-tree', 'Spanning Tree Subsystem'], ['switchport', 'Set switching mode characteristics']],
  line: [['exec-timeout', 'Set the EXEC timeout'], ['exit', 'Exit from line configuration mode'], ['logging', 'Modify message logging facilities'], ['login', 'Enable password checking'],
    ['no', 'Negate a command or set its defaults'], ['password', 'Set a password'], ['transport', 'Define transport protocols for line']],
  vlan: [['exit', 'Apply changes, bump revision number, and exit mode'], ['name', 'Ascii name of the VLAN']],
};
function iosHelp(d, partial) {
  const list = HELP[{ subif: 'if', range: 'if' }[d.mode] || d.mode] || [];
  const p = partial.trim().toLowerCase();
  if (p.includes(' ')) return ['(Help lists the first word of each command here. Type the command, or tap Hint.)'];
  const rows = list.filter(([w]) => w.startsWith(p));
  return rows.length ? cols(rows.map(([w, t]) => ['  ' + w, t])) : ['% Unrecognized command'];
}

/* ---- checking a configuration against a task ---- */

const normText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const MODE_NAMES = { user: 'user', priv: 'priv', config: 'config', if: 'if', subif: 'subif', range: 'if', line: 'line', vlan: 'vlan' };

// One condition from a pack task, e.g. {"hostname":"R1"} or {"iface":"FastEthernet0/0","ip":"172.16.0.1","up":true}.
function iosCheck(d, c) {
  const has = (k) => Object.prototype.hasOwnProperty.call(c, k);
  if (has('mode') && !has('iface')) return MODE_NAMES[d.mode] === c.mode && !d.pending;
  if (has('inLine')) return d.mode === 'line' && !d.pending && (c.inLine === 'con' ? d.ctx[0] === 'con' : String(d.ctx[0]).startsWith('vty'));
  if (has('inIface')) return (d.mode === 'if' || d.mode === 'subif') && d.ctx[0] === c.inIface;
  if (has('inVlan')) return d.mode === 'vlan' && d.ctx[0] === c.inVlan;
  if (has('show')) return !!(d.shows && d.shows.has(c.show));
  if (has('hostname')) return d.hostname === c.hostname;
  if (has('enableSecret')) return d.enableSecret === c.enableSecret;
  if (has('enablePassword')) return d.enablePassword === c.enablePassword;
  if (has('banner')) return normText(d.banner) === normText(c.banner);
  if (has('encrypt')) return d.encrypt === c.encrypt;
  if (has('domainLookup')) return d.domainLookup === c.domainLookup;
  if (has('domainName')) return d.domainName === c.domainName;
  if (has('ipRouting')) return d.ipRouting === c.ipRouting;
  if (has('gateway')) return d.gateway === c.gateway;
  if (has('ssh')) return d.ssh === c.ssh;
  if (has('rsa')) return c.rsa === true ? d.rsa > 0 : d.rsa >= c.rsa;
  if (has('saved')) return isSaved(d) === c.saved;
  if (has('user')) {
    const u = d.users[c.user];
    return !!u && ['privilege', 'secret', 'password'].every((k) => !has(k) || u[k] === c[k]);
  }
  if (has('line')) {
    const lines = c.line === 'con' ? [d.con] : d.vty.slice(c.from ?? 0, (c.to ?? 4) + 1);
    return lines.every((l) => ['password', 'login', 'local', 'sync', 'timeout'].every((k) => !has(k) || l[k] === c[k])
      && (!has('transport') || normText(l.transport) === normText(c.transport)));
  }
  if (has('iface')) {
    const f = d.ifaces[c.iface];
    if (!f) return false;
    return (!has('ip') || f.ip === c.ip) && (!has('mask') || f.mask === c.mask) && (!has('up') || !f.shut === c.up)
      && (!has('desc') || normText(f.desc) === normText(c.desc)) && (!has('port') || f.mode === c.port)
      && (!has('access') || f.access === c.access) && (!has('native') || f.native === c.native)
      && (!has('allowed') || vlanListText(f.allowed) === vlanListText(parseVlanList(c.allowed)))
      && (!has('portfast') || f.portfast === c.portfast) && (!has('encap') || f.encap === c.encap)
      && (!has('routed') || !f.l2 === c.routed) && (!has('clock') || f.clock === c.clock);
  }
  if (has('vlan')) {
    const v = d.vlans[c.vlan];
    if (has('exists')) return !!v === c.exists;
    return !!v && (!has('name') || normText(v) === normText(c.name));
  }
  return false;
}
const taskDone = (d, task) => (task.check || []).every((c) => iosCheck(d, c));
// Navigation steps ("enter global configuration mode", "run show vlan brief") are guided-only;
// Lab mode lists just the tasks about the finished configuration.
const NAV_KEYS = ['mode', 'inLine', 'inIface', 'inVlan', 'show'];
const isNavTask = (t) => (t.check || []).every((c) => Object.keys(c).every((k) => NAV_KEYS.includes(k)));
const labTasks = (sc) => sc.tasks.filter((t) => !isNavTask(t));

/* ================= drill screens ================= */

const DRILL_ENGINES = {
  cli: { title: 'Cisco IOS CLI', valid: (x) => x.config && Array.isArray(x.config.scenarios) && x.config.scenarios.length > 0 },
  subnetting: { title: 'Subnetting', valid: () => true },
  vlsm: { title: 'VLSM', valid: () => true },
};

let drill = null; // the open drill session

function drillProgress(p) {
  const pr = prog(p.id);
  if (!pr.drills) pr.drills = {};
  return pr.drills;
}

function drillShell(p, x, eyebrow, title, back, body) {
  return `<div style="--c:${courseColor(p)}" data-style="${courseStyle(p)}">
    <header class="appbar with-back"><a class="icon-btn" href="${back}" aria-label="Back">${ICON.back}</a>
      <div class="appbar-title"><span class="eyebrow">${esc(courseShort(p))} · ${esc(eyebrow)}</span><span class="t">${esc(title)}</span></div></header>
    <div class="page drill">${body}</div></div>`;
}

function viewDrill(p, x, mode, sub) {
  const home = `#/d/${enc(p.id)}/${enc(x.id)}`;
  const course = `#/c/${enc(p.id)}`;
  const done = drillProgress(p);
  if (x.drill === 'cli') {
    const sc = mode && x.config.scenarios.find((s) => s.id === sub);
    if (sc && (mode === 'guided' || mode === 'lab')) {
      return drillShell(p, x, mode === 'guided' ? 'Guided' : 'Lab', plain(sc.title), home, cliSessionHtml(sc, mode));
    }
    const m = prefs.get('cli-mode', 'guided');
    let h = `${x.description ? `<p class="drill-intro">${inline(x.description)}</p>` : ''}
      <div class="seg" role="radiogroup" aria-label="Mode">
        ${[['guided', 'Guided'], ['lab', 'Lab']].map(([v, l]) => `<button role="radio" aria-checked="${m === v}" class="${m === v ? 'on' : ''}" data-act="cli-mode" data-v="${v}">${l}</button>`).join('')}</div>
      <p class="seg-note">${m === 'guided' ? 'One task at a time. Type each command; it is checked as soon as you press Enter.' : 'The whole job at once. Type freely, then tap Check my work.'}</p>
      <div class="lesson-list">`;
    x.config.scenarios.forEach((s, i) => {
      const key = `${x.id}/${m}/${s.id}`;
      const model = (IOS_MODELS[s.device && s.device.model] || IOS_MODELS[1841]).label;
      h += `<a class="card lesson-row" href="${home}/${m}/${enc(s.id)}">
        <span class="num${done[key] ? ' done' : ''}">${done[key] ? ICON.check : i + 1}</span>
        <span class="lr-body"><span class="lr-title">${inline(s.title)}</span>${s.summary ? `<span class="lr-sum">${inline(s.summary)}</span>` : ''}
        <span class="lr-meta">${esc(model)} · ${(m === 'guided' ? s.tasks : labTasks(s)).length} tasks</span></span>${ICON.chev}</a>`;
    });
    return drillShell(p, x, 'Drill', x.title, course, h + '</div>');
  }
  if (mode === 'table') return drillShell(p, x, 'Table problem', x.title, home, '<div id="drill-body"></div>');
  if (mode === 'quick') return drillShell(p, x, 'Quick questions', x.title, home, '<div id="drill-body"></div>');
  const solved = done[`${x.id}/table`] || 0;
  const best = done[`${x.id}/quick`];
  return drillShell(p, x, 'Drill', x.title, course, `${x.description ? `<p class="drill-intro">${inline(x.description)}</p>` : ''}
    <div class="lesson-list">
      <a class="card lesson-row extra-card" href="${home}/table"><span class="xi">${ICON.sheet}</span><span class="lr-body"><span class="lr-title">Table problem</span>
        <span class="lr-sum">${x.drill === 'vlsm' ? 'A random network and segment list. Fill the VLSM table row by row' : 'A random network to subnet. Fill the SN#, SM, NA, HA, BA table'}; every cell is checked, then the full solution is shown step by step.</span>
        <span class="lr-meta">${solved ? `${solved} solved` : 'Not tried yet'}</span></span>${ICON.chev}</a>
      <a class="card lesson-row extra-card" href="${home}/quick"><span class="xi">${ICON.bolt}</span><span class="lr-body"><span class="lr-title">Quick questions</span>
        <span class="lr-sum">10 short questions in a row, each explained after you answer.</span>
        <span class="lr-meta">${best !== undefined ? `Best score ${best}/10` : 'Not tried yet'}</span></span>${ICON.chev}</a>
    </div>`);
}

function startDrill(p, x, mode, sub) {
  drill = { p, x, mode };
  if (x.drill === 'cli' && (mode === 'guided' || mode === 'lab')) startCli(x.config.scenarios.find((s) => s.id === sub), mode);
  else if (mode === 'table') { drill.size = prefs.get('vlsm-size', 'short'); newTableProblem(); }
  else if (mode === 'quick') newQuickRound();
  cleanupView = () => { drill = null; };
}

/* ---- CLI ---- */

function cliSessionHtml(sc, mode) {
  const top = mode === 'guided'
    ? `<div class="card task-card" id="task-card"></div>`
    : `<div class="card task-card"><p class="task-text">${inline(sc.intro || 'Configure the device so every item below is true.')}</p><ol class="lab-list" id="lab-list"></ol>
        <div class="drill-btns"><button class="btn primary" data-act="cli-check">Check my work</button><button class="btn ghost" data-act="cli-reset">Start over</button></div>
        <div id="lab-result"></div></div>`;
  return `${mode === 'guided' && sc.intro ? `<p class="drill-intro">${inline(sc.intro)}</p>` : ''}${top}
    <div class="ios-term" id="term"><div class="term-bar"><span class="dots"></span>${esc((IOS_MODELS[sc.device && sc.device.model] || IOS_MODELS[1841]).label)}</div>
      <div class="term-out" id="term-out" aria-live="polite"></div>
      <form class="term-in" id="term-form" autocomplete="off"><span class="term-prompt" id="term-prompt"></span>
        <input id="term-input" type="text" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="send" aria-label="Command">
      </form>
      <div class="term-keys"><button type="button" data-act="cli-key" data-k="?">?</button><button type="button" data-act="cli-key" data-k="enter">Enter</button></div></div>
    <p class="fine">Abbreviations work as on a real device: <code>conf t</code>, <code>int fa0/0</code>, <code>no shut</code>, <code>copy run start</code>. Type <code>?</code> to list commands.</p>`;
}

function startCli(sc, mode) {
  const d = iosDevice(sc.device || {});
  for (const cmd of sc.setup || []) iosRun(d, cmd);
  Object.assign(drill, { sc, d, task: 0, history: [], hist: -1 });
  const out = $('#term-out');
  out.innerHTML = `<div class="tl dim">${esc(sc.device && sc.device.note ? sc.device.note : 'Console connected. Type a command and press Enter.')}</div>`;
  if (mode === 'guided') renderTask(); else renderLabList();
  updatePrompt();
  const form = $('#term-form');
  const input = $('#term-input');
  form.addEventListener('submit', (e) => { e.preventDefault(); submitCommand(input.value); input.value = ''; });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const h = drill.history;
    if (!h.length) return;
    e.preventDefault();
    drill.hist = e.key === 'ArrowUp' ? Math.max(0, (drill.hist < 0 ? h.length : drill.hist) - 1) : Math.min(h.length, drill.hist + 1);
    input.value = h[drill.hist] || '';
  });
  $('#term').addEventListener('click', (e) => { if (!e.target.closest('button')) input.focus({ preventScroll: true }); });
}

function updatePrompt() {
  const d = drill.d;
  $('#term-prompt').textContent = iosPrompt(d);
  const input = $('#term-input');
  input.type = d.pending && d.pending.secret ? 'password' : 'text';
}

function termLines(lines, cls) {
  const out = $('#term-out');
  out.insertAdjacentHTML('beforeend', lines.map((l) => `<div class="tl${cls ? ' ' + cls : ''}">${esc(l) || '&nbsp;'}</div>`).join(''));
  out.scrollTop = out.scrollHeight;
}

function submitCommand(text) {
  const d = drill.d;
  const secret = d.pending && d.pending.secret;
  const prompt = iosPrompt(d);
  if (text.trim() && !secret) { drill.history.push(text); drill.hist = -1; }
  termLines([prompt + (secret ? '' : text)], 'echo');
  const out = iosRun(d, text);
  if (out.length) termLines(out, out.some((l) => /^% (Invalid|Incomplete|Ambiguous|Unknown|Bad)/.test(l.trim())) ? 'err' : '');
  updatePrompt();
  if (drill.mode === 'guided') afterGuided(text, out);
  $('#term-input').scrollIntoView({ block: 'nearest' });
}

function renderTask(feedback) {
  const { sc, task } = drill;
  const card = $('#task-card');
  if (task >= sc.tasks.length) {
    card.innerHTML = `<div class="done-mark">${ICON.check}</div><h2 class="task-done-title">Scenario complete</h2>
      <p class="task-text">All ${sc.tasks.length} tasks done. Try the same job in Lab mode, where nothing is told to you step by step.</p>
      <div class="drill-btns">${nextScenarioLink('guided')}<a class="btn" href="#/d/${enc(drill.p.id)}/${enc(drill.x.id)}/lab/${enc(sc.id)}">Lab mode</a></div>`;
    card.classList.add('complete');
    markDrill(`${drill.x.id}/guided/${sc.id}`);
    return;
  }
  const t = sc.tasks[task];
  card.innerHTML = `${feedback && feedback.done ? `<div class="task-fb ok prev">${inline(feedback.text)}</div>` : ''}
    <div class="task-top"><span class="pill">Task ${task + 1} of ${sc.tasks.length}</span><span class="bar"><i style="width:${(task / sc.tasks.length) * 100}%"></i></span></div>
    <p class="task-text">${inline(t.text)}</p>
    ${feedback && !feedback.done ? `<div class="task-fb ${feedback.ok ? 'ok' : 'no'}">${inline(feedback.text)}</div>` : ''}
    <div class="task-help" id="task-help" hidden></div>
    <div class="drill-btns"><button class="btn ghost" data-act="cli-hint">Hint</button><button class="btn ghost" data-act="cli-answer">Show answer</button></div>`;
}

function nextScenarioLink(mode) {
  const list = drill.x.config.scenarios;
  const i = list.indexOf(drill.sc);
  const next = list[i + 1];
  return next ? `<a class="btn primary" href="#/d/${enc(drill.p.id)}/${enc(drill.x.id)}/${mode}/${enc(next.id)}">Next scenario</a>`
    : `<a class="btn primary" href="#/d/${enc(drill.p.id)}/${enc(drill.x.id)}">All scenarios</a>`;
}

function afterGuided(text, out) {
  const { sc, d } = drill;
  const t = sc.tasks[drill.task];
  if (!t) return;
  if (taskDone(d, t)) {
    drill.task++;
    const skipped = [];
    while (drill.task < sc.tasks.length && !isNavTask(sc.tasks[drill.task]) && taskDone(d, sc.tasks[drill.task])) {
      skipped.push(drill.task + 1); drill.task++;
    }
    renderTask({ ok: true, done: true, text: `**Task ${drill.task - skipped.length} done.**${t.why ? ' ' + t.why : ''}${skipped.length ? ` (Task ${skipped.join(', ')} was already done too.)` : ''}` });
  } else if (text.trim() && !d.pending) {
    const err = out.some((l) => /^%/.test(l.trim()));
    const multi = String(t.answer || '').includes('\n');
    renderTask(err ? { ok: false, text: 'The device rejected that. Read the message above, then try again, or tap **Hint**.' }
      : multi ? { ok: true, text: 'Accepted. This task takes more than one command, so keep going.' }
        : { ok: false, text: 'That command ran, but it is not what this task asks for. Tap **Hint** if you are stuck.' });
  }
}

function renderLabList(results) {
  const tasks = labTasks(drill.sc);
  $('#lab-list').innerHTML = tasks.map((t, i) => {
    const r = results && results[i];
    return `<li class="${r === undefined ? '' : r ? 'ok' : 'no'}"><span class="li-mark">${r === undefined ? '' : r ? ICON.check : ICON.close}</span>
      <span class="li-body">${inline(t.text)}${r === false ? `<details class="li-how"><summary>Show how</summary><pre>${esc(t.answer || '')}</pre></details>` : ''}</span></li>`;
  }).join('');
}

function markDrill(key, value) {
  const done = drillProgress(drill.p);
  done[key] = value === undefined ? Date.now() : value;
  saveSoon('progress');
}

/* ---- table problems (subnetting and VLSM) ---- */

const FIELD_TYPES = {
  ip: { mode: 'decimal', check: sameIp },
  num: { mode: 'numeric', check: sameNum },
};
const field = (label, type, answer, wide) => `<label class="fld${wide ? ' wide' : ''}"><span>${label}</span>
  <input inputmode="${FIELD_TYPES[type].mode}" autocomplete="off" autocapitalize="none" spellcheck="false" data-type="${type}" data-ans="${esc(answer)}"></label>`;

function newTableProblem() {
  const body = $('#drill-body');
  const x = drill.x;
  let h = '';
  if (x.drill === 'vlsm') {
    const pr = makeVlsmProblem(drill.size);
    drill.problem = pr;
    h += `<div class="seg" role="radiogroup" aria-label="Problem size">${[['short', 'Short'], ['full', 'Full']].map(([v, l]) =>
      `<button role="radio" aria-checked="${drill.size === v}" class="${drill.size === v ? 'on' : ''}" data-act="vlsm-size" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="card q-card"><p>Create a VLSM plan for <b>${intToIp(pr.base.net)}/${pr.base.len}</b>.</p>
      <table class="need-table"><tr>${pr.segs.map((s) => `<th>${s.name}</th>`).join('')}</tr><tr>${pr.segs.map((s) => `<td>${s.need}</td>`).join('')}</tr></table>
      <p class="fine-left">Hosts needed per segment. The rows below are already in VLSM order (largest first).</p></div>`;
    for (const s of pr.order) {
      h += `<div class="card sn-card"><div class="sn-head">${s.name} <span>${s.need} hosts needed</span></div><div class="fld-grid">
        ${field('Possible hosts', 'num', s.possible)}${field('Prefix /', 'num', s.len)}${field('Subnet mask', 'ip', s.mask, true)}
        ${field('Network address', 'ip', s.na, true)}${field('First host', 'ip', s.first, true)}${field('Last host', 'ip', s.last, true)}${field('Broadcast', 'ip', s.ba, true)}</div></div>`;
    }
  } else {
    const pr = makeSubnetProblem();
    drill.problem = pr;
    h += `<div class="card q-card"><p>${inline(subnetQuestion(pr))}</p></div>
      <div class="card sn-card"><div class="sn-head">Plan</div><div class="fld-grid">
        ${pr.byHosts ? field('Host bits H', 'num', 32 - pr.len) : field('Borrowed bits N', 'num', pr.bits)}${field('New prefix /', 'num', pr.len)}
        ${field('Subnet mask (SM)', 'ip', pr.mask, true)}${field(`Interval (${pr.octName} octet)`, 'num', pr.size)}${field('Number of subnets', 'num', pr.count)}</div></div>`;
    for (const r of pr.rows) {
      h += `<div class="card sn-card"><div class="sn-head">SN ${r.sn}</div><div class="fld-grid">
        ${field('Network address (NA)', 'ip', r.na, true)}${field('First host (HA)', 'ip', r.first, true)}${field('Last host (HA)', 'ip', r.last, true)}${field('Broadcast (BA)', 'ip', r.ba, true)}</div></div>`;
    }
  }
  h += `<div class="drill-btns sticky-btns"><button class="btn primary" data-act="table-check">Check</button><button class="btn" data-act="table-solution">Solution</button>
    <button class="btn ghost" data-act="table-new">New problem</button></div><div id="table-result"></div><div id="table-solution"></div>`;
  body.innerHTML = h;
  window.scrollTo(0, 0);
}

function checkTable() {
  let right = 0, total = 0;
  for (const inp of $$('#drill-body input[data-ans]')) {
    total++;
    const ok = FIELD_TYPES[inp.dataset.type].check(inp.value, inp.dataset.ans);
    if (ok) right++;
    inp.closest('.fld').classList.toggle('ok', ok);
    inp.closest('.fld').classList.toggle('no', !ok);
  }
  const res = $('#table-result');
  res.innerHTML = `<div class="task-fb ${right === total ? 'ok' : 'no'}">${inline(right === total ? `All ${total} cells correct.` : `${right} of ${total} cells correct. Fix the red ones, or tap **Solution**.`)}</div>`;
  if (right === total && !drill.solvedThis) {
    drill.solvedThis = true;
    markDrill(`${drill.x.id}/table`, (drillProgress(drill.p)[`${drill.x.id}/table`] || 0) + 1);
  }
}

function showTableSolution() {
  const pr = drill.problem;
  const steps = drill.x.drill === 'vlsm' ? vlsmSolution(pr) : subnetSolution(pr);
  $('#table-solution').innerHTML = renderExample({ title: 'Step by step', problem: drill.x.drill === 'vlsm' ? `VLSM for ${intToIp(pr.base.net)}/${pr.base.len}` : subnetQuestion(pr).replace(/\*\*/g, ''), steps }, false);
  for (const inp of $$('#drill-body input[data-ans]')) {
    const f = inp.closest('.fld');
    if (!f.classList.contains('ok')) { let hint = $('.fld-ans', f); if (!hint) { f.insertAdjacentHTML('beforeend', `<span class="fld-ans">${esc(inp.dataset.ans)}</span>`); } }
  }
  $('#table-solution').scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* ---- quick questions ---- */

function newQuickRound() {
  const kinds = QUICK_SETS[drill.x.drill] || QUICK_SETS.subnetting;
  const order = shuffle([...kinds, ...kinds]).slice(0, 10);
  drill.quick = { qs: order.map((k) => QUICK[k]()), i: 0, score: 0, answered: false };
  renderQuick();
}

function renderQuick() {
  const qz = drill.quick;
  const body = $('#drill-body');
  if (qz.i >= qz.qs.length) {
    const best = drillProgress(drill.p)[`${drill.x.id}/quick`];
    if (best === undefined || qz.score > best) markDrill(`${drill.x.id}/quick`, qz.score);
    body.innerHTML = `<div class="card task-card complete"><div class="done-mark">${ICON.check}</div><h2 class="task-done-title">Score ${qz.score}/10</h2>
      <p class="task-text">${qz.score === 10 ? 'Perfect round.' : qz.score >= 7 ? 'Good work. Another round to make it stick?' : 'Keep going: every round has new numbers.'}</p>
      <div class="drill-btns"><button class="btn primary" data-act="quick-new">New round</button></div></div>`;
    return;
  }
  const q = qz.qs[qz.i];
  body.innerHTML = `<div class="card task-card"><div class="task-top"><span class="pill">Question ${qz.i + 1} of 10</span><span class="bar"><i style="width:${qz.i * 10}%"></i></span><span class="pill">Score ${qz.score}</span></div>
    <p class="task-text">${inline(q.q)}</p>
    <form id="quick-form" class="quick-form" autocomplete="off"><input id="quick-input" inputmode="${/class/i.test(q.q) ? 'text' : 'decimal'}" autocapitalize="characters" spellcheck="false" aria-label="Your answer">
      <button class="btn primary" type="submit">Check</button></form>
    <div id="quick-fb"></div></div>`;
  qz.answered = false;
  $('#quick-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (qz.answered) { qz.i++; renderQuick(); return; }
    const v = $('#quick-input').value;
    if (!v.trim()) return;
    qz.answered = true;
    const ok = q.check(v);
    if (ok) qz.score++;
    $('#quick-fb').innerHTML = `<div class="task-fb ${ok ? 'ok' : 'no'}">${ok ? 'Correct.' : inline(`Not quite. The answer is **${q.answer}**.`)}</div>
      ${q.steps.map((s) => `<p class="q-step">${inline(s.do)} <span class="q-why">${inline(s.why)}</span></p>`).join('')}`;
    $('#quick-form button').textContent = qz.i === 9 ? 'See score' : 'Next question';
    $('#quick-input').readOnly = true;
  });
  setTimeout(() => $('#quick-input') && $('#quick-input').focus({ preventScroll: true }), 50);
}

/* ---- taps ---- */

const DRILL_ACTIONS = {
  'cli-mode': (el) => { prefs.set('cli-mode', el.dataset.v); render(); },
  'cli-key': (el) => {
    const input = $('#term-input');
    if (el.dataset.k === 'enter') { submitCommand(input.value); input.value = ''; }
    else { input.value += el.dataset.k; submitCommand(input.value); input.value = ''; }
    input.focus({ preventScroll: true });
  },
  'cli-hint': () => {
    const t = drill.sc.tasks[drill.task];
    const box = $('#task-help');
    box.hidden = false;
    box.innerHTML = inline(t.hint || `Think about which mode you are in (look at the prompt), then the command for: ${plain(t.text)}`);
  },
  'cli-answer': () => {
    const t = drill.sc.tasks[drill.task];
    const box = $('#task-help');
    box.hidden = false;
    box.innerHTML = `<pre class="ans-pre">${esc(t.answer || '')}</pre>${t.why ? `<p>${inline(t.why)}</p>` : ''}`;
  },
  'cli-check': () => {
    const tasks = labTasks(drill.sc);
    const results = tasks.map((t) => taskDone(drill.d, t));
    renderLabList(results);
    const n = results.filter(Boolean).length;
    $('#lab-result').innerHTML = `<div class="task-fb ${n === tasks.length ? 'ok' : 'no'}">${inline(n === tasks.length ? `All ${n} items are configured. Well done.` : `${n} of ${tasks.length} done. Open **Show how** on the ones still missing.`)}</div>
      ${n === tasks.length ? `<div class="drill-btns">${nextScenarioLink('lab')}</div>` : ''}`;
    if (n === tasks.length) markDrill(`${drill.x.id}/lab/${drill.sc.id}`);
  },
  'cli-reset': () => { render(); },
  'vlsm-size': (el) => { prefs.set('vlsm-size', el.dataset.v); drill.size = el.dataset.v; drill.solvedThis = false; newTableProblem(); },
  'table-check': checkTable,
  'table-solution': showTableSolution,
  'table-new': () => { drill.solvedThis = false; newTableProblem(); },
  'quick-new': newQuickRound,
};

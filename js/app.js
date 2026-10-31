/* Giftvault — DEMO ONLY. No real purchases, payments, or crypto. Data lives in your browser only. */
(function () {
  'use strict';

  var REFUND_WINDOW_MS = 5 * 60 * 1000; // 5 minutes, starts at simulated purchase
  var REFUND_FEE_RATE = 0.10;           // 10% fee, calculated in cents
  var STORE_KEY = 'giftvault-demo-v1';

  var CARDS = [
    { id: 'streamly-25', brand: 'Streamly', cat: 'Entertainment', face: 2500, price: 2200, g: ['#7c3aed', '#2563eb'], desc: 'Fictional streaming service credit for shows and films.' },
    { id: 'streamly-50', brand: 'Streamly', cat: 'Entertainment', face: 5000, price: 4250, g: ['#6d28d9', '#0ea5e9'], desc: 'Fictional streaming credit, larger value for longer binges.' },
    { id: 'gameco-20', brand: 'GameCo', cat: 'Gaming', face: 2000, price: 1700, g: ['#be185d', '#7c3aed'], desc: 'Fictional game store credit for downloads and add-ons.' },
    { id: 'gameco-50', brand: 'GameCo', cat: 'Gaming', face: 5000, price: 4100, g: ['#9d174d', '#4338ca'], desc: 'Fictional game store credit for new releases.' },
    { id: 'shopplus-25', brand: 'ShopPlus', cat: 'Shopping', face: 2500, price: 2250, g: ['#ea580c', '#db2777'], desc: 'Fictional online store credit for everyday shopping.' },
    { id: 'shopplus-100', brand: 'ShopPlus', cat: 'Shopping', face: 10000, price: 8700, g: ['#c2410c', '#9333ea'], desc: 'Fictional online store credit, best value tier.' },
    { id: 'fooddash-30', brand: 'FoodDash', cat: 'Food', face: 3000, price: 2600, g: ['#059669', '#0891b2'], desc: 'Fictional food delivery credit for meals and groceries.' },
    { id: 'tripnest-100', brand: 'TripNest', cat: 'Travel', face: 10000, price: 8900, g: ['#0284c7', '#4f46e5'], desc: 'Fictional travel booking credit for stays and flights.' }
  ];
  var CATS = ['Entertainment', 'Gaming', 'Shopping', 'Food', 'Travel'];

  var state = load();
  var filters = { q: '', cat: 'All', sort: 'featured' };
  var pending = null; // action to run after login

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return '$' + (c / 100).toFixed(2); }
  function byId(id) { return CARDS.filter(function (c) { return c.id === id; })[0]; }
  function pct(c) { return Math.round((1 - c.price / c.face) * 100); }
  function fmtTime(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
  function rand4() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = ''; for (var i = 0; i < 4; i++) o += a[Math.floor(Math.random() * a.length)]; return o; }
  function dateStr(t) { return new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.orders)) return s;
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return { user: null, balance: 0, orders: [] };
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- visual ---------- */
  function visual(c, tag) {
    return '<div class="visual" style="background:linear-gradient(135deg,' + c.g[0] + ',' + c.g[1] + ')">' +
      '<b>' + esc(c.brand) + '</b><small>' + esc(c.cat) + ' · DEMO CARD</small>' +
      (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '</div>';
  }

  /* ---------- nav ---------- */
  function renderNav() {
    var h = '';
    if (state.user) {
      h = '<span class="pill" title="Demo wallet balance">💳 ' + money(state.balance) + '</span>' +
        '<a class="btn btn-ghost btn-sm" href="#/dashboard">' + esc(state.user.name.split(' ')[0]) + '</a>' +
        '<button class="btn btn-ghost btn-sm" data-act="logout">Log out</button>';
    } else {
      h = '<button class="btn btn-ghost btn-sm" data-act="auth" data-mode="login">Log in</button>' +
        '<button class="btn btn-primary btn-sm" data-act="auth" data-mode="signup">Sign up</button>';
    }
    $('#navRight').innerHTML = h;
    var hash = location.hash || '#/';
    $$('#links a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === hash || (hash.indexOf('#/card') === 0 && a.getAttribute('href') === '#/market')); });
  }

  /* ---------- views ---------- */
  function cardTile(c) {
    return '<article class="card">' + visual(c, '-' + pct(c) + '%') +
      '<div class="card-body"><h3>' + esc(c.brand) + ' Gift Card</h3>' +
      '<div class="price"><b>' + money(c.price) + '</b><s>' + money(c.face) + '</s><span class="save">Save ' + money(c.face - c.price) + '</span></div>' +
      '<div class="card-actions"><a class="btn btn-ghost btn-sm" href="#/card/' + c.id + '">Details</a>' +
      '<button class="btn btn-primary btn-sm" data-act="buy" data-id="' + c.id + '">Buy (demo)</button></div></div></article>';
  }

  function filtered() {
    var q = filters.q.trim().toLowerCase();
    var list = CARDS.filter(function (c) {
      return (filters.cat === 'All' || c.cat === filters.cat) && (!q || (c.brand + ' ' + c.cat + ' ' + c.desc).toLowerCase().indexOf(q) > -1);
    });
    if (filters.sort === 'low') list.sort(function (a, b) { return a.price - b.price; });
    if (filters.sort === 'high') list.sort(function (a, b) { return b.price - a.price; });
    if (filters.sort === 'disc') list.sort(function (a, b) { return pct(b) - pct(a); });
    return list;
  }

  function renderGrid() {
    var list = filtered();
    $('#grid').innerHTML = list.length ? list.map(cardTile).join('') :
      '<div class="empty">No demo cards match your search. Clear the search or choose another category.</div>';
    $('#count').textContent = list.length + (list.length === 1 ? ' card' : ' cards');
    $$('.chip').forEach(function (b) { b.classList.toggle('on', b.dataset.cat === filters.cat); });
    $$('.cat').forEach(function (b) { b.classList.toggle('on', b.dataset.cat === filters.cat); });
  }

  function viewHome(scrollToMarket) {
    var counts = {}; CARDS.forEach(function (c) { counts[c.cat] = (counts[c.cat] || 0) + 1; });
    $('#app').innerHTML =
      '<div class="wrap"><div class="hero"><div>' +
      '<h1>Gift cards for every plan, shown at their best price.</h1>' +
      '<p class="lead">Explore a polished gift card marketplace interface. Browse fictional brands, try a simulated checkout, and test a refund flow. Nothing here costs real money.</p>' +
      '<div class="hero-cta"><a class="btn btn-primary" href="#/market">Browse cards</a><button class="btn btn-ghost" data-act="auth" data-mode="signup">Create demo account</button></div>' +
      '<div class="hero-stats"><div><b>' + CARDS.length + '</b><span>Demo cards</span></div><div><b>' + CATS.length + '</b><span>Categories</span></div><div><b>$100</b><span>Free demo credits at signup</span></div></div>' +
      '</div><div class="stack" aria-hidden="true">' +
      [CARDS[0], CARDS[2], CARDS[4]].map(function (c) { return '<div class="gc" style="background:linear-gradient(135deg,' + c.g[0] + ',' + c.g[1] + ')"><b>' + c.brand + '</b><small>DEMO CARD · ' + money(c.face) + '</small></div>'; }).join('') +
      '</div></div>' +
      '<section><div class="sec-head"><div><h2>Shop by category</h2><p>Pick a category to filter the marketplace.</p></div></div><div class="cats">' +
      CATS.map(function (k) { return '<button class="cat" data-act="cat" data-cat="' + k + '"><b>' + k + '</b><span>' + counts[k] + ' card' + (counts[k] > 1 ? 's' : '') + '</span></button>'; }).join('') +
      '</div></section>' +
      '<section id="market"><div class="sec-head"><div><h2>Marketplace</h2><p id="count"></p></div></div>' +
      '<div class="toolbar"><input id="q" type="search" placeholder="Search brands or categories" aria-label="Search gift cards" value="' + esc(filters.q) + '">' +
      '<select id="sort" aria-label="Sort cards"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="disc">Biggest discount</option></select></div>' +
      '<div class="chips">' + ['All'].concat(CATS).map(function (k) { return '<button class="chip" data-act="cat" data-cat="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
      '<div class="grid" id="grid"></div></section>' +
      '<section><div class="sec-head"><div><h2>How the demo works</h2></div></div><div class="steps">' +
      '<div class="step"><h3>1. Create a demo account</h3><p>Sign up with any name and email. You get $100 in demo credits. No password is stored.</p></div>' +
      '<div class="step"><h3>2. Buy a demo card</h3><p>Pay from your demo wallet in a simulated checkout. No real payment is taken.</p></div>' +
      '<div class="step"><h3>3. Test a refund</h3><p>After a purchase, a 5-minute refund timer starts. Refunds deduct a 10% fee.</p></div>' +
      '</div></section></div>';
    $('#sort').value = filters.sort;
    renderGrid();
    if (scrollToMarket) setTimeout(function () { var m = $('#market'); if (m) m.scrollIntoView({ behavior: 'smooth' }); }, 30);
  }

  function viewCard(id) {
    var c = byId(id);
    if (!c) { $('#app').innerHTML = '<div class="wrap"><section><h1>Card not found</h1><p class="crumb">This demo card does not exist.</p><p style="margin-top:16px"><a class="btn btn-primary" href="#/market">Back to marketplace</a></p></section></div>'; return; }
    $('#app').innerHTML = '<div class="wrap"><section><p class="crumb"><a href="#/market">Marketplace</a> / ' + esc(c.brand) + '</p><div class="detail">' + visual(c, '-' + pct(c) + '%') +
      '<div><h1>' + esc(c.brand) + ' Gift Card</h1><p class="crumb">' + esc(c.desc) + '</p>' +
      '<div class="price" style="margin-top:18px"><b style="font-size:34px">' + money(c.price) + '</b><s>' + money(c.face) + '</s><span class="save">Save ' + money(c.face - c.price) + ' (' + pct(c) + '%)</span></div>' +
      '<ul class="facts"><li><b>Category:</b> ' + esc(c.cat) + '</li><li><b>Face value:</b> ' + money(c.face) + '</li><li><b>Delivery:</b> Instant demo code after simulated checkout</li><li><b>Refunds:</b> 5-minute window from purchase, 10% processing fee</li><li><b>Note:</b> This is a fictional product. It has no real value.</li></ul>' +
      '<button class="btn btn-primary btn-block" data-act="buy" data-id="' + c.id + '">Buy with demo wallet</button></div></div></section></div>';
  }

  function viewDash() {
    if (!state.user) { $('#app').innerHTML = '<div class="wrap"><section><h1>Dashboard</h1><p class="crumb" style="margin:10px 0 18px">Log in or sign up to see your demo wallet and orders.</p><button class="btn btn-primary" data-act="auth" data-mode="login">Log in</button></section></div>'; return; }
    var active = state.orders.filter(function (o) { return o.status === 'active'; }).length;
    var saved = state.orders.filter(function (o) { return o.status !== 'refunded'; }).reduce(function (s, o) { return s + (o.face - o.paid); }, 0);
    var rows = state.orders.length ? state.orders.map(orderRow).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">No orders yet. Buy a demo card from the marketplace.</td></tr>';
    $('#app').innerHTML = '<div class="wrap"><section><div class="sec-head"><div><h1 style="font-size:32px">Hi, ' + esc(state.user.name) + '</h1><p>' + esc(state.user.email) + ' · Demo account</p></div></div>' +
      '<div class="stats"><div class="stat main"><span>Demo wallet balance</span><b>' + money(state.balance) + '</b><div class="row"><button class="btn btn-primary btn-sm" data-act="topup">Add $25 demo credits</button><button class="btn btn-ghost btn-sm" data-act="reset">Reset demo data</button></div></div>' +
      '<div class="stat"><span>Orders</span><b>' + state.orders.length + '</b></div><div class="stat"><span>Refundable now</span><b>' + active + '</b></div><div class="stat"><span>Total saved</span><b class="good">' + money(saved) + '</b></div></div>' +
      '<div class="panel"><h2>Your orders</h2><div class="tbl"><table><thead><tr><th>Order</th><th>Card</th><th>Paid</th><th>Code</th><th>Status</th><th>Refund window</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="panel"><h2>Refund policy (demo)</h2><p style="color:var(--muted);font-size:14px">Each order has a 5-minute refund window that starts at the moment of the simulated purchase. A refund returns the amount paid minus a 10% processing fee to your demo wallet.</p></div></section></div>';
    tick();
  }

  function orderRow(o) {
    var left = o.ts + REFUND_WINDOW_MS - Date.now();
    var badge = o.status === 'refunded' ? '<span class="badge rf">Refunded</span>' : '<span class="badge ok">Completed</span>';
    var win = o.status === 'refunded' ? '<span style="color:var(--muted)">Refunded ' + money(o.refund) + '</span>' : '<span class="timer" data-exp="' + (o.ts + REFUND_WINDOW_MS) + '">' + (left > 0 ? fmtTime(left) : 'Expired') + '</span>';
    var btn = o.status === 'refunded' ? '' : '<button class="btn btn-danger btn-sm" data-act="refund" data-oid="' + o.id + '"' + (left > 0 ? '' : ' disabled') + '>' + (left > 0 ? 'Request refund' : 'Window closed') + '</button>';
    return '<tr><td>#' + esc(o.id) + '<br><small style="color:var(--muted)">' + esc(dateStr(o.ts)) + '</small></td><td>' + esc(o.name) + '</td><td>' + money(o.paid) + '</td><td><code>' + esc(o.code) + '</code></td><td>' + badge + '</td><td>' + win + '</td><td>' + btn + '</td></tr>';
  }

  /* ---------- router ---------- */
  function route() {
    var h = location.hash || '#/';
    closeModal(); $('#links').classList.remove('open');
    if (h.indexOf('#/card/') === 0) { viewCard(h.slice(7)); window.scrollTo(0, 0); }
    else if (h === '#/dashboard') { viewDash(); window.scrollTo(0, 0); }
    else if (h === '#/market') viewHome(true);
    else { viewHome(false); window.scrollTo(0, 0); }
    renderNav();
  }

  /* ---------- modal ---------- */
  var lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    $('#modal').innerHTML = html; $('#overlay').hidden = false; $('#modal').focus();
  }
  function closeModal() { $('#overlay').hidden = true; $('#modal').innerHTML = ''; if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} } lastFocus = null; }
  function mHead(t, s) { return '<div class="m-head"><div><h2>' + t + '</h2><p class="sub">' + s + '</p></div><button class="x" data-act="close" aria-label="Close">×</button></div>'; }
  var NOTE = '<div class="demo-note">DEMO ONLY — NO REAL PURCHASES OR PAYMENTS</div>';

  function openAuth(mode) {
    var su = mode === 'signup';
    openModal(mHead(su ? 'Create demo account' : 'Log in to demo', 'Use any name and email. Do not enter real passwords.') + NOTE +
      '<div class="tabs"><button data-act="auth" data-mode="login" class="' + (su ? '' : 'on') + '">Log in</button><button data-act="auth" data-mode="signup" class="' + (su ? 'on' : '') + '">Sign up</button></div>' +
      '<form id="authForm" novalidate>' + (su ? '<label for="an">Name</label><input class="field" id="an" autocomplete="off" maxlength="40">' : '') +
      '<label for="ae">Email</label><input class="field" id="ae" type="email" autocomplete="off" maxlength="80">' +
      '<label for="ap">Demo password (min 8 characters, not stored)</label><input class="field" id="ap" type="password" autocomplete="off" maxlength="64">' +
      '<div class="err" id="aerr" role="alert"></div><button class="btn btn-primary btn-block" type="submit" style="margin-top:8px">' + (su ? 'Create account' : 'Log in') + '</button></form>');
    $('#authForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = su ? $('#an').value.trim() : '', email = $('#ae').value.trim(), pw = $('#ap').value, err = '';
      if (su && name.length < 2) err = 'Enter your name (at least 2 characters).';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err = 'Enter a valid email address.';
      else if (pw.length < 8) err = 'Demo password must be at least 8 characters.';
      if (err) { $('#aerr').textContent = err; return; }
      var prev = state.user || state.lastUser;
      var same = prev && prev.email.toLowerCase() === email.toLowerCase();
      if (same) { state.user = prev; delete state.lastUser; }
      else { state = { user: { name: name || email.split('@')[0], email: email }, balance: 10000, orders: [] }; }
      save(); closeModal(); renderNav(); toast('Welcome, ' + state.user.name + '! Demo wallet ready.');
      var p = pending; pending = null;
      if (p) p(); else if ((location.hash || '') === '#/dashboard') viewDash();
    });
  }

  function openCheckout(id) {
    var c = byId(id);
    if (!state.user) { pending = function () { openCheckout(id); }; openAuth('login'); return; }
    var ok = state.balance >= c.price;
    openModal(mHead('Checkout', 'Simulated payment from your demo wallet.') + NOTE +
      '<div class="sum"><div><span>' + esc(c.brand) + ' Gift Card (' + money(c.face) + ' face value)</span><span>' + money(c.price) + '</span></div>' +
      '<div><span>Discount</span><span class="good">-' + money(c.face - c.price) + ' vs face value</span></div>' +
      '<div class="tot"><span>Total (demo)</span><span>' + money(c.price) + '</span></div></div>' +
      '<div class="sum"><div><span>Payment method</span><span>Demo wallet</span></div><div><span>Balance</span><span>' + money(state.balance) + '</span></div><div><span>Balance after</span><span>' + (ok ? money(state.balance - c.price) : 'Insufficient') + '</span></div></div>' +
      '<div class="err" id="cerr">' + (ok ? '' : 'Not enough demo credits. Add free demo credits to continue.') + '</div>' +
      '<div class="m-actions">' + (ok ? '<button class="btn btn-primary" id="pay" data-act="pay" data-id="' + c.id + '">Confirm demo purchase</button>' : '<button class="btn btn-primary" data-act="topup-checkout" data-id="' + c.id + '">Add $25 demo credits</button>') +
      '<button class="btn btn-ghost" data-act="close">Cancel</button></div>');
  }

  function doPay(id) {
    var c = byId(id), b = $('#pay');
    if (!c || state.balance < c.price) return;
    b.disabled = true; b.innerHTML = '<span class="spin"></span> Processing demo payment…';
    setTimeout(function () {
      var o = { id: String(Math.floor(1000 + Math.random() * 9000)) + rand4().slice(0, 1), cardId: c.id, name: c.brand + ' Gift Card', face: c.face, paid: c.price, ts: Date.now(), status: 'active', code: 'DEMO-' + rand4() + '-' + rand4() + '-' + rand4(), refund: 0 };
      state.balance -= c.price; state.orders.unshift(o); save(); renderNav();
      openConfirm(o);
    }, 1200);
  }

  function openConfirm(o) {
    openModal(mHead('Purchase confirmed ✓', 'Order #' + esc(o.id) + ' · demo only') + NOTE +
      '<div class="sum"><div><span>' + esc(o.name) + '</span><span>' + money(o.paid) + '</span></div><div><span>Face value</span><span>' + money(o.face) + '</span></div></div>' +
      '<div class="codebox"><small style="color:var(--muted)">Your demo code (has no real value)</small><br><code>' + esc(o.code) + '</code></div>' +
      '<div class="sum"><div><span>Refund window left</span><span class="timer" data-exp="' + (o.ts + REFUND_WINDOW_MS) + '">' + fmtTime(o.ts + REFUND_WINDOW_MS - Date.now()) + '</span></div></div>' +
      '<div class="m-actions"><button class="btn btn-ghost" data-act="refund" data-oid="' + o.id + '">Request refund</button><a class="btn btn-primary" href="#/dashboard">Go to dashboard</a><button class="btn btn-ghost" data-act="close">Keep shopping</button></div>');
    if ((location.hash || '') === '#/dashboard') viewDash();
  }

  function openRefund(oid) {
    var o = state.orders.filter(function (x) { return x.id === oid; })[0];
    if (!o) return;
    var left = o.ts + REFUND_WINDOW_MS - Date.now();
    if (o.status !== 'active') { toast('This order was already refunded.'); return; }
    if (left <= 0) { toast('The 5-minute refund window has closed.'); return; }
    var fee = Math.round(o.paid * REFUND_FEE_RATE), back = o.paid - fee;
    openModal(mHead('Request refund', 'Order #' + esc(o.id) + ' · ' + esc(o.name)) + NOTE +
      '<div class="sum"><div><span>Amount paid</span><span>' + money(o.paid) + '</span></div><div><span>Processing fee (10%)</span><span style="color:var(--red)">-' + money(fee) + '</span></div><div class="tot"><span>Refund to demo wallet</span><span class="good">' + money(back) + '</span></div></div>' +
      '<div class="sum"><div><span>Time left</span><span class="timer" data-exp="' + (o.ts + REFUND_WINDOW_MS) + '">' + fmtTime(left) + '</span></div></div>' +
      '<div class="m-actions"><button class="btn btn-danger" data-act="confirm-refund" data-oid="' + o.id + '">Confirm refund</button><button class="btn btn-ghost" data-act="close">Cancel</button></div>');
  }

  function doRefund(oid) {
    var o = state.orders.filter(function (x) { return x.id === oid; })[0];
    if (!o || o.status !== 'active' || Date.now() > o.ts + REFUND_WINDOW_MS) { toast('Refund is no longer available.'); closeModal(); return; }
    var fee = Math.round(o.paid * REFUND_FEE_RATE);
    o.status = 'refunded'; o.refund = o.paid - fee; state.balance += o.refund; save();
    closeModal(); renderNav(); toast('Refunded ' + money(o.refund) + ' to your demo wallet (fee ' + money(fee) + ').');
    if ((location.hash || '') === '#/dashboard') viewDash();
  }

  /* ---------- timers ---------- */
  function tick() {
    var now = Date.now();
    $$('[data-exp]').forEach(function (el) { var l = +el.dataset.exp - now; el.textContent = l > 0 ? fmtTime(l) : 'Expired'; });
    $$('button[data-act="refund"][data-oid], button[data-act="confirm-refund"]').forEach(function (b) {
      var o = state.orders.filter(function (x) { return x.id === b.dataset.oid; })[0];
      if (o && o.status === 'active' && now > o.ts + REFUND_WINDOW_MS && !b.disabled) { b.disabled = true; b.textContent = 'Window closed'; }
    });
  }
  setInterval(tick, 1000);

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.id === 'overlay') { closeModal(); return; }
    var t = e.target.closest('[data-act]'); if (!t) return;
    var a = t.dataset.act;
    if (a === 'menu') { var l = $('#links'); var o = l.classList.toggle('open'); t.setAttribute('aria-expanded', o); }
    else if (a === 'close') closeModal();
    else if (a === 'auth') openAuth(t.dataset.mode);
    else if (a === 'logout') { state.lastUser = state.user; state.user = null; save(); renderNav(); toast('Logged out. Your demo data stays in this browser.'); route(); }
    else if (a === 'buy') openCheckout(t.dataset.id);
    else if (a === 'pay') doPay(t.dataset.id);
    else if (a === 'topup' || a === 'topup-checkout') {
      state.balance += 2500; save(); renderNav(); toast('Added $25.00 in demo credits.');
      if (a === 'topup-checkout') openCheckout(t.dataset.id); else viewDash();
    }
    else if (a === 'reset') { if (confirm('Reset all demo data in this browser?')) { var u = state.user; state = { user: u, balance: 10000, orders: [] }; save(); renderNav(); viewDash(); toast('Demo data reset.'); } }
    else if (a === 'refund') openRefund(t.dataset.oid);
    else if (a === 'confirm-refund') doRefund(t.dataset.oid);
    else if (a === 'cat') {
      filters.cat = t.dataset.cat;
      if ($('#grid')) { renderGrid(); if (t.classList.contains('cat')) $('#market').scrollIntoView({ behavior: 'smooth' }); }
    }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'q') { filters.q = e.target.value; renderGrid(); } });
  document.addEventListener('change', function (e) { if (e.target.id === 'sort') { filters.sort = e.target.value; renderGrid(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#overlay').hidden) closeModal(); });
  window.addEventListener('hashchange', route);
  route();
})();

document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://mzptuevbfpfkigzfpjjv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_QpNv78gacqvnuUISKjbmqg_E2uSDxbv';
  if (typeof window.supabase === 'undefined') { alert('Could not load Supabase.'); return; }
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  let legs = [
    { from: '', to: '', rate: '', fee: '', op: 'multiply' },
    { from: '', to: '', rate: '', fee: '', op: 'multiply' }
  ];
  let lastCalc = null;

  let toastTimer;
  function showToast(msg, type = '') {
    const t = $('toast'); if (!t) return;
    t.innerText = msg; t.className = 'toast ' + type;
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmt(n, d = 2) { if (!isFinite(n)) return '—'; return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // LEGS UI
  function renderLegs() {
    const c = $('legsContainer'); c.innerHTML = '';
    legs.forEach((leg, i) => {
      const div = document.createElement('div');
      div.className = 'leg';
      const pairLabel = (leg.from || '?') + ' → ' + (leg.to || '?');
      div.innerHTML = `
        <div class="leg-header">
          <div><div class="leg-number">LEG ${i+1}</div><div class="leg-pair">${esc(pairLabel)}</div></div>
          ${legs.length > 2 ? '<button type="button" class="leg-remove" data-remove="'+i+'">Remove</button>' : ''}
        </div>
        <div class="leg-row">
          <div class="form-group"><label>From</label><div class="input-wrap"><input type="text" data-field="from" data-i="${i}" value="${esc(leg.from)}" placeholder="NGN" maxlength="6"></div></div>
          <div class="form-group"><label>To</label><div class="input-wrap"><input type="text" data-field="to" data-i="${i}" value="${esc(leg.to)}" placeholder="USDT" maxlength="6"></div></div>
        </div>
        <div class="form-group">
          <label>Operation</label>
          <div class="op-toggle">
            <button type="button" class="op-btn ${leg.op==='multiply'?'active':''}" data-op="multiply" data-i="${i}">× Multiply</button>
            <button type="button" class="op-btn ${leg.op==='divide'?'active':''}" data-op="divide" data-i="${i}">÷ Divide</button>
          </div>
        </div>
        <div class="leg-row">
          <div class="form-group"><label>Rate</label><div class="input-wrap"><input type="number" data-field="rate" data-i="${i}" value="${leg.rate}" placeholder="0.00" step="any" inputmode="decimal"></div></div>
          <div class="form-group"><label>Fee %</label><div class="input-wrap"><input type="number" data-field="fee" data-i="${i}" value="${leg.fee}" placeholder="0" step="any" inputmode="decimal"></div></div>
        </div>`;
      c.appendChild(div);
    });
    c.querySelectorAll('input[data-field]').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-i'));
        const f = e.target.getAttribute('data-field');
        legs[i][f] = e.target.value;
        if (f === 'from' || f === 'to') {
          const pairEl = e.target.closest('.leg').querySelector('.leg-pair');
          pairEl.innerText = (legs[i].from || '?') + ' → ' + (legs[i].to || '?');
        }
      });
    });
    c.querySelectorAll('.op-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        legs[parseInt(btn.getAttribute('data-i'))].op = btn.getAttribute('data-op');
        renderLegs();
      });
    });
    c.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => { legs.splice(parseInt(btn.getAttribute('data-remove')), 1); renderLegs(); });
    });
  }
  renderLegs();

  $('addLegBtn').addEventListener('click', () => {
    if (legs.length >= 8) { showToast('Maximum 8 legs', 'error'); return; }
    legs.push({ from: legs[legs.length-1].to || '', to: '', rate: '', fee: '', op: 'multiply' });
    renderLegs();
  });

  // CALCULATE
  $('calculate-btn').addEventListener('click', () => {
    const startCurrency = $('startCurrency').value.trim().toUpperCase();
    const startAmount = parseFloat($('startAmount').value);
    if (!startCurrency) { showToast('Enter starting currency', 'error'); return; }
    if (!startAmount || startAmount <= 0) { showToast('Enter a valid starting amount', 'error'); return; }
    if (legs.length < 2) { showToast('Add at least 2 legs', 'error'); return; }
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i];
      if (!l.from || !l.to) { showToast('Leg ' + (i+1) + ': fill From and To', 'error'); return; }
      if (!parseFloat(l.rate) || parseFloat(l.rate) <= 0) { showToast('Leg ' + (i+1) + ': enter a valid rate', 'error'); return; }
    }
    let amount = startAmount;
    const steps = [];
    legs.forEach((l, i) => {
      const rate = parseFloat(l.rate);
      const feePct = parseFloat(l.fee) || 0;
      const from = l.from.toUpperCase();
      const to = l.to.toUpperCase();
      const op = l.op || 'multiply';
      const beforeFee = op === 'divide' ? amount / rate : amount * rate;
      const feeAmount = beforeFee * (feePct / 100);
      const afterFee = beforeFee - feeAmount;
      steps.push({ legNumber: i+1, from, to, rate, op, feePercent: feePct, inputAmount: amount, beforeFee, feeAmount, outputAmount: afterFee });
      amount = afterFee;
    });
    const finalCurrency = steps[steps.length-1].to;
    const profit = amount - startAmount;
    const roiPercent = (profit / startAmount) * 100;
    lastCalc = { startCurrency, startAmount, finalCurrency, finalAmount: amount, profit, roiPercent, steps };

    const v = $('verdict');
    v.className = 'verdict ' + (roiPercent > 0 ? 'verdict-profit' : 'verdict-loss');
    v.querySelector('.verdict-label').innerText = 'ROI';
    v.querySelector('.verdict-value').innerText = (roiPercent >= 0 ? '+' : '') + fmt(roiPercent, 2) + '%';
    v.querySelector('.verdict-sub').innerText = roiPercent > 0 ? '✓ PROFITABLE — Worth trading' : '✗ NOT PROFITABLE — Skip this route';

    let html = '';
    steps.forEach(s => {
      const opSym = s.op === 'divide' ? '÷' : '×';
      html += '<div class="breakdown-leg">'
        + '<div class="breakdown-leg-title">LEG ' + s.legNumber + ' · ' + esc(s.from) + ' → ' + esc(s.to) + '</div>'
        + '<div class="breakdown-leg-detail"><span>Input</span><span>' + fmt(s.inputAmount, 4) + ' ' + esc(s.from) + '</span></div>'
        + '<div class="breakdown-leg-detail"><span>Rate (' + opSym + ')</span><span>' + fmt(s.rate, 6) + '</span></div>'
        + '<div class="breakdown-leg-detail"><span>Before fee</span><span>' + fmt(s.beforeFee, 4) + ' ' + esc(s.to) + '</span></div>'
        + '<div class="breakdown-leg-detail"><span>Fee (' + fmt(s.feePercent, 2) + '%)</span><span>− ' + fmt(s.feeAmount, 4) + ' ' + esc(s.to) + '</span></div>'
        + '<div class="breakdown-leg-detail"><span>Output</span><span>' + fmt(s.outputAmount, 4) + ' ' + esc(s.to) + '</span></div>'
        + '</div>';
    });
    $('breakdownCard').innerHTML = html;
    $('startedVal').innerText = fmt(startAmount, 2) + ' ' + esc(startCurrency);
    $('endedVal').innerText = fmt(amount, 2) + ' ' + esc(finalCurrency);
    $('profitVal').innerText = (profit >= 0 ? '+' : '') + fmt(profit, 2) + ' ' + esc(startCurrency);
    $('profitVal').style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
    $('roiVal').innerText = (roiPercent >= 0 ? '+' : '') + fmt(roiPercent, 2) + '%';
    $('roiVal').style.color = roiPercent >= 0 ? 'var(--green)' : 'var(--red)';
    $('results').style.display = 'block';
    setTimeout(() => $('results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  });

  // AUTH
  async function getUser() {
    try { const { data: { user } } = await supabase.auth.getUser(); return user; } catch { return null; }
  }
  function showModal() { $('authModal').classList.remove('hidden'); $('authStatus').innerText = ''; setTimeout(() => $('authEmail').focus(), 250); }
  function hideModal() { $('authModal').classList.add('hidden'); }
  async function sendMagicLink() {
    const email = $('authEmail').value.trim();
    if (!email || !email.includes('@')) { $('authStatus').innerText = 'Enter a valid email.'; return; }
    const btn = $('authSendBtn'); const label = $('authSendLabel');
    btn.disabled = true; label.innerText = 'Sending...'; $('authStatus').innerText = '';
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    btn.disabled = false; label.innerText = 'Send Magic Link';
    $('authStatus').innerText = error ? 'Error: ' + error.message : '✓ Check your inbox.';
  }
  async function signOut() { await supabase.auth.signOut(); updateAuthUI(); showToast('Signed out', 'success'); }
  function updateAuthUI() {
    getUser().then(user => {
      const btn = $('auth-btn'); const info = $('user-info');
      if (user) {
        btn.innerText = 'Sign out'; btn.onclick = signOut;
        info.innerText = '✓ ' + user.email;
        $('presetsSection').style.display = 'block'; loadPresets();
      } else {
        btn.innerText = 'Sign In'; btn.onclick = showModal;
        info.innerText = ''; $('presetsSection').style.display = 'none';
      }
    });
  }
  $('modalClose').addEventListener('click', hideModal);
  const sendBtn = $('authSendBtn'); let lastTap = 0;
  const handleSendTap = (e) => { e.preventDefault(); const now = Date.now(); if (now - lastTap < 500) return; lastTap = now; sendMagicLink(); };
  sendBtn.addEventListener('click', handleSendTap);
  sendBtn.addEventListener('touchend', handleSendTap, { passive: false });
  $('authModal').addEventListener('click', (e) => { if (e.target === $('authModal')) hideModal(); });
  $('authEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMagicLink(); });
  updateAuthUI();
  supabase.auth.onAuthStateChange(() => updateAuthUI());

  // SAVE TRADE
  $('saveTradeBtn').addEventListener('click', async () => {
    if (!lastCalc) { showToast('Calculate first', 'error'); return; }
    const user = await getUser(); if (!user) { showModal(); return; }
    const { error } = await supabase.from('arbitrage_trades').insert({
      user_id: user.id, starting_currency: lastCalc.startCurrency, starting_amount: lastCalc.startAmount,
      final_currency: lastCalc.finalCurrency, final_amount: lastCalc.finalAmount,
      profit: lastCalc.profit, roi_percent: lastCalc.roiPercent, legs: lastCalc.steps
    });
    showToast(error ? 'Save error: ' + error.message : 'Saved ✓', error ? 'error' : 'success');
  });

  // HISTORY
  $('history-btn').addEventListener('click', loadHistory);
  async function loadHistory() {
    try {
      const user = await getUser(); if (!user) { showModal(); return; }
      const { data, error } = await supabase.from('arbitrage_trades').select('*').order('created_at', { ascending: false });
      const c = $('history-list');
      if (error) { c.innerHTML = '<div class="empty-state">⚠️ ' + esc(error.message) + '</div>'; return; }
      if (!data || !data.length) { c.innerHTML = '<div class="empty-state"><div class="icon">📊</div>No trades yet</div>'; return; }
      let html = '';
      data.forEach(r => {
        const pc = r.profit >= 0 ? 'positive' : 'negative';
        const arr = (r.legs || []).map(s => s.from);
        const lastTo = r.legs && r.legs.length ? r.legs[r.legs.length-1].to : '';
        html += '<div class="history-item">'
          + '<div class="history-route">' + esc(arr.join(' → ') + (lastTo ? ' → ' + lastTo : '')) + '</div>'
          + '<div class="history-profit ' + pc + '">' + (r.roi_percent >= 0 ? '+' : '') + fmt(r.roi_percent, 2) + '%</div>'
          + '<div class="history-meta">' + fmt(r.starting_amount, 2) + ' ' + esc(r.starting_currency) + ' → ' + fmt(r.final_amount, 2) + ' ' + esc(r.final_currency) + '</div>'
          + '<div class="history-meta">Profit: ' + (r.profit >= 0 ? '+' : '') + fmt(r.profit, 2) + ' ' + esc(r.starting_currency) + '</div>'
          + '<div class="history-meta">' + new Date(r.created_at).toLocaleString() + '</div>'
          + '<div class="history-actions">'
          + '<button type="button" class="btn-edit" data-edit="' + r.id + '">✏️ Edit</button>'
          + '<button type="button" class="btn-delete" data-delete="' + r.id + '">🗑 Delete</button>'
          + '</div></div>';
      });
      c.innerHTML = html;
      c.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
        const trade = data.find(x => x.id === btn.getAttribute('data-edit')); if (!trade) return;
        legs = (trade.legs || []).map(s => ({ from: s.from, to: s.to, rate: s.rate, fee: s.feePercent, op: s.op || 'multiply' }));
        if (legs.length < 2) legs.push({ from: '', to: '', rate: '', fee: '', op: 'multiply' });
        $('startCurrency').value = trade.starting_currency;
        $('startAmount').value = trade.starting_amount;
        renderLegs(); showToast('Loaded — edit and recalculate');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }));
      c.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete this trade?')) return;
        const { error: de } = await supabase.from('arbitrage_trades').delete().eq('id', btn.getAttribute('data-delete'));
        if (de) { showToast('Delete error: ' + de.message, 'error'); return; }
        showToast('Deleted', 'success'); loadHistory();
      }));
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  // PRESETS
  $('savePresetBtn').addEventListener('click', async () => {
    const u = await getUser(); if (!u) { showModal(); return; }
    if (legs.length < 2) { showToast('Add at least 2 legs', 'error'); return; }
    for (let i = 0; i < legs.length; i++) { if (!legs[i].from || !legs[i].to) { showToast('Leg ' + (i+1) + ': fill From and To', 'error'); return; } }
    $('presetName').value = ''; $('presetModal').classList.remove('hidden');
    setTimeout(() => $('presetName').focus(), 250);
  });
  $('presetModalClose').addEventListener('click', () => $('presetModal').classList.add('hidden'));
  $('presetModal').addEventListener('click', (e) => { if (e.target === $('presetModal')) $('presetModal').classList.add('hidden'); });
  $('presetSaveBtn').addEventListener('click', async () => {
    const name = $('presetName').value.trim(); if (!name) { showToast('Enter a name', 'error'); return; }
    const user = await getUser(); if (!user) { showModal(); return; }
    const cleanLegs = legs.map(l => ({ from: l.from, to: l.to, op: l.op || 'multiply' }));
    const { error } = await supabase.from('arbitrage_presets').insert({
      user_id: user.id, preset_name: name,
      starting_currency: $('startCurrency').value.trim().toUpperCase() || '', legs: cleanLegs
    });
    if (error) { showToast('Save error: ' + error.message, 'error'); return; }
    showToast('Preset saved ✓', 'success'); $('presetModal').classList.add('hidden'); loadPresets();
  });
  async function loadPresets() {
    const user = await getUser(); if (!user) return;
    const { data, error } = await supabase.from('arbitrage_presets').select('*').order('created_at', { ascending: false });
    const c = $('presetsList');
    if (error) { c.innerHTML = '<div class="empty-state">Error: ' + esc(error.message) + '</div>'; return; }
    if (!data || !data.length) { c.innerHTML = '<div class="empty-state">No presets yet</div>'; return; }
    let html = '';
    data.forEach(p => {
      const arr = (p.legs || []).map(s => s.from);
      const lastTo = p.legs && p.legs.length ? p.legs[p.legs.length-1].to : '';
      html += '<div class="preset-item">'
        + '<div class="preset-info"><div class="preset-name">' + esc(p.preset_name) + '</div>'
        + '<div class="preset-route">' + esc(arr.join(' → ') + (lastTo ? ' → ' + lastTo : '')) + '</div></div>'
        + '<div class="preset-actions">'
        + '<button type="button" data-load-preset="' + p.id + '">Load</button>'
        + '<button type="button" data-delete-preset="' + p.id + '">✕</button>'
        + '</div></div>';
    });
    c.innerHTML = html;
    c.querySelectorAll('[data-load-preset]').forEach(btn => btn.addEventListener('click', () => {
      const preset = data.find(x => x.id === btn.getAttribute('data-load-preset')); if (!preset) return;
      legs = (preset.legs || []).map(s => ({ from: s.from, to: s.to, rate: '', fee: '', op: s.op || 'multiply' }));
      if (legs.length < 2) legs.push({ from: '', to: '', rate: '', fee: '', op: 'multiply' });
      $('startCurrency').value = preset.starting_currency || '';
      renderLegs(); showToast('Preset loaded — enter rates');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    c.querySelectorAll('[data-delete-preset]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete this preset?')) return;
      const { error: de } = await supabase.from('arbitrage_presets').delete().eq('id', btn.getAttribute('data-delete-preset'));
      if (de) { showToast('Delete error: ' + de.message, 'error'); return; }
      showToast('Deleted', 'success'); loadPresets();
    }));
  }

});

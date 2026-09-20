document.addEventListener('DOMContentLoaded', () => {

  const SUPABASE_URL = 'https://mzptuevbfpfkigzfpjjv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_QpNv78gacqvnuUISKjbmqg_E2uSDxbv';

  if (typeof window.supabase === 'undefined') {
    alert('Could not load Supabase. Check your connection.');
    return;
  }

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);

  let legs = [
    { from: '', to: '', rate: '', fee: '' },
    { from: '', to: '', rate: '', fee: '' }
  ];

  let lastCalc = null;

  // ---------- TOAST ----------
  let toastTimer;
  function showToast(msg, type = '') {
    const t = $('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = 'toast ' + type;
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function fmtNum(n, decimals = 2) {
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  // ---------- LEGS UI ----------
  function renderLegs() {
    const container = $('legsContainer');
    container.innerHTML = '';

    legs.forEach((leg, i) => {
      const div = document.createElement('div');
      div.className = 'leg';

      const pairLabel = (leg.from || '?') + ' → ' + (leg.to || '?');

      div.innerHTML = `
        <div class="leg-header">
          <div>
            <div class="leg-number">LEG ${i + 1}</div>
            <div class="leg-pair">${escapeHtml(pairLabel)}</div>
          </div>
          ${legs.length > 2 ? `<button type="button" class="leg-remove" data-remove="${i}">Remove</button>` : ''}
        </div>
        <div class="leg-row">
          <div class="form-group">
            <label>From</label>
            <div class="input-wrap">
              <input type="text" data-field="from" data-i="${i}" value="${escapeHtml(leg.from)}" placeholder="NGN" maxlength="6">
            </div>
          </div>
          <div class="form-group">
            <label>To</label>
            <div class="input-wrap">
              <input type="text" data-field="to" data-i="${i}" value="${escapeHtml(leg.to)}" placeholder="USDT" maxlength="6">
            </div>
          </div>
        </div>
        <div class="leg-row">
          <div class="form-group">
            <label>Rate</label>
            <div class="input-wrap">
              <input type="number" data-field="rate" data-i="${i}" value="${leg.rate}" placeholder="0.00" step="any" inputmode="decimal">
            </div>
          </div>
          <div class="form-group">
            <label>Fee %</label>
            <div class="input-wrap">
              <input type="number" data-field="fee" data-i="${i}" value="${leg.fee}" placeholder="0" step="any" inputmode="decimal">
            </div>
          </div>
        </div>
      `;

      container.appendChild(div);
    });

    // Wire inputs
    container.querySelectorAll('input[data-field]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.getAttribute('data-i'));
        const field = e.target.getAttribute('data-field');
        legs[i][field] = e.target.value;
        if (field === 'from' || field === 'to') {
          const pairEl = e.target.closest('.leg').querySelector('.leg-pair');
          pairEl.innerText = (legs[i].from || '?') + ' → ' + (legs[i].to || '?');
        }
      });
    });

    // Wire remove buttons
    container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-remove'));
        legs.splice(i, 1);
        renderLegs();
      });
    });
  }

  renderLegs();

  $('addLegBtn').addEventListener('click', () => {
    if (legs.length >= 8) { showToast('Maximum 8 legs', 'error'); return; }
    const prev = legs[legs.length - 1];
    legs.push({ from: prev.to || '', to: '', rate: '', fee: '' });
    renderLegs();
  });

  // ---------- CALCULATE ----------
  function calculateRoute() {
    const startCurrency = $('startCurrency').value.trim().toUpperCase();
    const startAmount = parseFloat($('startAmount').value);

    if (!startCurrency) { showToast('Enter starting currency', 'error'); return null; }
    if (!startAmount || startAmount <= 0) { showToast('Enter a valid starting amount', 'error'); return null; }
    if (legs.length < 2) { showToast('Add at least 2 legs', 'error'); return null; }

    for (let i = 0; i < legs.length; i++) {
      const l = legs[i];
      if (!l.from || !l.to) { showToast('Leg ' + (i + 1) + ': fill From and To', 'error'); return null; }
      const r = parseFloat(l.rate);
      if (!r || r <= 0) { showToast('Leg ' + (i + 1) + ': enter a valid rate', 'error'); return null; }
    }

    let currentAmount = startAmount;
    const steps = [];

    legs.forEach((l, i) => {
      const rate = parseFloat(l.rate);
      const feePct = parseFloat(l.fee) || 0;
      const from = l.from.toUpperCase();
      const to = l.to.toUpperCase();

      const beforeFee = currentAmount * rate;
      const feeAmount = beforeFee * (feePct / 100);
      const afterFee = beforeFee - feeAmount;

      steps.push({
        legNumber: i + 1,
        from, to, rate,
        feePercent: feePct,
        inputAmount: currentAmount,
        beforeFee,
        feeAmount,
        outputAmount: afterFee
      });

      currentAmount = afterFee;
    });

    const finalCurrency = steps[steps.length - 1].to;
    const finalAmount = currentAmount;
    const profit = finalAmount - startAmount;
    const roiPercent = (profit / startAmount) * 100;

    return {
      startCurrency,
      startAmount,
      finalCurrency,
      finalAmount,
      profit,
      roiPercent,
      steps
    };
  }

  $('calculate-btn').addEventListener('click', () => {
    const result = calculateRoute();
    if (!result) return;
    lastCalc = result;
    renderResult(result);
    $('results').style.display = 'block';
    setTimeout(() => {
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  function renderResult(r) {
    // Verdict
    const verdict = $('verdict');
    verdict.className = 'verdict ' + (r.roiPercent > 0 ? 'verdict-profit' : 'verdict-loss');
    verdict.querySelector('.verdict-label').innerText = 'ROI';
    verdict.querySelector('.verdict-value').innerText =
      (r.roiPercent >= 0 ? '+' : '') + fmtNum(r.roiPercent, 2) + '%';
    verdict.querySelector('.verdict-sub').innerText =
      r.roiPercent > 0
        ? '✓ PROFITABLE — Worth trading'
        : '✗ NOT PROFITABLE — Skip this route';

    // Breakdown
    const card = $('breakdownCard');
    let html = '';
    r.steps.forEach((s) => {
      html += `
        <div class="breakdown-leg">
          <div class="breakdown-leg-title">LEG ${s.legNumber} · ${escapeHtml(s.from)} → ${escapeHtml(s.to)}</div>
          <div class="breakdown-leg-detail"><span>Input</span><span>${fmtNum(s.inputAmount, 4)} ${escapeHtml(s.from)}</span></div>
          <div class="breakdown-leg-detail"><span>Rate</span><span>× ${fmtNum(s.rate, 6)}</span></div>
          <div class="breakdown-leg-detail"><span>Before fee</span><span>${fmtNum(s.beforeFee, 4)} ${escapeHtml(s.to)}</span></div>
          <div class="breakdown-leg-detail"><span>Fee (${fmtNum(s.feePercent, 2)}%)</span><span>− ${fmtNum(s.feeAmount, 4)} ${escapeHtml(s.to)}</span></div>
          <div class="breakdown-leg-detail"><span>Output</span><span>${fmtNum(s.outputAmount, 4)} ${escapeHtml(s.to)}</span></div>
        </div>
      `;
    });
    card.innerHTML = html;

    // Summary
    $('startedVal').innerText = fmtNum(r.startAmount, 2) + ' ' + escapeHtml(r.startCurrency);
    $('endedVal').innerText = fmtNum(r.finalAmount, 2) + ' ' + escapeHtml(r.finalCurrency);
    $('profitVal').innerText = (r.profit >= 0 ? '+' : '') + fmtNum(r.profit, 2) + ' ' + escapeHtml(r.startCurrency);
    $('profitVal').style.color = r.profit >= 0 ? 'var(--green)' : 'var(--red)';
    $('roiVal').innerText = (r.roiPercent >= 0 ? '+' : '') + fmtNum(r.roiPercent, 2) + '%';
    $('roiVal').style.color = r.roiPercent >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // ---------- AUTH ----------
  async function getUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch { return null; }
  }

  function showModal() {
    $('authModal').classList.remove('hidden');
    $('authStatus').innerText = '';
    setTimeout(() => $('authEmail').focus(), 250);
  }
  function hideModal() { $('authModal').classList.add('hidden'); }

  async function sendMagicLink() {
    const email = $('authEmail').value.trim();
    if (!email || !email.includes('@')) {
      $('authStatus').innerText = 'Please enter a valid email.';
      return;
    }
    const btn = $('authSendBtn');
    const label = $('authSendLabel');
    btn.disabled = true;
    label.innerText = 'Sending...';
    $('authStatus').innerText = '';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });

    btn.disabled = false;
    label.innerText = 'Send Magic Link';
    $('authStatus').innerText = error ? 'Error: ' + error.message : '✓ Check your inbox.';
  }

  async function signOut() {
    await supabase.auth.signOut();
    updateAuthUI();
    showToast('Signed out', 'success');
  }

  function updateAuthUI() {
    getUser().then(user => {
      const btn = $('auth-btn');
      const info = $('user-info');
      if (user) {
        btn.innerText = 'Sign out';
        btn.onclick = signOut;
        info.innerText = '✓ ' + user.email;
        $('presetsSection').style.display = 'block';
        loadPresets();
      } else {
        btn.innerText = 'Sign In';
        btn.onclick = showModal;
        info.innerText = '';
        $('presetsSection').style.display = 'none';
      }
    });
  }

  $('modalClose').addEventListener('click', hideModal);
  const sendBtn = $('authSendBtn');
  let lastTap = 0;
  const handleSendTap = (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap < 500) return;
    lastTap = now;
    sendMagicLink();
  };
  sendBtn.addEventListener('click', handleSendTap);
  sendBtn.addEventListener('touchend', handleSendTap, { passive: false });

  $('authModal').addEventListener('click', (e) => {
    if (e.target === $('authModal')) hideModal();
  });
  $('authEmail').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMagicLink();
  });

  updateAuthUI();
  supabase.auth.onAuthStateChange(() => updateAuthUI());
  
  // ---------- SAVE TRADE ----------
  $('saveTradeBtn').addEventListener('click', async () => {
    if (!lastCalc) { showToast('Calculate first', 'error'); return; }
    const user = await getUser();
    if (!user) { showModal(); return; }

    const { error } = await supabase.from('arbitrage_trades').insert({
      user_id: user.id,
      starting_currency: lastCalc.startCurrency,
      starting_amount: lastCalc.startAmount,
      final_currency: lastCalc.finalCurrency,
      final_amount: lastCalc.finalAmount,
      profit: lastCalc.profit,
      roi_percent: lastCalc.roiPercent,
      legs: lastCalc.steps
    });

    if (error) {
      showToast('Save error: ' + error.message, 'error');
    } else {
      showToast('Saved to history ✓', 'success');
    }
  });

  // ---------- HISTORY ----------
  $('history-btn').addEventListener('click', loadHistory);

  async function loadHistory() {
    try {
      const user = await getUser();
      if (!user) { showModal(); return; }

      const { data, error } = await supabase
        .from('arbitrage_trades')
        .select('*')
        .order('created_at', { ascending: false });

      const container = $('history-list');

      if (error) {
        container.innerHTML = '<div class="empty-state">⚠️ ' + escapeHtml(error.message) + '</div>';
        return;
      }

      if (!data || !data.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📊</div>No trades yet</div>';
        return;
      }

      let html = '';
      data.forEach((r) => {
        const profitClass = r.profit >= 0 ? 'positive' : 'negative';
        const route = (r.legs || []).map((s) => s.from).join(' → ') + ' → ' + (r.legs && r.legs.length ? r.legs[r.legs.length - 1].to : '');

        html += `
          <div class="history-item">
            <div class="history-route">${escapeHtml(route)}</div>
            <div class="history-profit ${profitClass}">
              ${(r.roi_percent >= 0 ? '+' : '')}${fmtNum(r.roi_percent, 2)}%
            </div>
            <div class="history-meta">
              ${fmtNum(r.starting_amount, 2)} ${escapeHtml(r.starting_currency)} → ${fmtNum(r.final_amount, 2)} ${escapeHtml(r.final_currency)}
            </div>
            <div class="history-meta">Profit: ${(r.profit >= 0 ? '+' : '')}${fmtNum(r.profit, 2)} ${escapeHtml(r.starting_currency)}</div>
            <div class="history-meta">${new Date(r.created_at).toLocaleString()}</div>
            <div class="history-actions">
              <button type="button" class="btn-edit" data-edit="${r.id}">✏️ Edit</button>
              <button type="button" class="btn-delete" data-delete="${r.id}">🗑 Delete</button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      container.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-edit');
          const trade = data.find((x) => x.id === id);
          if (!trade) return;
          legs = (trade.legs || []).map((s) => ({
            from: s.from,
            to: s.to,
            rate: s.rate,
            fee: s.feePercent
          }));
          $('startCurrency').value = trade.starting_currency;
          $('startAmount').value = trade.starting_amount;
          renderLegs();
          showToast('Loaded from history — edit and recalculate');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      container.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', () => {
          deleteTrade(btn.getAttribute('data-delete'));
        });
      });

    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function deleteTrade(id) {
    if (!confirm('Delete this trade from history?')) return;
    const { error } = await supabase.from('arbitrage_trades').delete().eq('id', id);
    if (error) {
      showToast('Delete error: ' + error.message, 'error');
      return;
    }
    showToast('Deleted', 'success');
    loadHistory();
  }

  // ---------- PRESETS ----------
  $('savePresetBtn').addEventListener('click', () => {
    const user = getUser();
    user.then((u) => {
      if (!u) { showModal(); return; }
      if (legs.length < 2) { showToast('Add at least 2 legs', 'error'); return; }
      for (let i = 0; i < legs.length; i++) {
        if (!legs[i].from || !legs[i].to) {
          showToast('Leg ' + (i + 1) + ': fill From and To', 'error');
          return;
        }
      }
      $('presetName').value = '';
      $('presetModal').classList.remove('hidden');
      setTimeout(() => $('presetName').focus(), 250);
    });
  });

  $('presetModalClose').addEventListener('click', () => {
    $('presetModal').classList.add('hidden');
  });
  $('presetModal').addEventListener('click', (e) => {
    if (e.target === $('presetModal')) $('presetModal').classList.add('hidden');
  });

  $('presetSaveBtn').addEventListener('click', async () => {
    const name = $('presetName').value.trim();
    if (!name) { showToast('Enter a preset name', 'error'); return; }

    const user = await getUser();
    if (!user) { showModal(); return; }

    const cleanLegs = legs.map((l) => ({ from: l.from, to: l.to }));

    const { error } = await supabase.from('arbitrage_presets').insert({
      user_id: user.id,
      preset_name: name,
      starting_currency: $('startCurrency').value.trim().toUpperCase() || '',
      legs: cleanLegs
    });

    if (error) {
      showToast('Save error: ' + error.message, 'error');
      return;
    }

    showToast('Preset saved ✓', 'success');
    $('presetModal').classList.add('hidden');
    loadPresets();
  });

  async function loadPresets() {
    const user = await getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('arbitrage_presets')
      .select('*')
      .order('created_at', { ascending: false });

    const container = $('presetsList');
    if (error) {
      container.innerHTML = '<div class="empty-state">Error: ' + escapeHtml(error.message) + '</div>';
      return;
    }
    if (!data || !data.length) {
      container.innerHTML = '<div class="empty-state">No presets yet</div>';
      return;
    }

    let html = '';
    data.forEach((p) => {
      const route = (p.legs || []).map((s) => s.from).join(' → ') + ' → ' + (p.legs && p.legs.length ? p.legs[p.legs.length - 1].to : '');
      html += `
        <div class="preset-item">
          <div class="preset-info">
            <div class="preset-name">${escapeHtml(p.preset_name)}</div>
            <div class="preset-route">${escapeHtml(route)}</div>
          </div>
          <div class="preset-actions">
            <button type="button" data-load-preset="${p.id}">Load</button>
            <button type="button" data-delete-preset="${p.id}">✕</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-load-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-load-preset');
        const preset = data.find((x) => x.id === id);
        if (!preset) return;
        legs = (preset.legs || []).map((s) => ({ from: s.from, to: s.to, rate: '', fee: '' }));
        if (legs.length < 2) legs.push({ from: '', to: '', rate: '', fee: '' });
        $('startCurrency').value = preset.starting_currency || '';
        renderLegs();
        showToast('Preset loaded — enter rates');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    container.querySelectorAll('[data-delete-preset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-preset');
        if (!confirm('Delete this preset?')) return;
        const { error } = await supabase.from('arbitrage_presets').delete().eq('id', id);
        if (error) { showToast('Delete error: ' + error.message, 'error'); return; }
        showToast('Preset deleted', 'success');
        loadPresets();
      });
    });
  }

});

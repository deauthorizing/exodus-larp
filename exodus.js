// ==UserScript==
// @name         Hello JSE GUI + Fake TX (Safe)
// @namespace    http://tampermonkey.net/
// @version      3.1.0
// @description  Balance spoof + fake transactions + safe observer
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // -------- Helpers --------
  const sget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const sset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // -------- Config --------
  const JSE_CONFIG = {
    bitcoin: {
      wholeBTC: sget('hello_wholeBTC', "83.259754"),
      wholeUSD: sget('hello_wholeUSD', "7,030,245"),
      partialUSD: sget('hello_partialUSD', ".27")
    },
    enabled: sget('hello_enabled', true),
    transactions: sget('hello_transactions', []) // [{id,date,amount,type}]
  };

  // -------- Core spoof functions --------
  function updateElements() {
    if (!JSE_CONFIG.enabled) return;

    // header balance BTC
    setText("#wallet-coin-header-balance .amount-whole", JSE_CONFIG.bitcoin.wholeBTC);

    // header balance USD
    setText("#wallet-coin-header-balance-local .amount-whole", JSE_CONFIG.bitcoin.wholeUSD);
    setText("#wallet-coin-header-balance-local .amount-partial", JSE_CONFIG.bitcoin.partialUSD);

    // portfolio dropdown
    setText("#global-navigation .x-portfolios-dropdown .amount-whole", JSE_CONFIG.bitcoin.wholeUSD);
    setText("#global-navigation .x-portfolios-dropdown .amount-partial", JSE_CONFIG.bitcoin.partialUSD);

    // top-left counter
    document.querySelectorAll('.counter-currency-text').forEach(counter => {
      const amountEl = counter.querySelector('.amount');
      if (!amountEl) return;
      if (counter.querySelector('.symbol')) {
        amountEl.textContent = `${JSE_CONFIG.bitcoin.wholeUSD}${JSE_CONFIG.bitcoin.partialUSD}`;
      }
      if (counter.querySelector('.code')) {
        amountEl.textContent = JSE_CONFIG.bitcoin.wholeBTC;
      }
    });

    // remove red errors, enable buttons
    removeErrorAlert();
    enableSendButtons();
    ensureExchangeButtonEnabled();

    // fake transactions
    applyFakeTransactions();

    // hook "All" button
    hookAllButton();
  }

  function setText(sel, val) {
    document.querySelectorAll(sel).forEach(el => { if (el) el.textContent = val; });
  }

  function setMaxValue() {
    const inputBTC = document.querySelector("#send-amount-btc");
    const inputFiat = document.querySelector("#send-amount-fiat");
    if (inputBTC) inputBTC.value = JSE_CONFIG.bitcoin.wholeBTC;
    if (inputFiat) inputFiat.value = `${JSE_CONFIG.bitcoin.wholeUSD}${JSE_CONFIG.bitcoin.partialUSD}`;
  }

  function hookAllButton() {
    const btn = document.querySelector("#send-all-button");
    if (btn && !btn.classList.contains("hello-hooked")) {
      btn.classList.add("hello-hooked");
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        setMaxValue();
      });
    }
  }

  function removeErrorAlert() {
    document.querySelectorAll(".x-alert").forEach(el => el.remove());
  }

  function enableSendButtons() {
    document.querySelectorAll("#send-continue-button, #send-all-button").forEach(el => {
      el.disabled = false;
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
    });
  }

  function ensureExchangeButtonEnabled() {
    const btn = document.querySelector("#exchange-continue-button");
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
  }

  // -------- Fake Transactions --------
  function applyFakeTransactions() {
    const txList = document.querySelector('#wallet-activity-list');
    if (!txList) return;
    txList.querySelectorAll('.hello-fake-tx').forEach(n => n.remove());

    JSE_CONFIG.transactions.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'x-activity-list-item hello-fake-tx';
      item.style.border = "1px solid #333";
      item.style.padding = "8px";
      item.style.marginBottom = "4px";
      item.innerHTML = `
        <div><strong>${tx.type}</strong> • ${tx.amount} BTC</div>
        <div style="font-size:12px;opacity:.7">${tx.date} — ${tx.id}</div>
      `;
      txList.prepend(item);
    });
  }

  function addFakeTransaction(id, date, amount, type) {
    JSE_CONFIG.transactions.push({id, date, amount, type});
    sset('hello_transactions', JSE_CONFIG.transactions);
    applyFakeTransactions();
  }

  // -------- Safe Loop --------
  let updating = false;
  function safeUpdate() {
    if (updating || !JSE_CONFIG.enabled) return;
    updating = true;
    requestAnimationFrame(() => {
      updateElements();
      updating = false;
    });
  }

  document.addEventListener('DOMContentLoaded', () => safeUpdate());

  setInterval(safeUpdate, 5000); // backup every 5s
  const observer = new MutationObserver(() => safeUpdate());
  observer.observe(document.body, { childList: true, subtree: true });

  // -------- GUI --------
  function closeGUI() { const b = document.getElementById('hello-backdrop'); if (b) b.remove(); }
  function openGUI() {
    closeGUI();
    const backdrop = document.createElement('div');
    backdrop.id = 'hello-backdrop';
    Object.assign(backdrop.style, {position:'fixed',inset:'0',background:'rgba(0,0,0,.5)',zIndex:2147483647,display:'flex',alignItems:'center',justifyContent:'center'});
    const modal = document.createElement('div');
    Object.assign(modal.style, {background:'#0f0f0f',color:'#eaeaea',width:'min(460px,95vw)',borderRadius:'12px',boxShadow:'0 12px 32px rgba(0,0,0,.45)',padding:'16px',fontFamily:'system-ui',maxHeight:'90vh',overflowY:'auto'});
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-weight:700;font-size:18px;">JSE Config</div>
        <button id="hello-close" style="background:transparent;border:none;color:#eaeaea;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <label><input id="hello-enabled" type="checkbox"> Enabled (Shift+U)</label>
        <div><div style="font-size:12px;margin-bottom:6px;opacity:.8;">BTC amount</div>
          <input id="hello-btc" type="text" value="${JSE_CONFIG.bitcoin.wholeBTC}" style="width:100%;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:8px;padding:10px;">
        </div>
        <div><div style="font-size:12px;margin-bottom:6px;opacity:.8;">USD (whole)</div>
          <input id="hello-usd" type="text" value="${JSE_CONFIG.bitcoin.wholeUSD}" style="width:100%;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:8px;padding:10px;">
        </div>
        <div><div style="font-size:12px;margin-bottom:6px;opacity:.8;">USD (partial)</div>
          <input id="hello-usd-part" type="text" value="${JSE_CONFIG.bitcoin.partialUSD}" style="width:100%;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:8px;padding:10px;">
        </div>

        <hr style="border:none;border-top:1px solid #333;margin:10px 0;">
        <div style="font-weight:600;">Fake Transactions</div>
        <div id="hello-tx-list" style="display:flex;flex-direction:column;gap:6px;"></div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          <input id="hello-tx-id" placeholder="TxID" style="padding:6px;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:6px;">
          <input id="hello-tx-date" placeholder="Date" style="padding:6px;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:6px;">
          <input id="hello-tx-amount" placeholder="Amount BTC" style="padding:6px;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:6px;">
          <input id="hello-tx-type" placeholder="Type (Sent/Received)" style="padding:6px;background:#1a1a1a;color:#eaeaea;border:1px solid #2a2a2a;border-radius:6px;">
          <button id="hello-add-tx" style="margin-top:6px;background:#2b8a3e;border:0;color:white;border-radius:6px;padding:8px;cursor:pointer;">Add Fake TX</button>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
          <button id="hello-cancel" style="background:#1f1f1f;border:1px solid #2a2a2a;color:#eaeaea;border-radius:8px;padding:8px 14px;cursor:pointer;">Cancel</button>
          <button id="hello-save" style="background:#2b8a3e;border:0;color:white;border-radius:8px;padding:8px 14px;cursor:pointer;">Save</button>
        </div>
      </div>`;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // fill tx list
    const txListEl = modal.querySelector('#hello-tx-list');
    if (JSE_CONFIG.transactions.length === 0) {
      txListEl.innerHTML = `<div style="opacity:.6;font-size:12px;">No fake TXs yet</div>`;
    } else {
      JSE_CONFIG.transactions.forEach((tx,i) => {
        const row = document.createElement('div');
        row.style.fontSize = "12px";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.innerHTML = `<span>${tx.type} • ${tx.amount} BTC • ${tx.date}</span>
                         <button data-i="${i}" style="background:#a33;border:0;color:white;border-radius:4px;padding:2px 6px;cursor:pointer;">X</button>`;
        txListEl.appendChild(row);
      });
      txListEl.querySelectorAll('button').forEach(btn=>{
        btn.onclick = ()=>{
          const idx = parseInt(btn.getAttribute('data-i'));
          JSE_CONFIG.transactions.splice(idx,1);
          sset('hello_transactions', JSE_CONFIG.transactions);
          openGUI();
          applyFakeTransactions();
        };
      });
    }

    modal.querySelector('#hello-close').onclick = closeGUI;
    modal.querySelector('#hello-cancel').onclick = closeGUI;
    modal.querySelector('#hello-save').onclick = () => {
      JSE_CONFIG.enabled = modal.querySelector('#hello-enabled').checked;
      JSE_CONFIG.bitcoin.wholeBTC = modal.querySelector('#hello-btc').value.trim();
      JSE_CONFIG.bitcoin.wholeUSD = modal.querySelector('#hello-usd').value.trim();
      JSE_CONFIG.bitcoin.partialUSD = modal.querySelector('#hello-usd-part').value.trim();
      sset('hello_enabled', JSE_CONFIG.enabled);
      sset('hello_wholeBTC', JSE_CONFIG.bitcoin.wholeBTC);
      sset('hello_wholeUSD', JSE_CONFIG.bitcoin.wholeUSD);
      sset('hello_partialUSD', JSE_CONFIG.bitcoin.partialUSD);
      closeGUI();
      safeUpdate();
    };

    modal.querySelector('#hello-enabled').checked = JSE_CONFIG.enabled;
    modal.querySelector('#hello-add-tx').onclick = () => {
      const id = modal.querySelector('#hello-tx-id').value.trim();
      const date = modal.querySelector('#hello-tx-date').value.trim();
      const amt = modal.querySelector('#hello-tx-amount').value.trim();
      const type = modal.querySelector('#hello-tx-type').value.trim();
      if (id && date && amt && type) {
        addFakeTransaction(id,date,amt,type);
        openGUI();
      }
    };
  }

  // -------- Hotkeys --------
  function handleHotkeys(e) {
    if (e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      openGUI();
    }
    if (e.shiftKey && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      JSE_CONFIG.enabled = !JSE_CONFIG.enabled;
      sset('hello_enabled', JSE_CONFIG.enabled);
      safeUpdate();
    }
  }
  window.addEventListener('keydown', handleHotkeys, true);
  document.addEventListener('keydown', handleHotkeys, true);

})();

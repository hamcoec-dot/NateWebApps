/**
 * HCEC Purchase Order Form — app.js
 * Zero-server, localStorage-based. No dependencies.
 * Architecture: Data layer → UI helpers → Form → Modals → Wiring
 */

'use strict';

/* ============================================================
   1. DATA LAYER — localStorage CRUD
   ============================================================ */

const DB_KEYS = {
  vendors:  'po_vendors',
  shiptos:  'po_shiptos',
  clerks:   'po_clerks',
  orders:   'po_orders',
  sequence: 'po_seq',
};

function dbGet(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function dbSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getVendors()  { return dbGet(DB_KEYS.vendors)  || []; }
function getShipTos()  { return dbGet(DB_KEYS.shiptos)  || []; }
function getClerks()   { return dbGet(DB_KEYS.clerks)   || []; }
function getOrders()   { return dbGet(DB_KEYS.orders)   || []; }

function saveVendors(v)  { dbSet(DB_KEYS.vendors, v); pushToSyncServer(); }
function saveShipTos(s)  { dbSet(DB_KEYS.shiptos, s); pushToSyncServer(); }
function saveClerks(c)   { dbSet(DB_KEYS.clerks, c); pushToSyncServer(); }
function saveOrders(o)   { dbSet(DB_KEYS.orders, o); pushToSyncServer(); }

/** Generate next PO number: YYYYMMDD-NNN (resets per day, dynamic and collision-free) */
function nextPONumber() {
  const today = new Date();
  const datePart = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');

  // Scan all orders (both local and synced) to find the highest sequence number for today
  const orders = getOrders();
  let maxSeq = 0;
  orders.forEach(o => {
    if (o.poNumber && o.poNumber.startsWith(datePart + '-')) {
      const parts = o.poNumber.split('-');
      if (parts.length >= 2) {
        const seqNum = parseInt(parts[1], 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }
  });

  const n = maxSeq + 1;
  return `${datePart}-${String(n).padStart(3, '0')}`;
}


function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ============================================================
   2. SEED DATA (from Purchase Request.xlsx)
   ============================================================ */

function migratePII() {
  const migratedKey = 'po_pii_migrated_v1';
  if (localStorage.getItem(migratedKey)) return;

  // Cleanup vendors matching original PII defaults
  let vendors = getVendors();
  vendors = vendors.filter(v => {
    const isDefault = 
      (v.name === "Sam's Club" && v.addr === "6101 Lee Highway") ||
      (v.name === "Amazon" && v.addr === "7200 Discovery Dr") ||
      (v.name === "DivcoData" && v.addr === "") ||
      (v.name === "Staples Business" && v.addr === "3721 Powers Court") ||
      (v.name === "Marco Promos" && v.addr === "2640 Commerce Drive");
    return !isDefault;
  });
  dbSet(DB_KEYS.vendors, vendors);

  // Cleanup shiptos matching original PII defaults
  let shiptos = getShipTos();
  shiptos = shiptos.filter(s => {
    const isDefault = 
      (s.name === "Bill Adams" && s.org === "HCEC") ||
      (s.name === "Nathan Foster" && s.org === "HCEC") ||
      (s.name === "Sara Goodrich" && s.org === "Hamilton County Election Commission") ||
      (s.name === "Sherri Sivley" && s.org === "HCEC");
    return !isDefault;
  });
  dbSet(DB_KEYS.shiptos, shiptos);

  // Cleanup clerks matching original PII defaults
  let clerks = getClerks();
  const defaultClerkNames = ["Kristi Berry", "Bill Adams", "Nathan Foster", "Sherri Sivley"];
  clerks = clerks.filter(c => !defaultClerkNames.includes(c.name));
  dbSet(DB_KEYS.clerks, clerks);

  localStorage.setItem(migratedKey, 'true');
}

function seedIfEmpty() {
  // Rely strictly on local storage or sync data. No hardcoded default seed data.
}

/* ============================================================
   3. FORMAT HELPERS
   ============================================================ */

function fmt(n) {
  return '$' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * linkify(text) — converts plain-text URLs to <a> tags.
 * XSS-safe: escapes all HTML first, then only inserts controlled <a> markup.
 * Matches http, https, and ftp URLs.
 */
function linkify(text) {
  if (!text) return '';
  // Escape HTML entities first to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  
  // Match URLs starting with protocol (http/https/ftp)
  let linkified = escaped.replace(
    /(https?:\/\/|ftp:\/\/)[^\s<>"'\)\]]+/g,
    url => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="linkified">${url}</a>`
  );

  // Match URLs starting with "www." that were not already caught by the protocol match
  linkified = linkified.replace(
    /(^|[^\/"'])(www\.[^\s<>"'\)\]]+)/g,
    (match, p1, p2) => `${p1}<a href="https://${p2}" target="_blank" rel="noopener noreferrer" class="linkified">${p2}</a>`
  );

  return linkified;
}

function todayISO() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}

/* ============================================================
   4. DOM SHORTCUTS
   ============================================================ */

const $ = id => document.getElementById(id);
const make = tag => document.createElement(tag);

/* ============================================================
   5. STATUS BAR
   ============================================================ */

let statusTimer = null;
function showStatus(msg, type = 'ok') {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar visible' + (type !== 'ok' ? ' ' + type : '');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    bar.className = 'status-bar';
  }, 3000);
}

/* ============================================================
   6. MODAL MANAGER
   ============================================================ */

function openModal(id) {
  const m = $(id);
  if (!m) return;
  m.showModal ? m.showModal() : m.setAttribute('open', '');
  $('modal-backdrop').classList.add('active');
  $('modal-backdrop').setAttribute('aria-hidden', 'false');
}
function closeModal(id) {
  const m = $(id);
  if (!m) return;
  m.close ? m.close() : m.removeAttribute('open');
  // Only hide backdrop if no other modal open
  if (!document.querySelector('dialog[open]')) {
    $('modal-backdrop').classList.remove('active');
    $('modal-backdrop').setAttribute('aria-hidden', 'true');
  }
}
function closeAllModals() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close ? d.close() : d.removeAttribute('open'));
  $('modal-backdrop').classList.remove('active');
}

/* ============================================================
   7. LINE ITEMS
   ============================================================ */

let lineItems = []; // [{ id, itemNo, desc, qty, price }]

function createLineItem(data = {}) {
  return {
    id:     uid(),
    itemNo: data.itemNo || '',
    desc:   data.desc   || '',
    qty:    data.qty    !== undefined ? data.qty   : '',
    price:  data.price  !== undefined ? data.price : '',
  };
}

function lineTotal(item) {
  const q = parseFloat(item.qty)   || 0;
  const p = parseFloat(item.price) || 0;
  return q * p;
}

function renderLineItems() {
  const tbody = $('items-body');
  tbody.innerHTML = '';
  lineItems.forEach(item => tbody.appendChild(buildRow(item)));
  recalcTotals();
}

function buildRow(item) {
  const tr = make('tr');
  tr.dataset.id = item.id;

  // Helper: create a cell with an input
  const cell = (colClass, inputClass, type, value, placeholder, ariaLabel) => {
    const td = make('td');
    td.className = colClass || '';
    const inp = make('input');
    inp.type = type || 'text';
    inp.value = value || '';
    inp.placeholder = placeholder || '';
    inp.className = 'cell-input' + (inputClass ? ' ' + inputClass : '');
    inp.setAttribute('aria-label', ariaLabel || '');
    inp.addEventListener('input', () => {
      const field = inp.dataset.field;
      const row = lineItems.find(r => r.id === item.id);
      if (row) {
        row[field] = inp.value;
        if (field === 'qty' || field === 'price') {
          updateRowTotal(item.id);
          recalcTotals();
        }
      }
    });
    inp.dataset.field = ariaLabel.split(' ')[0].toLowerCase() === 'item' ? 'itemNo'
                      : ariaLabel.split(' ')[0].toLowerCase() === 'description' ? 'desc'
                      : ariaLabel.split(' ')[0].toLowerCase() === 'quantity' ? 'qty'
                      : ariaLabel.split(' ')[0].toLowerCase() === 'unit' ? 'price'
                      : '';
    td.appendChild(inp);
    return td;
  };

  tr.appendChild(cell('col-item', '',          'text',   item.itemNo, '',        'Item number'));

  // Description cell: input for editing + interactive preview + print-only span
  const tdDesc = make('td');
  tdDesc.className = 'col-desc';

  const descInp = make('input');
  descInp.type = 'text';
  descInp.value = item.desc || '';
  descInp.className = 'cell-input desc-edit-input';
  descInp.setAttribute('aria-label', 'Description');
  descInp.dataset.field = 'desc';

  const descPreview = make('div');
  descPreview.className = 'desc-preview';
  descPreview.tabIndex = 0;
  descPreview.setAttribute('aria-label', 'Description preview, press Enter or click to edit');
  descPreview.innerHTML = linkify(item.desc || '');

  const descPrint = make('span');
  descPrint.className = 'desc-print-view';
  descPrint.innerHTML = linkify(item.desc || '');
  descPrint.setAttribute('aria-hidden', 'true');

  const startEdit = () => {
    tdDesc.classList.add('editing');
    descInp.focus();
  };

  const endEdit = () => {
    setTimeout(() => {
      if (document.activeElement !== descInp) {
        tdDesc.classList.remove('editing');
        descPreview.innerHTML = linkify(descInp.value || '');
        descPrint.innerHTML = linkify(descInp.value || '');
      }
    }, 120);
  };

  descPreview.addEventListener('click', e => {
    if (e.target.tagName.toLowerCase() !== 'a') {
      startEdit();
    }
  });

  descPreview.addEventListener('focus', startEdit);
  descPreview.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEdit();
    }
  });

  descInp.addEventListener('blur', endEdit);
  descInp.addEventListener('input', () => {
    const row = lineItems.find(r => r.id === item.id);
    if (row) {
      row.desc = descInp.value;
    }
  });
  
  descInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      descInp.blur();
    }
  });

  tdDesc.appendChild(descInp);
  tdDesc.appendChild(descPreview);
  tdDesc.appendChild(descPrint);
  tr.appendChild(tdDesc);

  tr.appendChild(cell('col-qty',  'text-right','number', item.qty,    '0',       'Quantity'));
  tr.appendChild(cell('col-price','text-right','number', item.price,  '0.00',    'Unit price'));

  // Total cell
  const tdTotal = make('td');
  tdTotal.className = 'cell-total';
  tdTotal.id = 'row-total-' + item.id;
  tdTotal.textContent = fmt(lineTotal(item));
  tr.appendChild(tdTotal);

  // Delete button
  const tdAction = make('td');
  tdAction.className = 'col-action no-print';
  const btnDel = make('button');
  btnDel.type = 'button';
  btnDel.className = 'btn-delete-row';
  btnDel.setAttribute('aria-label', 'Delete this line item');
  btnDel.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>`;
  btnDel.addEventListener('click', () => {
    lineItems = lineItems.filter(r => r.id !== item.id);
    renderLineItems();
  });
  tdAction.appendChild(btnDel);
  tr.appendChild(tdAction);

  return tr;
}

function updateRowTotal(id) {
  const item = lineItems.find(r => r.id === id);
  if (!item) return;
  const cell = $('row-total-' + id);
  if (cell) cell.textContent = fmt(lineTotal(item));
}

function recalcTotals() {
  const subtotal = lineItems.reduce((sum, r) => sum + lineTotal(r), 0);
  $('t-subtotal').textContent = fmt(subtotal);
  updateGrandTotal(subtotal);
}

function updateGrandTotal(subtotal) {
  if (subtotal === undefined) {
    subtotal = lineItems.reduce((sum, r) => sum + lineTotal(r), 0);
  }
  const tax   = parseFloat($('t-tax-input').value)   || 0;
  const other = parseFloat($('t-other-input').value) || 0;
  $('t-grand').textContent = fmt(subtotal + tax + other);
}

/* ============================================================
   8. VENDOR DROPDOWN AUTO-FILL
   ============================================================ */

function populateVendorSelect(selectedId = '') {
  const sel = $('vendor-select');
  const list = getVendors();
  if (list.length === 0) {
    sel.innerHTML = '<option value="">— No Vendors Found (Add via Vendors menu) —</option>';
  } else {
    sel.innerHTML = '<option value="">— Select Vendor —</option>';
    list.forEach(v => {
      const opt = make('option');
      opt.value = v.id;
      opt.textContent = v.name;
      if (v.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function populateShipToSelect(selectedId = '') {
  const sel = $('shipto-select');
  const list = getShipTos();
  if (list.length === 0) {
    sel.innerHTML = '<option value="">— No Ship-To Locations Found (Add via Ship-To menu) —</option>';
  } else {
    sel.innerHTML = '<option value="">— Select Ship-To —</option>';
    list.forEach(s => {
      const opt = make('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function populateClerkSelect(selectedName = '') {
  const sel = $('po-requested-by');
  const list = getClerks();
  if (list.length === 0) {
    sel.innerHTML = '<option value="">— No Clerks Found (Add via Clerks menu) —</option>';
  } else {
    sel.innerHTML = '<option value="">— Select Clerk —</option>';
    list.forEach(c => {
      const opt = make('option');
      opt.value = c.name;
      opt.textContent = c.name;
      if (c.name === selectedName) opt.selected = true;
      sel.appendChild(opt);
    });
  }
}

function fillVendorAddress(vendorId) {
  const v = getVendors().find(x => x.id === vendorId);
  $('v-name').textContent  = v ? v.name  : '';
  $('v-addr').textContent  = v ? v.addr  : '';
  $('v-city').textContent  = v ? v.city  : '';
  $('v-phone').textContent = v ? v.phone : '';
  $('v-other').textContent = v ? v.other : '';
}

function fillShipToAddress(shipToId) {
  const s = getShipTos().find(x => x.id === shipToId);
  $('s-name').textContent  = s ? s.name  : '';
  $('s-line1').textContent = s ? s.addr  : '';
  $('s-org').textContent   = s ? s.org   : '';
  $('s-city').textContent  = s ? s.city  : '';
  $('s-phone').textContent = s ? s.phone : '';
}

/* ============================================================
   9. FORM STATE — COLLECT / LOAD
   ============================================================ */

function collectForm() {
  return {
    poNumber:    $('po-number').value,
    poDate:      $('po-date').value,
    requestedBy: $('po-requested-by').value,
    vendorId:    $('vendor-select').value,
    shipToId:    $('shipto-select').value,
    lineItems:   lineItems.map(r => ({ ...r })),
    tax:         parseFloat($('t-tax-input').value)   || 0,
    other:       parseFloat($('t-other-input').value) || 0,
    comments:    $('po-comments').value,
    salesRep:    $('po-salesrep').value,
    savedAt:     new Date().toISOString(),
  };
}

/** Helper to toggle lock state on form inputs, selects, textareas, and buttons */
function setFormReadOnly(isReadOnly) {
  const form = $('po-form');
  if (!form) return;

  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(el => {
    if (el.id === 'po-number') return; // PO number is always readonly
    if (isReadOnly) {
      el.setAttribute('disabled', 'true');
    } else {
      el.removeAttribute('disabled');
    }
  });

  const deleteBtns = form.querySelectorAll('.btn-delete-row');
  deleteBtns.forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : 'flex';
  });

  const addLineBtn = $('btn-add-row');
  if (addLineBtn) {
    addLineBtn.style.display = isReadOnly ? 'none' : 'flex';
  }

  const saveDraftBtn = $('btn-save-draft');
  if (saveDraftBtn) {
    saveDraftBtn.style.display = isReadOnly ? 'none' : 'block';
  }

  const colDescs = form.querySelectorAll('.col-desc');
  colDescs.forEach(col => {
    const preview = col.querySelector('.desc-preview');
    if (isReadOnly) {
      col.classList.remove('editing');
      if (preview) preview.removeAttribute('tabindex');
    } else {
      if (preview) preview.setAttribute('tabindex', '0');
    }
  });

  const commentsContainer = $('comments-container');
  if (commentsContainer) {
    const preview = $('comments-preview');
    if (isReadOnly) {
      commentsContainer.classList.remove('editing');
      if (preview) preview.removeAttribute('tabindex');
    } else {
      if (preview) preview.setAttribute('tabindex', '0');
    }
  }
}

function loadForm(order) {
  $('po-number').value  = order.poNumber    || '';
  $('po-date').value    = order.poDate      || todayISO();
  $('t-tax-input').value   = order.tax      || 0;
  $('t-other-input').value = order.other    || 0;
  $('po-comments').value   = order.comments || '';
  $('po-salesrep').value   = order.salesRep || '';

  const commentsContainer = $('comments-container');
  if (commentsContainer) {
    commentsContainer.classList.remove('editing');
    const commentsPreview = $('comments-preview');
    if (commentsPreview) {
      commentsPreview.innerHTML = linkify(order.comments || '');
    }
  }

  populateClerkSelect(order.requestedBy);
  populateVendorSelect(order.vendorId);
  populateShipToSelect(order.shipToId);
  fillVendorAddress(order.vendorId);
  fillShipToAddress(order.shipToId);

  lineItems = (order.lineItems || []).map(r => ({ ...r }));
  if (lineItems.length === 0) lineItems = [createLineItem()];
  renderLineItems();
  recalcTotals();
  updateGrandTotal();

  if (order.poNumber) {
    localStorage.setItem('po_active_num', order.poNumber);
  }

  // Handle read-only locks and dynamic status badge
  const isCompleted = order.status === 'completed';
  const badge = $('po-status-badge');
  if (badge) {
    badge.style.display = isCompleted ? 'inline-flex' : 'none';
  }
  setFormReadOnly(isCompleted);
}

/* ============================================================
   10. NEW ORDER
   ============================================================ */

function newOrder() {
  const poNum = nextPONumber();
  $('po-number').value = poNum;
  $('po-date').value   = todayISO();
  $('t-tax-input').value   = 0;
  $('t-other-input').value = 0;
  $('po-comments').value = '';
  $('po-salesrep').value = '';

  const commentsContainer = $('comments-container');
  if (commentsContainer) {
    commentsContainer.classList.remove('editing');
    const commentsPreview = $('comments-preview');
    if (commentsPreview) {
      commentsPreview.innerHTML = '';
    }
  }

  populateClerkSelect();
  populateVendorSelect();
  populateShipToSelect();
  fillVendorAddress('');
  fillShipToAddress('');
  lineItems = [createLineItem(), createLineItem(), createLineItem()];
  renderLineItems();
  recalcTotals();
  showStatus(`New order ${poNum} started`, 'ok');

  const badge = $('po-status-badge');
  if (badge) {
    badge.style.display = 'none';
  }
  setFormReadOnly(false);

  localStorage.setItem('po_active_num', poNum);
}

/* ============================================================
   11. SAVE / LOAD DRAFTS
   ============================================================ */

function saveDraft() {
  const order = collectForm();
  if (!order.poNumber) { showStatus('Order has no PO number — cannot save.', 'warn'); return; }
  const orders = getOrders();
  const idx = orders.findIndex(o => o.poNumber === order.poNumber);
  if (idx >= 0) orders[idx] = order; else orders.unshift(order);
  saveOrders(orders);
  showStatus(`Draft ${order.poNumber} saved!`);
}

function renderDraftsList() {
  const list = $('drafts-list');
  const orders = getOrders().filter(o => o.status !== 'completed');
  if (orders.length === 0) {
    list.innerHTML = '<p class="empty-state">No saved drafts yet.</p>';
    return;
  }
  list.innerHTML = '';
  orders.forEach(order => {
    const vendors = getVendors();
    const vendor = vendors.find(v => v.id === order.vendorId);
    const div = make('div');
    div.className = 'draft-item';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Load draft ${order.poNumber}`);
    div.innerHTML = `
      <div>
        <div class="draft-po">${order.poNumber}</div>
        <div class="draft-vendor">${vendor ? vendor.name : '(No vendor)'}</div>
        <div class="draft-meta">${order.requestedBy || 'Unknown clerk'} · ${order.poDate || ''}</div>
      </div>
      <div class="draft-actions">
        <button class="btn-edit" data-po="${order.poNumber}" aria-label="Load draft ${order.poNumber}">Load</button>
        <button class="btn-delete" data-po="${order.poNumber}" aria-label="Delete draft ${order.poNumber}">Delete</button>
      </div>`;
    list.appendChild(div);

    div.querySelector('.btn-edit').addEventListener('click', e => {
      e.stopPropagation();
      loadForm(order);
      closeModal('modal-drafts');
      showStatus(`Loaded draft ${order.poNumber}`);
    });
    div.querySelector('.btn-delete').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete draft ${order.poNumber}?`)) return;
      const updated = getOrders().filter(o => o.poNumber !== order.poNumber);
      saveOrders(updated);
      renderDraftsList();
      showStatus(`Draft ${order.poNumber} deleted`, 'warn');
      if (localStorage.getItem('po_active_num') === order.poNumber) {
        newOrder();
      }
    });
    div.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') div.querySelector('.btn-edit').click();
    });
  });
}

/* ============================================================
   12. VENDOR MANAGER MODAL
   ============================================================ */

function renderVendorsList() {
  const list = $('vendors-list');
  const vendors = getVendors();
  list.innerHTML = vendors.length ? '' : '<p class="empty-state">No vendors yet.</p>';
  vendors.forEach(v => {
    const div = make('div');
    div.className = 'record-item';
    div.innerHTML = `
      <div class="record-item-info">
        <div class="record-item-name">${v.name}</div>
        <div class="record-item-sub">${[v.addr, v.city, v.phone].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="record-item-actions">
        <button class="btn-edit" aria-label="Edit vendor ${v.name}">Edit</button>
        <button class="btn-delete" aria-label="Delete vendor ${v.name}">Delete</button>
      </div>`;
    div.querySelector('.btn-edit').addEventListener('click', () => startVendorEdit(v));
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Delete vendor "${v.name}"?`)) return;
      saveVendors(getVendors().filter(x => x.id !== v.id));
      renderVendorsList();
      populateVendorSelect();
      showStatus(`Vendor "${v.name}" deleted`, 'warn');
    });
    list.appendChild(div);
  });
}

function startVendorEdit(v) {
  $('vendor-edit-id').value = v.id;
  $('vf-name').value  = v.name  || '';
  $('vf-addr').value  = v.addr  || '';
  $('vf-city').value  = v.city  || '';
  $('vf-phone').value = v.phone || '';
  $('vf-other').value = v.other || '';
  $('vendor-save-btn').textContent = 'Update Vendor';
  $('vf-name').focus();
}

function clearVendorForm() {
  $('vendor-edit-id').value = '';
  $('vendor-form').reset();
  $('vendor-save-btn').textContent = 'Save Vendor';
}

$('vendor-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('vf-name').value.trim();
  if (!name) { $('vf-name').focus(); return; }
  const editId = $('vendor-edit-id').value;
  const vendors = getVendors();
  const record = { id: editId || uid(), name, addr: $('vf-addr').value.trim(),
    city: $('vf-city').value.trim(), phone: $('vf-phone').value.trim(), other: $('vf-other').value.trim() };
  if (editId) {
    const idx = vendors.findIndex(v => v.id === editId);
    if (idx >= 0) vendors[idx] = record;
  } else {
    vendors.push(record);
  }
  saveVendors(vendors);
  clearVendorForm();
  renderVendorsList();
  populateVendorSelect($('vendor-select').value);
  showStatus(`Vendor "${name}" saved!`);
});
$('vendor-cancel-btn').addEventListener('click', clearVendorForm);

/* ============================================================
   13. SHIP-TO MANAGER MODAL
   ============================================================ */

function renderShipToList() {
  const list = $('shipto-list');
  const items = getShipTos();
  list.innerHTML = items.length ? '' : '<p class="empty-state">No ship-to locations yet.</p>';
  items.forEach(s => {
    const div = make('div');
    div.className = 'record-item';
    div.innerHTML = `
      <div class="record-item-info">
        <div class="record-item-name">${s.name}</div>
        <div class="record-item-sub">${[s.org, s.addr, s.city, s.phone].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="record-item-actions">
        <button class="btn-edit" aria-label="Edit ship-to ${s.name}">Edit</button>
        <button class="btn-delete" aria-label="Delete ship-to ${s.name}">Delete</button>
      </div>`;
    div.querySelector('.btn-edit').addEventListener('click', () => startShipToEdit(s));
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Delete ship-to "${s.name}"?`)) return;
      saveShipTos(getShipTos().filter(x => x.id !== s.id));
      renderShipToList();
      populateShipToSelect();
      showStatus(`Ship-to "${s.name}" deleted`, 'warn');
    });
    list.appendChild(div);
  });
}

function startShipToEdit(s) {
  $('shipto-edit-id').value = s.id;
  $('sf-name').value  = s.name  || '';
  $('sf-org').value   = s.org   || '';
  $('sf-addr').value  = s.addr  || '';
  $('sf-city').value  = s.city  || '';
  $('sf-phone').value = s.phone || '';
  $('shipto-save-btn').textContent = 'Update Location';
  $('sf-name').focus();
}

function clearShipToForm() {
  $('shipto-edit-id').value = '';
  $('shipto-form').reset();
  $('shipto-save-btn').textContent = 'Save Location';
}

$('shipto-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('sf-name').value.trim();
  if (!name) { $('sf-name').focus(); return; }
  const editId = $('shipto-edit-id').value;
  const items = getShipTos();
  const record = { id: editId || uid(), name, org: $('sf-org').value.trim(),
    addr: $('sf-addr').value.trim(), city: $('sf-city').value.trim(), phone: $('sf-phone').value.trim() };
  if (editId) {
    const idx = items.findIndex(s => s.id === editId);
    if (idx >= 0) items[idx] = record;
  } else {
    items.push(record);
  }
  saveShipTos(items);
  clearShipToForm();
  renderShipToList();
  populateShipToSelect($('shipto-select').value);
  showStatus(`Ship-to "${name}" saved!`);
});
$('shipto-cancel-btn').addEventListener('click', clearShipToForm);

/* ============================================================
   14. CLERKS MANAGER MODAL
   ============================================================ */

function renderClerksList() {
  const list = $('clerks-list');
  const clerks = getClerks();
  list.innerHTML = clerks.length ? '' : '<p class="empty-state">No clerks yet.</p>';
  clerks.forEach(c => {
    const div = make('div');
    div.className = 'record-item';
    div.innerHTML = `
      <div class="record-item-info">
        <div class="record-item-name">${c.name}</div>
      </div>
      <div class="record-item-actions">
        <button class="btn-delete" aria-label="Remove clerk ${c.name}">Remove</button>
      </div>`;
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Remove clerk "${c.name}"?`)) return;
      saveClerks(getClerks().filter(x => x.id !== c.id));
      renderClerksList();
      populateClerkSelect($('po-requested-by').value);
      showStatus(`Clerk "${c.name}" removed`, 'warn');
    });
    list.appendChild(div);
  });
}

$('clerk-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('cf-name').value.trim();
  if (!name) { $('cf-name').focus(); return; }
  const clerks = getClerks();
  if (clerks.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showStatus(`Clerk "${name}" already exists`, 'warn'); return;
  }
  clerks.push({ id: uid(), name });
  saveClerks(clerks);
  $('clerk-form').reset();
  renderClerksList();
  populateClerkSelect(name);
  showStatus(`Clerk "${name}" added!`);
});

/* ============================================================
   14b. LAN & CLOUD DATABASE SYNCHRONIZATION API
   ============================================================ */

let syncProvider = localStorage.getItem('po_sync_provider') || 'cloud';
let syncGistId = localStorage.getItem('po_sync_gist_id') || '';
let syncGistToken = localStorage.getItem('po_sync_gist_token') || '';
let syncUrl = localStorage.getItem('po_sync_url') || '';
let syncState = 'disconnected'; // 'connected' | 'offline' | 'disconnected'

function updateSyncUI() {
  const btn = $('btn-sync');
  const txt = $('sync-status-text');
  const statusInfo = $('sync-connection-status');
  
  const gistIdInput = $('sync-gist-id');
  const gistTokenInput = $('sync-gist-token');
  const urlInput = $('sync-url-input');
  
  const secCloud = $('sync-section-cloud');
  const secLan = $('sync-section-lan');
  
  const btnCloud = $('sync-mode-cloud');
  const btnLan = $('sync-mode-lan');

  // Toggle visible sections based on provider
  if (syncProvider === 'cloud') {
    if (secCloud) secCloud.style.display = 'block';
    if (secLan) secLan.style.display = 'none';
    if (btnCloud) btnCloud.classList.add('active');
    if (btnLan) btnLan.classList.remove('active');
  } else {
    if (secCloud) secCloud.style.display = 'none';
    if (secLan) secLan.style.display = 'block';
    if (btnCloud) btnCloud.classList.remove('active');
    if (btnLan) btnLan.classList.add('active');
  }

  // Security Masking in inputs: do not output raw secret keys as value, use placeholder
  if (gistIdInput) {
    gistIdInput.value = '';
    if (syncGistId) {
      gistIdInput.placeholder = syncGistId.slice(0, 12) + '...' + syncGistId.slice(-4);
    } else {
      gistIdInput.placeholder = 'Enter Secret Gist ID';
    }
    gistIdInput.dataset.changed = 'false';
  }
  if (gistTokenInput) {
    gistTokenInput.value = '';
    if (syncGistToken) {
      gistTokenInput.placeholder = '••••••••';
    } else {
      gistTokenInput.placeholder = 'Enter GitHub PAT (ghp_...)';
    }
    gistTokenInput.dataset.changed = 'false';
  }
  if (urlInput) {
    urlInput.value = syncUrl;
  }

  const displayId = $('sync-gist-display');
  if (displayId) {
    if (syncProvider === 'cloud') {
      displayId.textContent = syncGistId 
        ? (syncGistId.slice(0, 12) + '...' + syncGistId.slice(-4)) 
        : 'Not Configured';
    } else {
      displayId.textContent = syncUrl ? 'LAN Server Active' : 'Not Configured';
    }
  }

  const activeTarget = (syncProvider === 'cloud') ? syncGistId : syncUrl;

  if (!activeTarget) {
    syncState = 'disconnected';
    if (btn) btn.className = 'nav-btn nav-btn--sync';
    if (txt) txt.textContent = 'Local Only';
    if (statusInfo) {
      statusInfo.textContent = 'Status: Not Configured (Offline Fallback active)';
      statusInfo.style.color = 'var(--c-text-muted)';
    }
    return;
  }

  if (syncState === 'connected') {
    if (btn) btn.className = 'nav-btn nav-btn--sync connected';
    if (txt) txt.textContent = 'Sync: Active';
    if (statusInfo) {
      statusInfo.textContent = syncProvider === 'cloud' 
        ? 'Status: Connected to Secret GitHub Gist' 
        : 'Status: Connected to LAN Sync Server';
      statusInfo.style.color = 'var(--c-success)';
    }
  } else if (syncState === 'offline') {
    if (btn) btn.className = 'nav-btn nav-btn--sync offline';
    if (txt) txt.textContent = 'Sync: Offline';
    if (statusInfo) {
      statusInfo.textContent = 'Connection failed, please contact your administrator.';
      statusInfo.style.color = '#ef4444';
    }
  }
}

async function testSyncConnection() {
  if (syncProvider === 'cloud') {
    const inputGistId = $('sync-gist-id');
    const inputGistToken = $('sync-gist-token');
    
    let gistId = inputGistId ? inputGistId.value.trim() : '';
    if (gistId === '') {
      if (inputGistId && inputGistId.dataset.changed === 'true') {
        gistId = '';
      } else {
        gistId = syncGistId;
      }
    }
    
    let token = inputGistToken ? inputGistToken.value.trim() : '';
    if (token === '') {
      if (inputGistToken && inputGistToken.dataset.changed === 'true') {
        token = '';
      } else {
        token = syncGistToken;
      }
    }
    
    if (!gistId) return { success: false, message: 'Connection failed, please contact your administrator.' };
    
    try {
      const headers = {
        'Accept': 'application/vnd.github+json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'GET',
        headers: headers,
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        const hasDbFile = data.files && data.files['hcec_po_db.json'];
        if (hasDbFile) {
          return { success: true, message: 'GitHub connection successful! Database found.' };
        } else {
          return { success: true, message: 'GitHub Gist accessible, but database file hcec_po_db.json not found yet.' };
        }
      }
      return { success: false, message: 'Connection failed, please contact your administrator.' };
    } catch (err) {
      console.error('Test connection failed:', err);
      return { success: false, message: 'Connection failed, please contact your administrator.' };
    }
  } else {
    const valInput = $('sync-url-input');
    const val = valInput ? valInput.value.trim() : '';
    if (!val) return { success: false, message: 'Connection failed, please contact your administrator.' };
    try {
      const url = val.replace(/\/$/, '');
      const res = await fetch(`${url}/api/data`, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        return { success: true, message: 'LAN server connection successful!' };
      }
      return { success: false, message: 'Connection failed, please contact your administrator.' };
    } catch {
      return { success: false, message: 'Connection failed, please contact your administrator.' };
    }
  }
}

// createSyncKey removed

async function pullFromSyncServer(bootstrapIfEmpty = false) {
  if (syncProvider === 'cloud') {
    if (!syncGistId) return false;
    try {
      const headers = {
        'Accept': 'application/vnd.github+json',
      };
      if (syncGistToken) {
        headers['Authorization'] = `Bearer ${syncGistToken}`;
      }
      const res = await fetch(`https://api.github.com/gists/${syncGistId}`, {
        method: 'GET',
        headers: headers,
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`GitHub Gist API error (Status ${res.status})`);
      const gistData = await res.json();
      
      const gistFile = gistData.files && gistData.files['hcec_po_db.json'];
      if (!gistFile) {
        // Gist doesn't have our file yet
        if (bootstrapIfEmpty) {
          console.log('Gist database file not found. Bootstrapping with local data...');
          await pushToSyncServer();
          return true;
        }
        throw new Error("hcec_po_db.json file not found in Gist");
      }
      
      // Attempt to parse the contents
      let data = {};
      try {
        data = JSON.parse(gistFile.content);
      } catch {
        // If content is plain string or malformed
        data = {};
      }
      
      syncState = 'connected';
      updateSyncUI();
      
      // Check if data is empty or welcome structure (correctly handles empty arrays)
      const cloudEmpty = !data || 
        ((!data.vendors || data.vendors.length === 0) &&
         (!data.shiptos || data.shiptos.length === 0) &&
         (!data.clerks || data.clerks.length === 0) &&
         (!data.orders || data.orders.length === 0));
      
      if (cloudEmpty && bootstrapIfEmpty) {
        console.log('Gist database is empty. Bootstrapping with local HCEC data...');
        await pushToSyncServer();
        return true;
      }
      
      let updatedAny = false;
      
      const localVendors = getVendors();
      if (data && data.vendors && (data.vendors.length > 0 || !localVendors || localVendors.length === 0)) {
        dbSet(DB_KEYS.vendors, data.vendors);
        updatedAny = true;
      }
      
      const localShipTos = getShipTos();
      if (data && data.shiptos && (data.shiptos.length > 0 || !localShipTos || localShipTos.length === 0)) {
        dbSet(DB_KEYS.shiptos, data.shiptos);
        updatedAny = true;
      }
      
      const localClerks = getClerks();
      if (data && data.clerks && (data.clerks.length > 0 || !localClerks || localClerks.length === 0)) {
        dbSet(DB_KEYS.clerks, data.clerks);
        updatedAny = true;
      }
      
      const localOrders = getOrders();
      if (data && data.orders && (data.orders.length > 0 || !localOrders || localOrders.length === 0)) {
        dbSet(DB_KEYS.orders, data.orders);
        updatedAny = true;
      }
      
      return updatedAny;
    } catch (err) {
      console.warn('Gist Pull failed. Fallback to cached local-only state:', err);
      syncState = 'offline';
      updateSyncUI();
      return false;
    }
  } else {
    if (!syncUrl) return false;
    try {
      const url = syncUrl.replace(/\/$/, '');
      const res = await fetch(`${url}/api/data`, { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error('LAN Server returned error status');
      const data = await res.json();
      
      syncState = 'connected';
      updateSyncUI();

      const serverEmpty = !data || 
        ((!data.vendors || data.vendors.length === 0) &&
         (!data.shiptos || data.shiptos.length === 0) &&
         (!data.clerks || data.clerks.length === 0) &&
         (!data.orders || data.orders.length === 0));
      
      if (serverEmpty && bootstrapIfEmpty) {
        console.log('LAN Sync Server is empty. Bootstrapping with local data...');
        await pushToSyncServer();
        return true;
      }

      let updatedAny = false;
      
      const localVendors = getVendors();
      if (data.vendors && (data.vendors.length > 0 || !localVendors || localVendors.length === 0)) {
        dbSet(DB_KEYS.vendors, data.vendors);
        updatedAny = true;
      }
      
      const localShipTos = getShipTos();
      if (data.shiptos && (data.shiptos.length > 0 || !localShipTos || localShipTos.length === 0)) {
        dbSet(DB_KEYS.shiptos, data.shiptos);
        updatedAny = true;
      }
      
      const localClerks = getClerks();
      if (data.clerks && (data.clerks.length > 0 || !localClerks || localClerks.length === 0)) {
        dbSet(DB_KEYS.clerks, data.clerks);
        updatedAny = true;
      }
      
      const localOrders = getOrders();
      if (data.orders && (data.orders.length > 0 || !localOrders || localOrders.length === 0)) {
        dbSet(DB_KEYS.orders, data.orders);
        updatedAny = true;
      }
      
      return updatedAny;
    } catch (err) {
      console.warn('LAN Pull failed. Fallback to cached local-only state:', err);
      syncState = 'offline';
      updateSyncUI();
      return false;
    }
  }
}

async function pushToSyncServer() {
  if (syncProvider === 'cloud') {
    if (!syncGistId) return false;
    if (!syncGistToken) {
      console.warn('Push ignored: No GitHub PAT configured for cloud sync.');
      syncState = 'offline';
      updateSyncUI();
      return false;
    }
    try {
      const body = {
        files: {
          "hcec_po_db.json": {
            "content": JSON.stringify({
              vendors: getVendors(),
              shiptos: getShipTos(),
              clerks: getClerks(),
              orders: getOrders(),
            }, null, 2)
          }
        }
      };
      
      const res = await fetch(`https://api.github.com/gists/${syncGistId}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${syncGistToken}`
        },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) throw new Error(`GitHub save endpoint failed with status ${res.status}`);
      syncState = 'connected';
      updateSyncUI();
      return true;
    } catch (err) {
      console.warn('Gist Push failed. Cached locally:', err);
      syncState = 'offline';
      updateSyncUI();
      return false;
    }
  } else {
    if (!syncUrl) return false;
    try {
      const url = syncUrl.replace(/\/$/, '');
      const body = {
        vendors: getVendors(),
        shiptos: getShipTos(),
        clerks: getClerks(),
        orders: getOrders(),
      };
      const res = await fetch(`${url}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Save endpoint failed');
      syncState = 'connected';
      updateSyncUI();
      return true;
    } catch (err) {
      console.warn('LAN Push failed. Cached locally:', err);
      syncState = 'offline';
      updateSyncUI();
      return false;
    }
  }
}

function setupCommentsToggles() {
  const container = $('comments-container');
  const area = $('po-comments');
  const preview = $('comments-preview');
  
  if (!container || !area || !preview) return;

  const startEdit = () => {
    container.classList.add('editing');
    area.focus();
  };

  const endEdit = () => {
    setTimeout(() => {
      if (document.activeElement !== area) {
        container.classList.remove('editing');
        preview.innerHTML = linkify(area.value || '');
      }
    }, 120);
  };

  preview.addEventListener('click', e => {
    if (e.target.tagName.toLowerCase() !== 'a') {
      startEdit();
    }
  });

  preview.addEventListener('focus', startEdit);
  preview.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEdit();
    }
  });

  area.addEventListener('blur', endEdit);
}

/* ============================================================
   15. BUTTON WIRING
   ============================================================ */

// Nav buttons
$('btn-new').addEventListener('click', () => {
  if (lineItems.length > 0 && lineItems.some(r => r.desc || r.itemNo)) {
    if (!confirm('Start a new order? Unsaved changes will be lost.')) return;
  }
  newOrder();
});

$('btn-orders').addEventListener('click', () => {
  renderDraftsList();
  openModal('modal-drafts');
});

$('btn-vendors').addEventListener('click', () => {
  renderVendorsList();
  clearVendorForm();
  openModal('modal-vendors');
});

$('btn-shipto').addEventListener('click', () => {
  renderShipToList();
  clearShipToForm();
  openModal('modal-shipto');
});

$('btn-clerks').addEventListener('click', () => {
  renderClerksList();
  openModal('modal-clerks');
});

$('btn-analytics').addEventListener('click', () => {
  renderAnalytics();
  openModal('modal-analytics');
});

// --- Analytics Modal Wiring (One-time persistent registration) ---
document.querySelectorAll('.toggle-btn[data-period]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn[data-period]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    const d2 = analyticsData(currentPeriod);
    drawChart(d2 ? d2.timeSeries : null);
  });
});

document.querySelectorAll('.toggle-btn[data-breakdown]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn[data-breakdown]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentBreakdown = btn.dataset.breakdown;
    renderBreakdown(currentBreakdown, analyticsData(currentPeriod));
  });
});

$('log-search').addEventListener('input', applyLogFilters);
$('log-filter-vendor').addEventListener('change', applyLogFilters);
$('log-filter-clerk').addEventListener('change', applyLogFilters);


$('btn-print').addEventListener('click', () => {
  saveDraft();
  window.print();
});

let commentsPrintDiv = null;
let originalTitle = '';

// Handle print preparation and restoration using standard browser events.
// This guarantees DOM modifications are active during PDF generation and
// works even if printing via system shortcuts (Ctrl+P / Cmd+P).
window.addEventListener('beforeprint', () => {
  // 1. Set dynamic print title for custom suggested PDF filename
  originalTitle = document.title;
  const poNum = $('po-number').value;
  if (poNum) {
    document.title = `HCEC Purchase Order - ${poNum}`;
  }

  // 2. Prepare comments layout for semantic print
  const commentsArea = $('po-comments');
  if (commentsArea) {
    const commentsBlock = commentsArea.closest('.comments-block');
    const rawText = commentsArea.value;
    if (rawText.trim()) {
      commentsPrintDiv = make('div');
      commentsPrintDiv.id = 'comments-print-view';
      commentsPrintDiv.className = 'comments-print-view';
      commentsPrintDiv.innerHTML = linkify(rawText);
      commentsBlock.insertBefore(commentsPrintDiv, commentsArea);
      commentsArea.classList.add('no-print');
    }
  }
});

window.addEventListener('afterprint', () => {
  // 1. Restore original document tab title
  if (originalTitle) {
    document.title = originalTitle;
  }

  // 2. Clean up comments block
  if (commentsPrintDiv) {
    commentsPrintDiv.remove();
    commentsPrintDiv = null;
  }
  const commentsArea = $('po-comments');
  if (commentsArea) {
    commentsArea.classList.remove('no-print');
  }
});

$('btn-save-draft').addEventListener('click', saveDraft);

// Sync status topbar button opens modal
if ($('btn-sync')) {
  $('btn-sync').addEventListener('click', () => {
    openModal('modal-sync');
    updateSyncUI();
  });
}

// Provider toggle: Cloud
if ($('sync-mode-cloud')) {
  $('sync-mode-cloud').addEventListener('click', () => {
    syncProvider = 'cloud';
    localStorage.setItem('po_sync_provider', 'cloud');
    updateSyncUI();
  });
}

// Provider toggle: LAN
if ($('sync-mode-lan')) {
  $('sync-mode-lan').addEventListener('click', () => {
    syncProvider = 'lan';
    localStorage.setItem('po_sync_provider', 'lan');
    updateSyncUI();
  });
}

// Input change listeners to track manual modifications
if ($('sync-gist-id')) {
  $('sync-gist-id').addEventListener('input', () => {
    $('sync-gist-id').dataset.changed = 'true';
  });
}
if ($('sync-gist-token')) {
  $('sync-gist-token').addEventListener('input', () => {
    $('sync-gist-token').dataset.changed = 'true';
  });
}

// Export Config
if ($('btn-export-config')) {
  $('btn-export-config').addEventListener('click', async () => {
    const gistIdInput = $('sync-gist-id');
    const gistTokenInput = $('sync-gist-token');
    const urlInput = $('sync-url-input');
    
    let gistId = gistIdInput ? gistIdInput.value.trim() : '';
    if (gistId === '') {
      if (gistIdInput && gistIdInput.dataset.changed === 'true') {
        gistId = '';
      } else {
        gistId = syncGistId;
      }
    }
    
    let gistToken = gistTokenInput ? gistTokenInput.value.trim() : '';
    if (gistToken === '') {
      if (gistTokenInput && gistTokenInput.dataset.changed === 'true') {
        gistToken = '';
      } else {
        gistToken = syncGistToken;
      }
    }
    
    const url = urlInput ? urlInput.value.trim() : '';
    
    const config = {
      syncProvider,
      syncGistId: gistId,
      syncGistToken: gistToken,
      syncUrl: url
    };
    
    try {
      const jsonStr = JSON.stringify(config);
      const b64Str = btoa(unescape(encodeURIComponent(jsonStr)));
      await navigator.clipboard.writeText(b64Str);
      showStatus('Configuration exported to clipboard!', 'ok');
    } catch (err) {
      console.error('Export failed:', err);
      showStatus('Export failed. Check console.', 'warn');
    }
  });
}

// Import Config
if ($('btn-import-config')) {
  $('btn-import-config').addEventListener('click', async () => {
    const b64Str = prompt('Paste the exported configuration string:');
    if (!b64Str) return;
    try {
      const jsonStr = decodeURIComponent(escape(atob(b64Str.trim())));
      const config = JSON.parse(jsonStr);
      
      if (config.syncProvider) {
        syncProvider = config.syncProvider;
        localStorage.setItem('po_sync_provider', syncProvider);
      }
      if (config.hasOwnProperty('syncGistId')) {
        syncGistId = config.syncGistId;
        localStorage.setItem('po_sync_gist_id', syncGistId);
      }
      if (config.hasOwnProperty('syncGistToken')) {
        syncGistToken = config.syncGistToken;
        localStorage.setItem('po_sync_gist_token', syncGistToken);
      }
      if (config.hasOwnProperty('syncUrl')) {
        syncUrl = config.syncUrl;
        localStorage.setItem('po_sync_url', syncUrl);
      }
      
      updateSyncUI();
      showStatus('Configuration imported successfully! Testing connection...', 'ok');
      
      const ok = await pullFromSyncServer(true);
      if (ok) {
        showStatus('Imported and synchronization active!', 'ok');
        populateVendorSelect();
        populateShipToSelect();
        populateClerkSelect();
        const activePoNum = localStorage.getItem('po_active_num');
        const orders = getOrders();
        const activeOrder = activePoNum ? orders.find(o => o.poNumber === activePoNum) : null;
        if (activeOrder) {
          loadForm(activeOrder);
        } else if (orders.length > 0) {
          loadForm(orders[0]);
        } else {
          newOrder();
        }
      } else {
        showStatus('Connection failed, please contact your administrator.', 'warn');
      }
    } catch (err) {
      console.error('Import failed:', err);
      showStatus('Invalid configuration string.', 'warn');
    }
  });
}

// Test sync connection button
if ($('btn-test-sync')) {
  $('btn-test-sync').addEventListener('click', async () => {
    const statusInfo = $('sync-connection-status');
    if (statusInfo) {
      statusInfo.textContent = 'Testing connection...';
      statusInfo.style.color = 'var(--c-text-muted)';
    }
    const result = await testSyncConnection();
    if (statusInfo) {
      statusInfo.textContent = result.message;
      statusInfo.style.color = result.success ? 'var(--c-success)' : '#ef4444';
    }
  });
}

// Sync form submission
if ($('sync-form')) {
  $('sync-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (syncProvider === 'cloud') {
      const inputGistId = $('sync-gist-id');
      const inputGistToken = $('sync-gist-token');
      
      let gistId = inputGistId ? inputGistId.value.trim() : '';
      if (gistId === '') {
        if (inputGistId && inputGistId.dataset.changed === 'true') {
          gistId = '';
        } else {
          gistId = syncGistId;
        }
      }
      
      let gistToken = inputGistToken ? inputGistToken.value.trim() : '';
      if (gistToken === '') {
        if (inputGistToken && inputGistToken.dataset.changed === 'true') {
          gistToken = '';
        } else {
          gistToken = syncGistToken;
        }
      }

      if (gistId) {
        syncGistId = gistId;
        syncGistToken = gistToken;
        localStorage.setItem('po_sync_gist_id', gistId);
        localStorage.setItem('po_sync_gist_token', gistToken);
        showStatus('Gist settings saved. Connecting...');
        const ok = await pullFromSyncServer(true);
        if (ok) {
          showStatus('GitHub Gist synchronization active!', 'ok');
          populateVendorSelect();
          populateShipToSelect();
          populateClerkSelect();
          const activePoNum = localStorage.getItem('po_active_num');
          const orders = getOrders();
          const activeOrder = activePoNum ? orders.find(o => o.poNumber === activePoNum) : null;
          if (activeOrder) {
            loadForm(activeOrder);
          } else if (orders.length > 0) {
            loadForm(orders[0]);
          } else {
            newOrder();
          }
        } else {
          showStatus('Connection failed, please contact your administrator.', 'warn');
        }
      } else {
        syncGistId = '';
        syncGistToken = '';
        localStorage.removeItem('po_sync_gist_id');
        localStorage.removeItem('po_sync_gist_token');
        syncState = 'disconnected';
        updateSyncUI();
        showStatus('Gist sync disabled. Local Only active.', 'ok');
      }
    } else {
      const val = $('sync-url-input').value.trim();
      if (val) {
        const normalized = val.replace(/\/$/, '');
        syncUrl = normalized;
        localStorage.setItem('po_sync_url', normalized);
        showStatus('LAN Sync URL saved. Connecting...');
        const ok = await pullFromSyncServer(true); // Bootstrap if server empty
        if (ok) {
          showStatus('LAN synchronization active!', 'ok');
          populateVendorSelect();
          populateShipToSelect();
          populateClerkSelect();
          const activePoNum = localStorage.getItem('po_active_num');
          const orders = getOrders();
          const activeOrder = activePoNum ? orders.find(o => o.poNumber === activePoNum) : null;
          if (activeOrder) {
            loadForm(activeOrder);
          } else if (orders.length > 0) {
            loadForm(orders[0]);
          } else {
            newOrder();
          }
        } else {
          showStatus('Connection failed, please contact your administrator.', 'warn');
        }
      } else {
        syncUrl = '';
        localStorage.removeItem('po_sync_url');
        syncState = 'disconnected';
        updateSyncUI();
        showStatus('LAN sync disabled. Local Only active.', 'ok');
      }
    }
    closeModal('modal-sync');
  });
}

$('btn-add-row').addEventListener('click', () => {
  const item = createLineItem();
  lineItems.push(item);
  const tbody = $('items-body');
  const tr = buildRow(item);
  tr.classList.add('row-new');
  tbody.appendChild(tr);
  recalcTotals();
  // Focus item# input in new row
  tr.querySelector('.cell-input').focus();
});

// Modal close buttons (data-close attribute)
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// Backdrop click closes modals
$('modal-backdrop').addEventListener('click', closeAllModals);

// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// Vendor select change
$('vendor-select').addEventListener('change', e => fillVendorAddress(e.target.value));

// Ship-to select change
$('shipto-select').addEventListener('change', e => fillShipToAddress(e.target.value));

// Tax / other change → recalc grand total
$('t-tax-input').addEventListener('input',   () => updateGrandTotal());
$('t-other-input').addEventListener('input', () => updateGrandTotal());

/* ============================================================
   17. ANALYTICS — DATA AGGREGATION
   ============================================================ */

// Analytics active state
let currentPeriod = 'monthly';
let currentBreakdown = 'vendor';


/** Compute grand total for a saved order object */
function orderGrandTotal(order) {
  const sub = (order.lineItems || []).reduce((s, r) => {
    return s + (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);
  }, 0);
  return sub + (order.tax || 0) + (order.other || 0);
}

/**
 * Aggregate all orders into KPIs, time series, and breakdowns.
 * @param {'weekly'|'monthly'|'quarterly'} period
 */
function analyticsData(period = 'monthly') {
  const orders = getOrders();
  const vendors = getVendors();

  if (orders.length === 0) return null;

  // KPIs
  const totalOrders = orders.length;
  const totalSpend = orders.reduce((s, o) => s + orderGrandTotal(o), 0);

  // Vendor map
  const vendorMap = {};
  orders.forEach(o => {
    const v = vendors.find(x => x.id === o.vendorId);
    const name = v ? v.name : '(Unknown Vendor)';
    if (!vendorMap[name]) vendorMap[name] = { count: 0, spend: 0 };
    vendorMap[name].count++;
    vendorMap[name].spend += orderGrandTotal(o);
  });
  const topVendorEntry = Object.entries(vendorMap).sort((a, b) => b[1].count - a[1].count)[0];

  // Clerk map
  const clerkMap = {};
  orders.forEach(o => {
    const name = o.requestedBy || '(Unknown)';
    if (!clerkMap[name]) clerkMap[name] = { count: 0, spend: 0 };
    clerkMap[name].count++;
    clerkMap[name].spend += orderGrandTotal(o);
  });
  const topClerkEntry = Object.entries(clerkMap).sort((a, b) => b[1].count - a[1].count)[0];

  // Time series: bucket by period key
  function getPeriodKey(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return null;
    if (period === 'weekly') {
      // ISO week number
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
    }
    if (period === 'quarterly') {
      return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    }
    // monthly (default)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function formatPeriodLabel(key) {
    if (!key) return key;
    if (period === 'monthly') {
      const [y, m] = key.split('-');
      return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return key; // weekly / quarterly already readable
  }

  const timeMap = {};
  orders.forEach(o => {
    const key = getPeriodKey(o.poDate);
    if (!key) return;
    if (!timeMap[key]) timeMap[key] = { key, label: formatPeriodLabel(key), spend: 0, count: 0 };
    timeMap[key].spend += orderGrandTotal(o);
    timeMap[key].count++;
  });
  const timeSeries = Object.values(timeMap).sort((a, b) => a.key.localeCompare(b.key));

  return {
    totalOrders,
    totalSpend,
    topVendor: topVendorEntry ? topVendorEntry[0] : '—',
    topClerk: topClerkEntry ? topClerkEntry[0] : '—',
    vendorBreakdown: Object.entries(vendorMap)
      .map(([name, d]) => ({ name, ...d, avg: d.spend / d.count }))
      .sort((a, b) => b.spend - a.spend),
    clerkBreakdown: Object.entries(clerkMap)
      .map(([name, d]) => ({ name, ...d, avg: d.spend / d.count }))
      .sort((a, b) => b.spend - a.spend),
    timeSeries,
  };
}

/* ============================================================
   18. ANALYTICS — RENDERING
   ============================================================ */

/** Render KPI stat cards */
function renderKPIs(data) {
  const container = $('analytics-kpis');
  if (!data) {
    container.innerHTML = '';
    return;
  }
  const cards = [
    { label: 'Total Orders',       value: data.totalOrders,           icon: '📋', sub: 'all time' },
    { label: 'Total Spend',        value: fmt(data.totalSpend),       icon: '💰', sub: 'all orders' },
    { label: 'Top Vendor',         value: data.topVendor,             icon: '🏢', sub: 'by order count' },
    { label: 'Most Active Clerk',  value: data.topClerk,              icon: '👤', sub: 'by order count' },
  ];
  container.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-icon" aria-hidden="true">${c.icon}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>
  `).join('');
}

/** Draw the spend-over-time bar chart on <canvas> */
function drawChart(timeSeries) {
  const canvas = $('analytics-chart');
  const emptyMsg = $('chart-empty');
  const tooltip = $('chart-tooltip');

  if (!timeSeries || timeSeries.length === 0) {
    canvas.style.display = 'none';
    emptyMsg.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  emptyMsg.style.display = 'none';

  // Size canvas to its CSS display size (performance: integer pixels)
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth || 700;
  const H = 220;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = { top: 16, right: 16, bottom: 44, left: 64 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const maxSpend = Math.max(...timeSeries.map(d => d.spend), 1);
  const barCount = timeSeries.length;
  const barGap = Math.max(4, Math.floor(chartW / barCount * 0.2));
  const barW = Math.max(8, Math.floor((chartW - barGap * (barCount - 1)) / barCount));

  // Background
  ctx.clearRect(0, 0, W, H);

  // Y-axis grid lines (5 lines)
  ctx.strokeStyle = 'rgba(100,120,160,0.12)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7a94';
  ctx.font = `500 11px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    const val = maxSpend * i / 4;
    ctx.fillText('$' + (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)), pad.left - 6, y + 4);
  }

  // Store bar rects for hover hit-testing
  const bars = [];

  timeSeries.forEach((d, i) => {
    const x = pad.left + i * (barW + barGap);
    const bH = Math.max(2, (d.spend / maxSpend) * chartH);
    const y = pad.top + chartH - bH;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, y, 0, y + bH);
    grad.addColorStop(0, '#00b4d8');
    grad.addColorStop(1, '#0077b6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bH, [3, 3, 0, 0]);
    ctx.fill();

    // X label
    ctx.fillStyle = '#6b7a94';
    ctx.font = `500 10px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x + barW / 2, pad.top + chartH + 10);
    ctx.rotate(-0.42);
    ctx.fillText(d.label, 0, 0);
    ctx.restore();

    bars.push({ x, y, w: barW, h: bH, data: d });
  });

  // Hover tooltip
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit = null;
    for (const bar of bars) {
      if (mx >= bar.x && mx <= bar.x + bar.w && my >= bar.y && my <= bar.y + bar.h) {
        hit = bar;
        break;
      }
    }
    if (hit) {
      tooltip.style.display = 'block';
      tooltip.style.left = (hit.x + hit.w / 2) + 'px';
      tooltip.style.top = (hit.y - 8) + 'px';
      tooltip.innerHTML = `<strong>${hit.data.label}</strong><br>${fmt(hit.data.spend)}<br><span class="tip-sub">${hit.data.count} order${hit.data.count !== 1 ? 's' : ''}</span>`;
    } else {
      tooltip.style.display = 'none';
    }
  }
  function onMouseLeave() { tooltip.style.display = 'none'; }

  // Re-attach listeners cleanly
  canvas.removeEventListener('mousemove', canvas._hoverFn);
  canvas.removeEventListener('mouseleave', canvas._leaveFn);
  canvas._hoverFn = onMouseMove;
  canvas._leaveFn = onMouseLeave;
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
}

/** Render vendor or clerk breakdown table */
function renderBreakdown(mode, data) {
  const wrap = $('analytics-breakdown');
  if (!data) { wrap.innerHTML = '<p class="empty-state">No orders yet.</p>'; return; }

  const rows = mode === 'vendor' ? data.vendorBreakdown : data.clerkBreakdown;
  const maxSpend = rows[0] ? rows[0].spend : 1;

  if (rows.length === 0) { wrap.innerHTML = '<p class="empty-state">No data.</p>'; return; }

  wrap.innerHTML = `
    <table class="breakdown-table" aria-label="${mode === 'vendor' ? 'Vendor' : 'Clerk'} spending breakdown">
      <thead>
        <tr>
          <th scope="col">${mode === 'vendor' ? 'Vendor' : 'Clerk'}</th>
          <th scope="col" class="num-col"># Orders</th>
          <th scope="col" class="num-col">Total Spend</th>
          <th scope="col" class="num-col">% of Total</th>
          <th scope="col" class="num-col">Avg Order</th>
          <th scope="col" class="bar-col">Share</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const pct = data.totalSpend > 0 ? (r.spend / data.totalSpend * 100).toFixed(1) : '0.0';
          const barPct = maxSpend > 0 ? (r.spend / maxSpend * 100).toFixed(1) : '0';
          return `<tr>
            <td class="name-col">${r.name}</td>
            <td class="num-col">${r.count}</td>
            <td class="num-col">${fmt(r.spend)}</td>
            <td class="num-col">${pct}%</td>
            <td class="num-col">${fmt(r.avg)}</td>
            <td class="bar-col"><div class="mini-bar"><div class="mini-bar-fill" style="width:${barPct}%"></div></div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

/** Populate log filter dropdowns */
function populateLogFilters(orders) {
  const vendors = getVendors();

  const vSel = $('log-filter-vendor');
  const cSel = $('log-filter-clerk');
  const vendorNames = [...new Set(orders.map(o => { const v = vendors.find(x => x.id === o.vendorId); return v ? v.name : ''; }).filter(Boolean))];
  const clerkNames  = [...new Set(orders.map(o => o.requestedBy).filter(Boolean))];

  vSel.innerHTML = '<option value="">All Vendors</option>' +
    vendorNames.map(n => `<option value="${n}">${n}</option>`).join('');
  cSel.innerHTML = '<option value="">All Clerks</option>' +
    clerkNames.map(n => `<option value="${n}">${n}</option>`).join('');
}

/** Render the filterable order log table */
function renderOrderLog(filters = {}) {
  const wrap = $('analytics-log');
  const vendors = getVendors();
  let orders = getOrders();

  const q = (filters.search || '').toLowerCase();
  const fv = filters.vendor || '';
  const fc = filters.clerk  || '';

  if (q || fv || fc) {
    orders = orders.filter(o => {
      const v = vendors.find(x => x.id === o.vendorId);
      const vName = v ? v.name : '';
      if (fv && vName !== fv) return false;
      if (fc && o.requestedBy !== fc) return false;
      if (q) {
        const hay = [o.poNumber, vName, o.requestedBy, o.poDate].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  if (orders.length === 0) {
    wrap.innerHTML = '<p class="empty-state">No orders match your filters.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="log-table" aria-label="Order log">
      <thead>
        <tr>
          <th scope="col">PO #</th>
          <th scope="col">Date</th>
          <th scope="col">Vendor</th>
          <th scope="col">Clerk</th>
          <th scope="col" class="num-col">Lines</th>
          <th scope="col" class="num-col">Total</th>
          <th scope="col" class="action-col no-print"></th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => {
          const v = vendors.find(x => x.id === o.vendorId);
          const total = orderGrandTotal(o);
          const statusClass = o.status === 'completed' ? 'completed' : 'draft';
          const statusText = o.status === 'completed' ? 'Completed' : 'Draft';
          const statusBadge = `<span class="log-status-badge ${statusClass}">${statusText}</span>`;
          return `<tr>
            <td class="po-num-cell">${o.poNumber || '—'}${statusBadge}</td>
            <td>${o.poDate || '—'}</td>
            <td>${v ? v.name : '<em>Unknown</em>'}</td>
            <td>${o.requestedBy || '—'}</td>
            <td class="num-col">${(o.lineItems || []).filter(r => r.desc || r.itemNo).length}</td>
            <td class="num-col total-cell">${fmt(total)}</td>
            <td class="action-col no-print">
              <button class="btn-load-log btn-edit" data-po="${o.poNumber}" aria-label="Edit order ${o.poNumber}">Edit</button>
              ${o.status === 'completed'
                ? `<button class="btn-toggle-status-log btn-edit" data-po="${o.poNumber}" data-status="draft" aria-label="Reopen order ${o.poNumber}" style="color: var(--c-accent); border-color: var(--c-accent);">Reopen</button>`
                : `<button class="btn-toggle-status-log btn-print-log" data-po="${o.poNumber}" data-status="completed" aria-label="Mark order ${o.poNumber} complete" style="color: var(--c-success); border-color: var(--c-success);">Complete</button>`
              }
              <button class="btn-print-log" data-po="${o.poNumber}" aria-label="Print order ${o.poNumber}">Print</button>
              <button class="btn-delete-log btn-delete" data-po="${o.poNumber}" aria-label="Delete order ${o.poNumber}">Delete</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Wire load/edit buttons
  wrap.querySelectorAll('.btn-load-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const po = btn.dataset.po;
      const order = getOrders().find(o => o.poNumber === po);
      if (!order) return;
      if (lineItems.length > 0 && lineItems.some(r => r.desc || r.itemNo)) {
        if (!confirm(`Load order ${po}? Unsaved changes in your current form will be lost.`)) return;
      }
      loadForm(order);
      closeAllModals();
      showStatus(`Loaded order ${po}`);
    });
  });

  // Wire toggle status buttons
  wrap.querySelectorAll('.btn-toggle-status-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const po = btn.dataset.po;
      const targetStatus = btn.dataset.status;
      const orders = getOrders();
      const idx = orders.findIndex(o => o.poNumber === po);
      if (idx >= 0) {
        orders[idx].status = targetStatus;
        saveOrders(orders);
        
        // Re-render analytics list and log
        renderAnalytics();
        
        // If the active PO is loaded on the screen, reload the form to apply read-only locks or unlock it
        const currentActivePO = localStorage.getItem('po_active_num');
        if (currentActivePO === po) {
          loadForm(orders[idx]);
        }
        
        showStatus(`Order ${po} marked as ${targetStatus === 'completed' ? 'Completed' : 'Draft'}!`, 'ok');
      }
    });
  });

  // Wire print buttons
  wrap.querySelectorAll('.btn-print-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const po = btn.dataset.po;
      const order = getOrders().find(o => o.poNumber === po);
      if (!order) return;
      if (lineItems.length > 0 && lineItems.some(r => r.desc || r.itemNo)) {
        const currentPO = $('po-number').value;
        if (currentPO !== po && !confirm(`Load and print order ${po}? Unsaved changes in your current form will be lost.`)) {
          return;
        }
      }
      loadForm(order);
      closeAllModals();
      showStatus(`Printing order ${po}…`);
      setTimeout(() => {
        window.print();
      }, 150);
    });
  });

  // Wire delete buttons
  wrap.querySelectorAll('.btn-delete-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const po = btn.dataset.po;
      if (!confirm(`Delete order ${po} from history? This action is irreversible.`)) return;
      const updated = getOrders().filter(o => o.poNumber !== po);
      saveOrders(updated);
      renderAnalytics();
      showStatus(`Order ${po} deleted`, 'warn');
      if (localStorage.getItem('po_active_num') === po) {
        newOrder();
      }
    });
  });
}

/** Apply active filters and search query to order log */
function applyLogFilters() {
  renderOrderLog({
    search: $('log-search').value,
    vendor: $('log-filter-vendor').value,
    clerk:  $('log-filter-clerk').value,
  });
}

/** Master render function — called when Analytics modal opens or updates */
function renderAnalytics() {
  const data = analyticsData(currentPeriod);
  renderKPIs(data);

  if (data) {
    drawChart(data.timeSeries);
    renderBreakdown(currentBreakdown, data);
  } else {
    $('analytics-chart').style.display = 'none';
    $('chart-empty').style.display = 'block';
    $('analytics-breakdown').innerHTML = '<p class="empty-state">No orders yet.</p>';
  }

  // Sync active visual toggles to current values
  document.querySelectorAll('.toggle-btn[data-period]').forEach(b => {
    b.classList.toggle('active', b.dataset.period === currentPeriod);
  });
  document.querySelectorAll('.toggle-btn[data-breakdown]').forEach(b => {
    b.classList.toggle('active', b.dataset.breakdown === currentBreakdown);
  });

  // Populate + render order log preserving current inputs
  populateLogFilters(getOrders());
  applyLogFilters();
}

/* ============================================================
   16. INIT
   ============================================================ */

async function loadConfig() {
  console.log('[CONFIG] Attempting to load configuration...');
  try {
    // Try LAN server endpoint first
    let res = await fetch('/api/config').catch(err => {
      console.warn('[CONFIG] Fetch /api/config failed:', err);
      return null;
    });
    // Fallback to local file if server not present (e.g. opened statically)
    if (!res || !res.ok) {
      console.log('[CONFIG] LAN server endpoint config fetch non-ok, trying local file fallback...');
      res = await fetch('sync_config.json').catch(err => {
        console.warn('[CONFIG] Fetch sync_config.json failed:', err);
        return null;
      });
    }
    
    if (res && res.ok) {
      const config = await res.json();
      console.log('[CONFIG] Config loaded successfully:', config);
      if (config.syncGistId) {
        localStorage.setItem('po_sync_gist_id', config.syncGistId);
        syncGistId = config.syncGistId;
        console.log('[CONFIG] Set syncGistId =', syncGistId);
      }
      if (config.syncGistToken) {
        localStorage.setItem('po_sync_gist_token', config.syncGistToken);
        syncGistToken = config.syncGistToken;
        console.log('[CONFIG] Set syncGistToken =', syncGistToken ? '***' : '');
      }
      if (config.syncUrl) {
        localStorage.setItem('po_sync_url', config.syncUrl);
        syncUrl = config.syncUrl;
        console.log('[CONFIG] Set syncUrl =', syncUrl);
      }
      if (config.syncProvider) {
        localStorage.setItem('po_sync_provider', config.syncProvider);
        syncProvider = config.syncProvider;
        console.log('[CONFIG] Set syncProvider =', syncProvider);
      }
      updateSyncUI();
    } else {
      console.warn('[CONFIG] No configuration response or invalid response status.');
    }
  } catch (err) {
    console.error('[CONFIG] Critical exception loading configuration:', err);
  }
}

async function init() {
  migratePII();
  // Load configuration from local intranet share or file dynamically on boot
  await loadConfig();

  // Automatically seed cloud sync defaults in localStorage on first load (excluding secrets)
  if (!localStorage.getItem('po_sync_provider')) {
    localStorage.setItem('po_sync_provider', 'cloud');
    syncProvider = 'cloud';
  }

  // Auto-detect server URL if served from a local LAN/NAS private IP, local TLD, or non-standard port
  const hostname = window.location.hostname;
  const isPrivateIP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);
  const isLocalDomain = hostname.endsWith('.local') || hostname.endsWith('.lan') || hostname.endsWith('.home');
  const isNonStandardPort = window.location.port !== '' && window.location.port !== '80' && window.location.port !== '443';
  
  const isLanHost = isPrivateIP || isLocalDomain || isNonStandardPort;

  if (!localStorage.getItem('po_sync_gist_id') && !syncUrl && window.location.protocol.startsWith('http') && isLanHost) {
    syncProvider = 'lan';
    localStorage.setItem('po_sync_provider', 'lan');
    syncUrl = window.location.origin;
    localStorage.setItem('po_sync_url', syncUrl);
  }

  // Pull data from active sync provider if configured
  const activeTarget = (syncProvider === 'cloud') ? syncGistId : syncUrl;
  if (activeTarget) {
    showStatus('Synchronizing shared database...', 'ok');
    await pullFromSyncServer(true); // bootstrap if empty
  }

  seedIfEmpty();
  populateVendorSelect();
  populateShipToSelect();
  populateClerkSelect();
  setupCommentsToggles();
  updateSyncUI();

  // Start with a fresh order or resume last active
  const activePoNum = localStorage.getItem('po_active_num');
  const orders = getOrders();
  const activeOrder = activePoNum ? orders.find(o => o.poNumber === activePoNum) : null;
  if (activeOrder) {
    loadForm(activeOrder);
    showStatus(`Resumed draft ${activeOrder.poNumber}`);
  } else {
    newOrder();
  }
}

init();

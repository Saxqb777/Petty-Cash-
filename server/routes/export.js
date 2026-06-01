const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db/database');

const router = express.Router();

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  darkBg:    'FF0d1117',   // deep navy
  greenDk:   'FF166534',   // dark green header
  greenMd:   'FF16a34a',   // brand green
  greenLt:   'FFf0fdf4',   // pale green row
  totalBg:   'FFdcfce7',   // light green total
  amber:     'FFfef3c7',   // foreign currency highlight
  evenRow:   'FFf8fafc',   // alternating row
  white:     'FFFFFFFF',
  textDark:  'FF0d1117',
  textGreen: 'FF166534',
  textGray:  'FF64748b',
  subRow:    'FFf1f5f9',   // charge sub-row bg
  subText:   'FF475569',
};

function fill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function font(cell, { bold = false, size = 10, color = C.textDark, italic = false } = {}) {
  cell.font = { name: 'Calibri', size, bold, italic, color: { argb: color } };
}
function align(cell, h = 'left', v = 'middle', wrap = false) {
  cell.alignment = { horizontal: h, vertical: v, wrapText: wrap };
}
function border(cell, sides = {}) {
  const s = { style: 'thin', color: { argb: 'FFe2e8f0' } };
  cell.border = {
    top:    sides.top    ? s : undefined,
    bottom: sides.bottom ? s : undefined,
    left:   sides.left   ? s : undefined,
    right:  sides.right  ? s : undefined,
  };
}

function darkHeader(cell, text) {
  cell.value = text;
  fill(cell, C.darkBg);
  font(cell, { bold: true, size: 11, color: C.white });
  align(cell, 'center', 'middle');
}
function colHeader(cell, text) {
  cell.value = text;
  fill(cell, C.greenDk);
  font(cell, { bold: true, size: 10, color: C.white });
  align(cell, 'center', 'middle');
  cell.border = { bottom: { style: 'medium', color: { argb: C.greenMd } } };
}
function sectionLabel(cell, text) {
  cell.value = text;
  fill(cell, C.greenLt);
  font(cell, { bold: true, size: 10, color: C.textGreen });
  align(cell, 'left', 'middle');
}
function totalRow(row) {
  row.eachCell(cell => {
    fill(cell, C.totalBg);
    font(cell, { bold: true, color: C.textGreen });
    align(cell, 'left', 'middle');
  });
}

const fmtMoney = n => parseFloat(n || 0);
const typeLabel = t => t === 'adnoc' ? 'Petrol & Fuel' : t === 'shipping' ? 'Shipping Bill' : 'General';

router.get('/', async (req, res) => {
  try {
    const { from, to, type = 'all' } = req.query;
    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let q = 'SELECT * FROM expenses WHERE 1=1';
    const p = [];
    if (type === 'this_month') { q += " AND strftime('%Y-%m', date) = ?"; p.push(thisYM); }
    else if (type === 'custom') {
      if (from) { q += ' AND date >= ?'; p.push(from); }
      if (to)   { q += ' AND date <= ?'; p.push(to); }
    }
    q += ' ORDER BY date ASC';

    const records = db.prepare(q).all(...p).map(r => ({
      ...r,
      line_items:        JSON.parse(r.line_items        || '[]'),
      container_numbers: JSON.parse(r.container_numbers || '[]'),
      bl_numbers:        JSON.parse(r.bl_numbers        || '[]'),
    }));

    let sq = 'SELECT * FROM clearance_savings WHERE 1=1';
    const sp = [];
    if (type === 'this_month') { sq += " AND strftime('%Y-%m', date) = ?"; sp.push(thisYM); }
    else if (type === 'custom') {
      if (from) { sq += ' AND date >= ?'; sp.push(from); }
      if (to)   { sq += ' AND date <= ?'; sp.push(to); }
    }
    sq += ' ORDER BY date ASC';
    const savingsRecords = db.prepare(sq).all(...sp);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Agthia Petty Cash';
    wb.created = now;

    const dateRange = from && to ? `${from} to ${to}` : type === 'this_month' ? thisYM : 'All Time';
    const totalAED  = records.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 1 — Summary
    // ═══════════════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Summary');
    ws1.columns = [
      { width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }
    ];

    // Title
    ws1.mergeCells('A1:F1');
    darkHeader(ws1.getCell('A1'), 'AGTHIA GROUP  —  PETTY CASH EXPENSE REPORT');
    ws1.getRow(1).height = 38;

    // Sub-title
    ws1.mergeCells('A2:F2');
    const sub = ws1.getCell('A2');
    sub.value = `Period: ${dateRange}   ·   Generated: ${now.toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' })}   ·   ${records.length} transactions`;
    fill(sub, '1a2332');
    font(sub, { size: 9, color: 'FFaaaaaa', italic: true });
    align(sub, 'center');
    ws1.getRow(2).height = 20;
    ws1.getRow(3).height = 10;

    // Key Metrics
    ws1.mergeCells('A4:F4');
    sectionLabel(ws1.getCell('A4'), '  KEY METRICS');
    ws1.getRow(4).height = 24;

    const foreignCount  = records.filter(r => r.currency !== 'AED').length;
    const shippingCount = records.filter(r => r.expense_type === 'shipping').length;
    const fuelCount     = records.filter(r => r.expense_type === 'adnoc').length;

    const metrics = [
      ['Total Spent (AED)',        `AED ${totalAED.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
      ['Total Transactions',       String(records.length)],
      ['Shipping Bills',           String(shippingCount)],
      ['Petrol & Fuel Records',    String(fuelCount)],
      ['Foreign Currency Records', String(foreignCount)],
      ['Avg Transaction (AED)',    `AED ${(totalAED / (records.length || 1)).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
    ];

    metrics.forEach(([label, val], i) => {
      const rn = 5 + i;
      ws1.mergeCells(`A${rn}:C${rn}`);
      ws1.mergeCells(`D${rn}:F${rn}`);
      const lc = ws1.getCell(`A${rn}`);
      const vc = ws1.getCell(`D${rn}`);
      lc.value = '  ' + label;
      vc.value = val;
      font(lc, { size: 10 });
      font(vc, { size: 11, bold: true, color: C.textGreen });
      align(lc, 'left', 'middle');
      align(vc, 'right', 'middle');
      if (i % 2 === 0) { fill(lc, C.evenRow); fill(vc, C.evenRow); }
      ws1.getRow(rn).height = 22;
    });

    ws1.getRow(11).height = 14;

    // By Category
    // By Category — parameterized
    let catQ = `SELECT category, COUNT(*) as cnt, SUM(COALESCE(amount_aed,amount)) as total FROM expenses WHERE 1=1`;
    const catP = [];
    if (type === 'this_month') { catQ += " AND strftime('%Y-%m',date)=?"; catP.push(thisYM); }
    else if (type === 'custom') {
      if (from) { catQ += ' AND date>=?'; catP.push(from); }
      if (to)   { catQ += ' AND date<=?'; catP.push(to); }
    }
    catQ += ' GROUP BY category ORDER BY total DESC';
    const catData = db.prepare(catQ).all(...catP);

    ws1.mergeCells('A12:F12'); sectionLabel(ws1.getCell('A12'), '  SPEND BY CATEGORY'); ws1.getRow(12).height = 24;
    ['Category','Transactions','Amount (AED)','% of Total'].forEach((h, ci) => {
      const cols = ['A','C','D','F'];
      try { if(ci===0) ws1.mergeCells('A13:B13'); } catch(_){}
      try { if(ci===2) ws1.mergeCells('D13:E13'); } catch(_){}
      colHeader(ws1.getCell(cols[ci]+'13'), h);
    });
    ws1.getRow(13).height = 24;
    catData.forEach((c, i) => {
      const rn = 14 + i;
      try { ws1.mergeCells(`A${rn}:B${rn}`); } catch(_){}
      try { ws1.mergeCells(`D${rn}:E${rn}`); } catch(_){}
      ws1.getCell(`A${rn}`).value = c.category;
      ws1.getCell(`C${rn}`).value = c.cnt;
      const amtCell = ws1.getCell(`D${rn}`);
      amtCell.value = fmtMoney(c.total); amtCell.numFmt = '#,##0.00';
      align(amtCell, 'right');
      ws1.getCell(`F${rn}`).value = totalAED > 0 ? ((c.total/totalAED)*100).toFixed(1)+'%' : '0%';
      align(ws1.getCell(`F${rn}`), 'right');
      if (i % 2 === 0) ['A','C','D','F'].forEach(col => fill(ws1.getCell(col+rn), C.evenRow));
      ws1.getRow(rn).height = 20;
    });

    const buStart = 14 + catData.length + 2;
    // By BU — parameterized
    let buQ = `SELECT business_unit, COUNT(*) as cnt, SUM(COALESCE(amount_aed,amount)) as total FROM expenses WHERE 1=1`;
    const buP = [];
    if (type === 'this_month') { buQ += " AND strftime('%Y-%m',date)=?"; buP.push(thisYM); }
    else if (type === 'custom') {
      if (from) { buQ += ' AND date>=?'; buP.push(from); }
      if (to)   { buQ += ' AND date<=?'; buP.push(to); }
    }
    buQ += ' GROUP BY business_unit ORDER BY total DESC';
    const buData = db.prepare(buQ).all(...buP);

    ws1.mergeCells(`A${buStart}:F${buStart}`); sectionLabel(ws1.getCell(`A${buStart}`), '  SPEND BY BUSINESS UNIT'); ws1.getRow(buStart).height = 24;
    ['Business Unit','Transactions','Amount (AED)','% of Total'].forEach((h, ci) => {
      const cols = ['A','C','D','F']; const hr = buStart+1;
      try { if(ci===0) ws1.mergeCells(`A${hr}:B${hr}`); } catch(_){}
      try { if(ci===2) ws1.mergeCells(`D${hr}:E${hr}`); } catch(_){}
      colHeader(ws1.getCell(cols[ci]+hr), h);
    });
    ws1.getRow(buStart+1).height = 24;
    buData.forEach((b, i) => {
      const rn = buStart + 2 + i;
      try { ws1.mergeCells(`A${rn}:B${rn}`); } catch(_){}
      try { ws1.mergeCells(`D${rn}:E${rn}`); } catch(_){}
      ws1.getCell(`A${rn}`).value = b.business_unit || '—';
      ws1.getCell(`C${rn}`).value = b.cnt;
      const amtCell = ws1.getCell(`D${rn}`);
      amtCell.value = fmtMoney(b.total); amtCell.numFmt = '#,##0.00'; align(amtCell,'right');
      ws1.getCell(`F${rn}`).value = totalAED > 0 ? ((b.total/totalAED)*100).toFixed(1)+'%' : '0%';
      align(ws1.getCell(`F${rn}`),'right');
      if (i % 2 === 0) ['A','C','D','F'].forEach(col => fill(ws1.getCell(col+rn), C.evenRow));
      ws1.getRow(rn).height = 20;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 2 — All Expenses  (shipping bills expand with charge sub-rows)
    // ═══════════════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('All Expenses', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

    const expCols = [
      { header: 'Sr.',              key: 'sr',      width: 6  },
      { header: 'Date',             key: 'date',    width: 13 },
      { header: 'Invoice No.',      key: 'invoice', width: 16 },
      { header: 'Vendor / Supplier',key: 'vendor',  width: 28 },
      { header: 'Type',             key: 'type',    width: 16 },
      { header: 'Category',         key: 'cat',     width: 22 },
      { header: 'Business Unit',    key: 'bu',      width: 13 },
      { header: 'Currency',         key: 'curr',    width: 10 },
      { header: 'Orig. Amount',     key: 'orig',    width: 14 },
      { header: 'AED Amount',       key: 'aed',     width: 14 },
      { header: 'Payment',          key: 'pay',     width: 13 },
      { header: 'Purpose / Route',  key: 'purpose', width: 34 },
      { header: 'Submitted By',     key: 'sub',     width: 17 },
      { header: 'BL / Reference',   key: 'bl',      width: 24 },
      { header: 'Notes',            key: 'notes',   width: 26 },
    ];
    ws2.columns = expCols;
    ws2.getRow(1).eachCell((cell, ci) => colHeader(cell, expCols[ci-1].header));
    ws2.getRow(1).height = 28;

    let srNo = 0;
    records.forEach((r, ri) => {
      const isEven = ri % 2 === 0;
      const isForeign = r.currency && r.currency !== 'AED';
      const bls = r.bl_numbers?.length ? r.bl_numbers.join(', ') : (r.bl_number || '');
      srNo++;

      // Main record row
      const mainRow = ws2.addRow({
        sr: srNo, date: r.date, invoice: r.invoice_number || '',
        vendor: r.vendor_name, type: typeLabel(r.expense_type),
        cat: r.category, bu: r.business_unit || '',
        curr: r.currency || 'AED',
        orig: fmtMoney(r.amount), aed: fmtMoney(r.amount_aed || r.amount),
        pay: r.payment_method || '', purpose: r.purpose || '',
        sub: r.submitted_by || '', bl: bls, notes: r.notes || '',
      });
      mainRow.eachCell(cell => {
        font(cell, { size: 10 });
        align(cell, 'left', 'middle');
        if (isEven) fill(cell, C.evenRow);
      });
      const origCell = mainRow.getCell('orig');
      origCell.numFmt = '#,##0.00'; align(origCell, 'right', 'middle');
      if (isForeign) fill(origCell, C.amber);
      const aedCell = mainRow.getCell('aed');
      aedCell.numFmt = '#,##0.00'; font(aedCell, { bold: true, size: 10 }); align(aedCell, 'right', 'middle');
      mainRow.height = 18;

      // Charge sub-rows for shipping bills
      if (r.expense_type === 'shipping' && Array.isArray(r.line_items) && r.line_items.length > 0) {
        const filled = r.line_items.filter(li => parseFloat(li.amount || 0) > 0);
        filled.forEach(li => {
          const subRow = ws2.addRow({
            sr: '', date: '', invoice: '',
            vendor: `    ↳  ${li.label || li.name || 'Charge'}`,
            type: '', cat: '', bu: '', curr: 'AED',
            orig: '', aed: fmtMoney(li.amount),
            pay: '', purpose: '', sub: '', bl: '', notes: '',
          });
          subRow.eachCell(cell => {
            font(cell, { size: 9, italic: true, color: C.subText });
            align(cell, 'left', 'middle');
            fill(cell, C.subRow);
          });
          const subAed = subRow.getCell('aed');
          subAed.numFmt = '#,##0.00'; align(subAed, 'right', 'middle');
          font(subAed, { size: 9, color: C.textGreen });
          subRow.height = 16;
        });
      }
    });

    // Total
    const tr2 = ws2.addRow({ vendor: 'TOTAL', aed: fmtMoney(totalAED), pay: `${records.length} records` });
    totalRow(tr2);
    tr2.getCell('aed').numFmt = '#,##0.00'; align(tr2.getCell('aed'), 'right', 'middle');
    tr2.height = 26;

    ws2.views = [{ state: 'frozen', ySplit: 1 }];
    ws2.autoFilter = { from: 'A1', to: { row: 1, column: expCols.length } };

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 3 — Shipping Details  (one row per charge line, grouped per bill)
    // ═══════════════════════════════════════════════════════════════════════════
    const shippingRecs = records.filter(r => r.expense_type === 'shipping');

    if (shippingRecs.length > 0) {
      const ws3 = wb.addWorksheet('Shipping Details', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

      const shipCols = [
        { header: 'Date',          key: 'date',    width: 13 },
        { header: 'Vendor / Agent',key: 'vendor',  width: 26 },
        { header: 'Invoice',       key: 'invoice', width: 16 },
        { header: 'BL Numbers',    key: 'bls',     width: 28 },
        { header: 'Containers',    key: 'conts',   width: 26 },
        { header: 'Port',          key: 'port',    width: 10 },
        { header: 'I/E',           key: 'ie',      width: 9  },
        { header: 'BU',            key: 'bu',      width: 10 },
        { header: 'Charge Type',   key: 'charge',  width: 28 },
        { header: 'Amount (AED)',  key: 'amount',  width: 16 },
      ];
      ws3.columns = shipCols;
      ws3.getRow(1).eachCell((cell, ci) => colHeader(cell, shipCols[ci-1].header));
      ws3.getRow(1).height = 28;

      let grandTotal = 0;
      shippingRecs.forEach((r, ri) => {
        const isEven = ri % 2 === 0;
        const bls   = r.bl_numbers?.length ? r.bl_numbers.join(', ') : (r.bl_number || '');
        const conts = r.container_numbers?.length ? r.container_numbers.join(', ') : (r.container_number || '');
        const charges = Array.isArray(r.line_items)
          ? r.line_items.filter(li => parseFloat(li.amount || 0) > 0)
          : [];

        if (charges.length === 0) {
          // Single row even if no breakdown
          const row = ws3.addRow({
            date: r.date, vendor: r.vendor_name, invoice: r.invoice_number || '',
            bls, conts, port: r.port || '', ie: r.shipment_type || '', bu: r.business_unit || '',
            charge: 'Total', amount: fmtMoney(r.amount_aed || r.amount),
          });
          row.eachCell(cell => { font(cell, { size: 10 }); align(cell, 'left', 'middle'); if (isEven) fill(cell, C.evenRow); });
          row.getCell('amount').numFmt = '#,##0.00'; align(row.getCell('amount'), 'right', 'middle');
          row.height = 18;
          grandTotal += r.amount_aed || r.amount || 0;
        } else {
          // First charge row carries the bill header info
          charges.forEach((li, li_i) => {
            const amt = fmtMoney(li.amount);
            const row = ws3.addRow({
              date:    li_i === 0 ? r.date            : '',
              vendor:  li_i === 0 ? r.vendor_name     : '',
              invoice: li_i === 0 ? (r.invoice_number || '') : '',
              bls:     li_i === 0 ? bls               : '',
              conts:   li_i === 0 ? conts              : '',
              port:    li_i === 0 ? (r.port || '')    : '',
              ie:      li_i === 0 ? (r.shipment_type || '') : '',
              bu:      li_i === 0 ? (r.business_unit || '') : '',
              charge:  li.label || li.name || 'Charge',
              amount:  amt,
            });
            row.eachCell(cell => {
              font(cell, { size: 10 });
              align(cell, 'left', 'middle');
              if (isEven) fill(cell, C.evenRow);
            });
            row.getCell('amount').numFmt = '#,##0.00';
            align(row.getCell('amount'), 'right', 'middle');
            font(row.getCell('amount'), { bold: false, size: 10, color: C.textGreen });
            row.height = li_i === 0 ? 19 : 17;
            grandTotal += li.amount || 0;
          });

          // Bill sub-total row
          const billAmt = fmtMoney(r.amount_aed || r.amount);
          const subTot = ws3.addRow({ charge: 'Bill Total', amount: billAmt });
          subTot.eachCell(cell => { fill(cell, C.totalBg); font(cell, { bold: true, size: 10, color: C.textGreen }); align(cell, 'right', 'middle'); });
          subTot.getCell('charge').alignment = { horizontal: 'right', vertical: 'middle' };
          subTot.getCell('amount').numFmt = '#,##0.00';
          subTot.height = 18;
        }
      });

      // Grand total
      const gRow = ws3.addRow({ vendor: 'GRAND TOTAL', amount: fmtMoney(grandTotal) });
      gRow.eachCell(cell => { fill(cell, C.greenDk); font(cell, { bold: true, size: 11, color: C.white }); align(cell, 'left', 'middle'); });
      gRow.getCell('amount').numFmt = '#,##0.00'; align(gRow.getCell('amount'), 'right', 'middle');
      gRow.height = 28;

      ws3.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 4 — Savings Report
    // ═══════════════════════════════════════════════════════════════════════════
    if (savingsRecords.length > 0) {
      const ws4 = wb.addWorksheet('Savings Report');
      const savCols = [
        { header: 'Date',           key: 'date',   width: 13 },
        { header: 'BU',             key: 'bu',     width: 10 },
        { header: 'Port',           key: 'port',   width: 10 },
        { header: 'Reference',      key: 'ref',    width: 20 },
        { header: 'I/E',            key: 'ie',     width: 9  },
        { header: 'Previous Agent', key: 'prev',   width: 22 },
        { header: 'Current Agent',  key: 'curr',   width: 22 },
        { header: 'Old Fee (AED)',  key: 'old',    width: 14 },
        { header: 'New Fee (AED)',  key: 'new',    width: 14 },
        { header: 'Savings (AED)', key: 'sav',    width: 14 },
        { header: 'Project',        key: 'proj',   width: 20 },
        { header: 'Description',    key: 'desc',   width: 30 },
      ];
      ws4.columns = savCols;
      ws4.getRow(1).eachCell((cell, ci) => colHeader(cell, savCols[ci-1].header));
      ws4.getRow(1).height = 28;

      const byMonth = {};
      savingsRecords.forEach(r => {
        const m = r.month || (r.date ? r.date.substring(0, 7) : 'Unknown');
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(r);
      });

      Object.keys(byMonth).sort().forEach(month => {
        const recs = byMonth[month];
        const startRow = ws4.lastRow?.number + 1 || 2;
        ws4.mergeCells(`A${startRow}:L${startRow}`);
        sectionLabel(ws4.getCell(`A${startRow}`), `  ${month}`);
        ws4.getRow(startRow).height = 24;

        recs.forEach((r, i) => {
          const row = ws4.addRow({
            date: r.date, bu: r.business_unit || '', port: r.port || '',
            ref: r.reference_number || '', ie: r.import_export || '',
            prev: r.previous_agent || '', curr: r.current_agent || '',
            old: fmtMoney(r.old_fee), new: fmtMoney(r.new_fee), sav: fmtMoney(r.savings),
            proj: r.project_name || '', desc: r.description || '',
          });
          row.eachCell(cell => {
            font(cell, { size: 10 });
            align(cell, 'left', 'middle');
            if (i % 2 === 0) fill(cell, C.evenRow);
          });
          ['old','new','sav'].forEach(k => {
            const ci = savCols.findIndex(c => c.key === k) + 1;
            const cell = row.getCell(ci);
            cell.numFmt = '#,##0.00'; align(cell, 'right', 'middle');
            if (k === 'sav') font(cell, { bold: true, size: 10, color: C.textGreen });
          });
          row.height = 18;
        });

        // Monthly subtotal
        const mTotal = { old: 0, new: 0, sav: 0 };
        recs.forEach(r => { mTotal.old += r.old_fee||0; mTotal.new += r.new_fee||0; mTotal.sav += r.savings||0; });
        const mRow = ws4.addRow({ date: 'Month Total', old: fmtMoney(mTotal.old), new: fmtMoney(mTotal.new), sav: fmtMoney(mTotal.sav) });
        mRow.eachCell(cell => { fill(cell, C.totalBg); font(cell, { bold: true, color: C.textGreen }); align(cell, 'left', 'middle'); });
        ['old','new','sav'].forEach(k => {
          const ci = savCols.findIndex(c => c.key === k)+1;
          mRow.getCell(ci).numFmt = '#,##0.00'; align(mRow.getCell(ci), 'right', 'middle');
        });
        mRow.height = 22;
      });

      // Grand total row
      const gTot = { old: 0, new: 0, sav: 0 };
      savingsRecords.forEach(r => { gTot.old += r.old_fee||0; gTot.new += r.new_fee||0; gTot.sav += r.savings||0; });
      const gRow = ws4.addRow({ date: 'GRAND TOTAL', old: fmtMoney(gTot.old), new: fmtMoney(gTot.new), sav: fmtMoney(gTot.sav) });
      gRow.eachCell(cell => { fill(cell, C.greenDk); font(cell, { bold: true, size: 11, color: C.white }); align(cell, 'left', 'middle'); });
      ['old','new','sav'].forEach(k => {
        const ci = savCols.findIndex(c => c.key === k)+1;
        gRow.getCell(ci).numFmt = '#,##0.00'; align(gRow.getCell(ci), 'right', 'middle');
      });
      gRow.height = 28;

      // Net savings summary box
      // Fuel cost — parameterized
      let fuelQ = `SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) as f FROM expenses WHERE expense_type='adnoc'`;
      const fuelP = [];
      if (type === 'this_month') { fuelQ += " AND strftime('%Y-%m',date)=?"; fuelP.push(thisYM); }
      else if (type === 'custom') {
        if (from) { fuelQ += ' AND date>=?'; fuelP.push(from); }
        if (to)   { fuelQ += ' AND date<=?'; fuelP.push(to); }
      }
      const fuelCost = db.prepare(fuelQ).get(...fuelP).f;

      const boxStart = ws4.lastRow.number + 2;
      [
        ['Gross Agent Fee Savings', `AED ${gTot.sav.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
        ['Self-Clearance Fuel Cost', `AED ${fuelCost.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
        ['NET SAVINGS', `AED ${(gTot.sav - fuelCost).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
      ].forEach(([label, val], i) => {
        const rn = boxStart + i;
        try { ws4.mergeCells(`A${rn}:G${rn}`); } catch(_){}
        try { ws4.mergeCells(`H${rn}:L${rn}`); } catch(_){}
        const lc = ws4.getCell(`A${rn}`);
        const vc = ws4.getCell(`H${rn}`);
        lc.value = '  ' + label;
        vc.value = val;
        const isNet = i === 2;
        fill(lc, isNet ? C.greenLt : C.evenRow);
        fill(vc, isNet ? C.greenLt : C.evenRow);
        font(lc, { bold: isNet, size: isNet ? 11 : 10, color: C.textGreen });
        font(vc, { bold: isNet, size: isNet ? 13 : 11, color: C.textGreen });
        align(vc, 'right');
        ws4.getRow(rn).height = isNet ? 28 : 22;
      });

      ws4.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // ─── Send file ────────────────────────────────────────────────────────────
    const safeName = dateRange.replace(/[^a-zA-Z0-9\-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AgthiaPettyCash_${safeName}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

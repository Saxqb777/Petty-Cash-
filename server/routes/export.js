const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db/database');

const router = express.Router();

// ── Palette (Agthia sage-green brand) ───────────────────────────────────────────
const C = {
  ink:      'FF0F172A', // slate-900 — title bar
  brand:    'FF62833A', // brand-600 — column headers
  brandDk:  'FF3E532A', // brand-800 — grand totals
  brandLt:  'FFEAF1DC', // pale green — section bands / subtotals
  zebra:    'FFF8FAFC', // slate-50 — alternating rows
  amber:    'FFFEF3C7', // foreign-currency highlight
  line:     'FFE2E8F0', // slate-200 — gridlines
  white:    'FFFFFFFF',
  textDark: 'FF1E293B', // slate-800
  textMute: 'FF64748B', // slate-500
  green:    'FF4C6730', // brand-700 — amounts / accents
};

const MONEY = '#,##0.00';
const FONT = 'Calibri';

const fill  = (cell, argb) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
const font  = (cell, o = {}) => { cell.font = { name: FONT, size: o.size || 10, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || C.textDark } }; };
const align = (cell, h = 'left', v = 'middle', wrap = false) => { cell.alignment = { horizontal: h, vertical: v, wrapText: wrap }; };
const bottomRule = (cell, argb = C.line) => { cell.border = { bottom: { style: 'thin', color: { argb } } }; };

const fmtMoney = n => parseFloat(n || 0);
const typeLabel = t => t === 'adnoc' ? 'Petrol & Fuel' : t === 'shipping' ? 'Shipping Bill' : 'General';
const aed = n => `AED ${parseFloat(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Style a worksheet header row (row 1): brand fill, white bold, frozen + filtered
function styleHeaderRow(ws, headers) {
  const row = ws.getRow(1);
  row.height = 26;
  row.eachCell((cell, i) => {
    cell.value = headers[i - 1];
    fill(cell, C.brand);
    font(cell, { bold: true, size: 10, color: C.white });
    align(cell, 'center', 'middle', true);
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

router.get('/', async (req, res) => {
  try {
    const { from, to, type = 'all' } = req.query;
    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // ── period clause builder (parameterised) ───────────────────────────────────
    const periodClause = (col = 'date') => {
      let c = ''; const params = [];
      if (type === 'this_month') { c = ` AND strftime('%Y-%m', ${col}) = ?`; params.push(thisYM); }
      else if (type === 'custom') {
        if (from) { c += ` AND ${col} >= ?`; params.push(from); }
        if (to)   { c += ` AND ${col} <= ?`; params.push(to); }
      }
      return { c, params };
    };

    const exp = periodClause();
    const records = db.prepare(`SELECT * FROM expenses WHERE 1=1${exp.c} ORDER BY date ASC`).all(...exp.params).map(r => ({
      ...r,
      line_items:        JSON.parse(r.line_items        || '[]'),
      container_numbers: JSON.parse(r.container_numbers || '[]'),
      bl_numbers:        JSON.parse(r.bl_numbers        || '[]'),
    }));

    const sav = periodClause();
    const savingsRecords = db.prepare(`SELECT * FROM clearance_savings WHERE 1=1${sav.c} ORDER BY date ASC`).all(...sav.params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Agthia Petty Cash';
    wb.created = now;

    const dateRange = (type === 'custom' && from && to) ? `${from} to ${to}` : type === 'this_month' ? thisYM : 'All Time';
    const totalAED  = records.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 1 — Summary  (clean 4-column grid: A label/name · B count · C amount · D %)
    // ═══════════════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
    ws1.columns = [{ width: 38 }, { width: 16 }, { width: 18 }, { width: 12 }];

    // Title bar
    ws1.mergeCells('A1:D1');
    const title = ws1.getCell('A1');
    title.value = 'AGTHIA GROUP   —   PETTY CASH REPORT';
    fill(title, C.ink);
    font(title, { bold: true, size: 14, color: C.white });
    align(title, 'left', 'middle');
    ws1.getRow(1).height = 40;

    ws1.mergeCells('A2:D2');
    const subtitle = ws1.getCell('A2');
    subtitle.value = `Period: ${dateRange}     ·     Generated ${now.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}     ·     ${records.length} transactions`;
    fill(subtitle, C.brandDk);
    font(subtitle, { size: 9, color: C.white, italic: true });
    align(subtitle, 'left', 'middle');
    ws1.getRow(2).height = 20;
    ws1.getRow(3).height = 8;

    // section band helper
    const band = (rowNum, text) => {
      ws1.mergeCells(`A${rowNum}:D${rowNum}`);
      const c = ws1.getCell(`A${rowNum}`);
      c.value = text;
      fill(c, C.brandLt);
      font(c, { bold: true, size: 10, color: C.green });
      align(c, 'left', 'middle');
      ws1.getRow(rowNum).height = 22;
    };

    // KEY METRICS
    let r = 4;
    band(r, '  KEY METRICS'); r++;
    const foreignCount  = records.filter(x => x.currency && x.currency !== 'AED').length;
    const shippingCount = records.filter(x => x.expense_type === 'shipping').length;
    const fuelCount     = records.filter(x => x.expense_type === 'adnoc').length;
    const generalCount  = records.filter(x => x.expense_type === 'general' || !x.expense_type).length;

    const metrics = [
      ['Total Spent',              aed(totalAED)],
      ['Total Transactions',       String(records.length)],
      ['Average Transaction',      aed(totalAED / (records.length || 1))],
      ['Shipping Bills',           String(shippingCount)],
      ['Petrol & Fuel Records',    String(fuelCount)],
      ['General Expenses',         String(generalCount)],
      ['Foreign-Currency Records', String(foreignCount)],
    ];
    metrics.forEach(([label, val], i) => {
      const rn = r + i;
      ws1.mergeCells(`A${rn}:B${rn}`);
      ws1.mergeCells(`C${rn}:D${rn}`);
      const lc = ws1.getCell(`A${rn}`);
      const vc = ws1.getCell(`C${rn}`);
      lc.value = '   ' + label;
      vc.value = val;
      font(lc, { size: 10, color: C.textMute });
      font(vc, { size: 11, bold: true, color: C.green });
      align(lc, 'left', 'middle');
      align(vc, 'right', 'middle');
      if (i % 2 === 0) { fill(lc, C.zebra); fill(vc, C.zebra); }
      bottomRule(lc); bottomRule(vc);
      ws1.getRow(rn).height = 20;
    });
    r += metrics.length + 1;

    // breakdown table helper
    const breakdownTable = (label, rows) => {
      band(r, label); r++;
      const head = ['', 'Transactions', 'Amount (AED)', '% of Total'];
      const hr = ws1.getRow(r);
      ['A', 'B', 'C', 'D'].forEach((col, ci) => {
        const cell = ws1.getCell(`${col}${r}`);
        cell.value = head[ci];
        fill(cell, C.brand);
        font(cell, { bold: true, size: 9, color: C.white });
        align(cell, ci === 0 ? 'left' : 'right', 'middle');
      });
      hr.getCell(1).value = label.trim().replace(/^SPEND BY /, '');
      align(hr.getCell(1), 'left', 'middle');
      hr.height = 20;
      r++;
      rows.forEach((row, i) => {
        const cur = ws1.getRow(r);
        const a = ws1.getCell(`A${r}`); a.value = row.name || '—'; font(a, { size: 10 });
        const b = ws1.getCell(`B${r}`); b.value = row.cnt; align(b, 'right'); font(b, { size: 10 });
        const c = ws1.getCell(`C${r}`); c.value = fmtMoney(row.total); c.numFmt = MONEY; align(c, 'right'); font(c, { size: 10 });
        const d = ws1.getCell(`D${r}`); d.value = totalAED > 0 ? (row.total / totalAED) : 0; d.numFmt = '0.0%'; align(d, 'right'); font(d, { size: 10, color: C.textMute });
        if (i % 2 === 0) ['A', 'B', 'C', 'D'].forEach(col => fill(ws1.getCell(`${col}${r}`), C.zebra));
        cur.height = 18;
        r++;
      });
      r++;
    };

    const catData = db.prepare(`SELECT category as name, COUNT(*) as cnt, SUM(COALESCE(amount_aed,amount)) as total FROM expenses WHERE 1=1${exp.c} GROUP BY category ORDER BY total DESC`).all(...exp.params);
    breakdownTable('  SPEND BY CATEGORY', catData);

    const typeData = db.prepare(`SELECT expense_type as name, COUNT(*) as cnt, SUM(COALESCE(amount_aed,amount)) as total FROM expenses WHERE 1=1${exp.c} GROUP BY expense_type ORDER BY total DESC`).all(...exp.params)
      .map(x => ({ ...x, name: typeLabel(x.name) }));
    breakdownTable('  SPEND BY TYPE', typeData);

    const buData = db.prepare(`SELECT business_unit as name, COUNT(*) as cnt, SUM(COALESCE(amount_aed,amount)) as total FROM expenses WHERE 1=1${exp.c} GROUP BY business_unit ORDER BY total DESC`).all(...exp.params);
    breakdownTable('  SPEND BY BUSINESS UNIT', buData);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 2 — All Expenses  (one clean row per expense)
    // ═══════════════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('All Expenses', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }, views: [{ showGridLines: false }] });
    const expCols = [
      { key: 'sr',      header: 'Sr.',               width: 5  },
      { key: 'date',    header: 'Date',              width: 12 },
      { key: 'invoice', header: 'Invoice No.',       width: 15 },
      { key: 'vendor',  header: 'Vendor / Supplier', width: 26 },
      { key: 'type',    header: 'Type',              width: 14 },
      { key: 'cat',     header: 'Category',          width: 20 },
      { key: 'bu',      header: 'BU',                width: 10 },
      { key: 'purpose', header: 'Purpose / Route',   width: 30 },
      { key: 'pay',     header: 'Payment',           width: 10 },
      { key: 'sub',     header: 'Submitted By',      width: 16 },
      { key: 'curr',    header: 'Curr.',             width: 8  },
      { key: 'rate',    header: 'Rate',              width: 8  },
      { key: 'orig',    header: 'Orig. Amount',      width: 14 },
      { key: 'aedAmt',  header: 'AED Amount',        width: 14 },
      { key: 'port',    header: 'Port',              width: 8  },
      { key: 'ie',      header: 'I/E',               width: 8  },
      { key: 'bl',      header: 'BL Numbers',        width: 22 },
      { key: 'conts',   header: 'Containers',        width: 24 },
      { key: 'notes',   header: 'Notes',             width: 26 },
    ];
    ws2.columns = expCols.map(c => ({ key: c.key, width: c.width }));
    styleHeaderRow(ws2, expCols.map(c => c.header));

    records.forEach((rec, ri) => {
      const isEven = ri % 2 === 0;
      const isForeign = rec.currency && rec.currency !== 'AED';
      const bls   = rec.bl_numbers?.length ? rec.bl_numbers.join(', ') : (rec.bl_number || '');
      const conts = rec.container_numbers?.length ? rec.container_numbers.join(', ') : (rec.container_number || '');
      const row = ws2.addRow({
        sr: ri + 1, date: rec.date, invoice: rec.invoice_number || '',
        vendor: rec.vendor_name, type: typeLabel(rec.expense_type),
        cat: rec.category, bu: rec.business_unit || '',
        purpose: rec.purpose || '', pay: rec.payment_method || '',
        sub: rec.submitted_by || '', curr: rec.currency || 'AED',
        rate: rec.exchange_rate && rec.exchange_rate !== 1 ? rec.exchange_rate : '',
        orig: fmtMoney(rec.amount), aedAmt: fmtMoney(rec.amount_aed || rec.amount),
        port: rec.port || '', ie: rec.shipment_type || '',
        bl: bls, conts, notes: rec.notes || '',
      });
      row.eachCell(cell => { font(cell, { size: 10 }); align(cell, 'left', 'middle'); if (isEven) fill(cell, C.zebra); });
      ['sr', 'curr', 'rate', 'port', 'ie'].forEach(k => align(row.getCell(k), 'center', 'middle'));
      const o = row.getCell('orig'); o.numFmt = MONEY; align(o, 'right', 'middle'); if (isForeign) fill(o, C.amber);
      const a = row.getCell('aedAmt'); a.numFmt = MONEY; font(a, { bold: true, size: 10, color: C.green }); align(a, 'right', 'middle');
      row.height = 18;
    });

    const tr2 = ws2.addRow({ vendor: 'TOTAL', pay: `${records.length} records`, aedAmt: fmtMoney(totalAED) });
    tr2.eachCell(cell => { fill(cell, C.brandLt); font(cell, { bold: true, color: C.green }); align(cell, 'left', 'middle'); });
    const ta = tr2.getCell('aedAmt'); ta.numFmt = MONEY; align(ta, 'right', 'middle');
    tr2.height = 24;

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 3 — Shipping Details  (charge breakdown grouped per bill)
    // ═══════════════════════════════════════════════════════════════════════════
    const shippingRecs = records.filter(x => x.expense_type === 'shipping');
    if (shippingRecs.length > 0) {
      const ws3 = wb.addWorksheet('Shipping Details', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }, views: [{ showGridLines: false }] });
      const shipCols = [
        { key: 'date',    header: 'Date',           width: 12 },
        { key: 'vendor',  header: 'Vendor / Agent', width: 24 },
        { key: 'invoice', header: 'Invoice',        width: 15 },
        { key: 'bls',     header: 'BL Numbers',     width: 24 },
        { key: 'conts',   header: 'Containers',     width: 26 },
        { key: 'nConts',  header: '# Cont.',        width: 8  },
        { key: 'port',    header: 'Port',           width: 8  },
        { key: 'ie',      header: 'I/E',            width: 8  },
        { key: 'bu',      header: 'BU',             width: 10 },
        { key: 'charge',  header: 'Charge Type',    width: 28 },
        { key: 'amount',  header: 'Amount (AED)',   width: 15 },
      ];
      ws3.columns = shipCols.map(c => ({ key: c.key, width: c.width }));
      styleHeaderRow(ws3, shipCols.map(c => c.header));

      let grandTotal = 0;
      shippingRecs.forEach((rec, ri) => {
        const isEven = ri % 2 === 0;
        const bls   = rec.bl_numbers?.length ? rec.bl_numbers.join(', ') : (rec.bl_number || '');
        const conts = rec.container_numbers?.length ? rec.container_numbers.join(', ') : (rec.container_number || '');
        const nConts = rec.container_numbers?.length || (rec.container_number ? 1 : 0);
        const charges = (rec.line_items || []).filter(li => parseFloat(li.amount || 0) > 0);

        const headerInfo = (i) => i === 0
          ? { date: rec.date, vendor: rec.vendor_name, invoice: rec.invoice_number || '', bls, conts, nConts: nConts || '', port: rec.port || '', ie: rec.shipment_type || '', bu: rec.business_unit || '' }
          : { date: '', vendor: '', invoice: '', bls: '', conts: '', nConts: '', port: '', ie: '', bu: '' };

        if (charges.length === 0) {
          const row = ws3.addRow({ ...headerInfo(0), charge: 'Total', amount: fmtMoney(rec.amount_aed || rec.amount) });
          row.eachCell(cell => { font(cell, { size: 10 }); align(cell, 'left', 'middle'); if (isEven) fill(cell, C.zebra); });
          const am = row.getCell('amount'); am.numFmt = MONEY; align(am, 'right', 'middle'); font(am, { size: 10, color: C.green });
          align(row.getCell('nConts'), 'center'); align(row.getCell('port'), 'center'); align(row.getCell('ie'), 'center');
          row.height = 18;
          grandTotal += rec.amount_aed || rec.amount || 0;
        } else {
          charges.forEach((li, i) => {
            const row = ws3.addRow({ ...headerInfo(i), charge: li.label || li.name || 'Charge', amount: fmtMoney(li.amount) });
            row.eachCell(cell => { font(cell, { size: 10 }); align(cell, 'left', 'middle'); if (isEven) fill(cell, C.zebra); });
            const am = row.getCell('amount'); am.numFmt = MONEY; align(am, 'right', 'middle'); font(am, { size: 10, color: C.green });
            align(row.getCell('nConts'), 'center'); align(row.getCell('port'), 'center'); align(row.getCell('ie'), 'center');
            row.height = i === 0 ? 19 : 17;
          });
          const billAmt = rec.amount_aed || rec.amount || 0;
          const subTot = ws3.addRow({ charge: 'Bill Total', amount: fmtMoney(billAmt) });
          subTot.eachCell(cell => { fill(cell, C.brandLt); font(cell, { bold: true, size: 10, color: C.green }); });
          align(subTot.getCell('charge'), 'right', 'middle');
          const sa = subTot.getCell('amount'); sa.numFmt = MONEY; align(sa, 'right', 'middle');
          subTot.height = 18;
          grandTotal += billAmt;
        }
      });

      const gRow = ws3.addRow({ vendor: 'GRAND TOTAL', amount: fmtMoney(grandTotal) });
      gRow.eachCell(cell => { fill(cell, C.brandDk); font(cell, { bold: true, size: 11, color: C.white }); align(cell, 'left', 'middle'); });
      const ga = gRow.getCell('amount'); ga.numFmt = MONEY; align(ga, 'right', 'middle');
      gRow.height = 26;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 4 — Savings Report  (grouped by month, with net-savings box)
    // ═══════════════════════════════════════════════════════════════════════════
    if (savingsRecords.length > 0) {
      const ws4 = wb.addWorksheet('Savings Report', { views: [{ showGridLines: false }] });
      const savCols = [
        { key: 'date', header: 'Date',           width: 12 },
        { key: 'bu',   header: 'BU',             width: 10 },
        { key: 'port', header: 'Port',           width: 8  },
        { key: 'ref',  header: 'Reference',      width: 20 },
        { key: 'ie',   header: 'I/E',            width: 8  },
        { key: 'prev', header: 'Previous Agent', width: 22 },
        { key: 'curr', header: 'Current Agent',  width: 22 },
        { key: 'old',  header: 'Old Fee (AED)',  width: 14 },
        { key: 'new',  header: 'New Fee (AED)',  width: 14 },
        { key: 'sav',  header: 'Savings (AED)',  width: 14 },
        { key: 'proj', header: 'Project',        width: 20 },
        { key: 'desc', header: 'Description',    width: 30 },
      ];
      ws4.columns = savCols.map(c => ({ key: c.key, width: c.width }));
      styleHeaderRow(ws4, savCols.map(c => c.header));
      const NCOL = savCols.length;

      const byMonth = {};
      savingsRecords.forEach(rec => {
        const m = rec.month || (rec.date ? rec.date.substring(0, 7) : 'Unknown');
        (byMonth[m] = byMonth[m] || []).push(rec);
      });

      const moneyCols = ['old', 'new', 'sav'];
      Object.keys(byMonth).sort().forEach(month => {
        const recs = byMonth[month];
        const startRow = (ws4.lastRow?.number || 1) + 1;
        ws4.mergeCells(startRow, 1, startRow, NCOL);
        const banner = ws4.getCell(startRow, 1);
        banner.value = `  ${month}`;
        fill(banner, C.brandLt);
        font(banner, { bold: true, size: 10, color: C.green });
        align(banner, 'left', 'middle');
        ws4.getRow(startRow).height = 22;

        recs.forEach((rec, i) => {
          const row = ws4.addRow({
            date: rec.date, bu: rec.business_unit || '', port: rec.port || '',
            ref: rec.reference_number || '', ie: rec.import_export || '',
            prev: rec.previous_agent || '', curr: rec.current_agent || '',
            old: fmtMoney(rec.old_fee), new: fmtMoney(rec.new_fee), sav: fmtMoney(rec.savings),
            proj: rec.project_name || '', desc: rec.description || '',
          });
          row.eachCell(cell => { font(cell, { size: 10 }); align(cell, 'left', 'middle'); if (i % 2 === 0) fill(cell, C.zebra); });
          align(row.getCell('port'), 'center'); align(row.getCell('ie'), 'center');
          moneyCols.forEach(k => {
            const cell = row.getCell(k); cell.numFmt = MONEY; align(cell, 'right', 'middle');
            if (k === 'sav') font(cell, { bold: true, size: 10, color: C.green });
          });
          row.height = 18;
        });

        const mt = recs.reduce((a, x) => ({ old: a.old + (x.old_fee || 0), new: a.new + (x.new_fee || 0), sav: a.sav + (x.savings || 0) }), { old: 0, new: 0, sav: 0 });
        const mRow = ws4.addRow({ date: 'Month Total', old: fmtMoney(mt.old), new: fmtMoney(mt.new), sav: fmtMoney(mt.sav) });
        mRow.eachCell(cell => { fill(cell, C.brandLt); font(cell, { bold: true, color: C.green }); align(cell, 'left', 'middle'); });
        moneyCols.forEach(k => { mRow.getCell(k).numFmt = MONEY; align(mRow.getCell(k), 'right', 'middle'); });
        mRow.height = 20;
      });

      const gt = savingsRecords.reduce((a, x) => ({ old: a.old + (x.old_fee || 0), new: a.new + (x.new_fee || 0), sav: a.sav + (x.savings || 0) }), { old: 0, new: 0, sav: 0 });
      const gRow = ws4.addRow({ date: 'GRAND TOTAL', old: fmtMoney(gt.old), new: fmtMoney(gt.new), sav: fmtMoney(gt.sav) });
      gRow.eachCell(cell => { fill(cell, C.brandDk); font(cell, { bold: true, size: 11, color: C.white }); align(cell, 'left', 'middle'); });
      moneyCols.forEach(k => { gRow.getCell(k).numFmt = MONEY; align(gRow.getCell(k), 'right', 'middle'); });
      gRow.height = 26;

      // Net-savings box
      const fuel = periodClause();
      const fuelCost = db.prepare(`SELECT COALESCE(SUM(COALESCE(amount_aed,amount)),0) as f FROM expenses WHERE expense_type='adnoc'${fuel.c}`).get(...fuel.params).f;

      let bs = (ws4.lastRow.number) + 2;
      [
        ['Gross Agent-Fee Savings', aed(gt.sav), false],
        ['Self-Clearance Fuel Cost', `(${aed(fuelCost)})`, false],
        ['NET SAVINGS', aed(gt.sav - fuelCost), true],
      ].forEach(([label, val, isNet]) => {
        ws4.mergeCells(bs, 1, bs, 6);
        ws4.mergeCells(bs, 7, bs, NCOL);
        const lc = ws4.getCell(bs, 1);
        const vc = ws4.getCell(bs, 7);
        lc.value = '  ' + label;
        vc.value = val;
        fill(lc, isNet ? C.brandDk : C.zebra);
        fill(vc, isNet ? C.brandDk : C.zebra);
        font(lc, { bold: isNet, size: isNet ? 12 : 10, color: isNet ? C.white : C.textMute });
        font(vc, { bold: true, size: isNet ? 13 : 11, color: isNet ? C.white : C.green });
        align(lc, 'left', 'middle');
        align(vc, 'right', 'middle');
        ws4.getRow(bs).height = isNet ? 28 : 22;
        bs++;
      });
    }

    // ─── Send ───────────────────────────────────────────────────────────────────
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

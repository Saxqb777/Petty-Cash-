const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db/database');

const router = express.Router();

// Color constants
const CLR = {
  darkHeader:  '0d1117',
  greenHeader: '166534',
  greenLight:  'f0fdf4',
  evenRow:     'f8fafc',
  totalRow:    'dcfce7',
  amber:       'fef3c7',
  white:       'FFFFFFFF',
  darkText:    'FF0d1117',
  greenText:   'FF166534',
};

function argb(hex) { return hex.startsWith('FF') || hex.length === 8 ? hex : 'FF' + hex; }

function applyFill(cell, hex) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } };
}

function applyFont(cell, opts = {}) {
  cell.font = {
    name: 'Calibri',
    size: opts.size || 10,
    bold: opts.bold || false,
    color: { argb: opts.color || 'FF000000' },
  };
}

function applyAlignment(cell, h = 'left', v = 'middle', wrap = false) {
  cell.alignment = { horizontal: h, vertical: v, wrapText: wrap };
}

function titleHeader(cell, text) {
  cell.value = text;
  applyFill(cell, CLR.darkHeader);
  applyFont(cell, { size: 13, bold: true, color: CLR.white });
  applyAlignment(cell, 'center');
}

function colHeader(cell, text) {
  cell.value = text;
  applyFill(cell, CLR.greenHeader);
  applyFont(cell, { size: 10, bold: true, color: CLR.white });
  applyAlignment(cell, 'center');
  cell.border = { bottom: { style: 'medium', color: { argb: 'FF16a34a' } } };
}

function sectionTitle(cell, text) {
  cell.value = text;
  applyFill(cell, CLR.greenLight);
  applyFont(cell, { size: 10, bold: true, color: CLR.greenHeader });
  applyAlignment(cell, 'left');
}

function totalRowStyle(row) {
  row.eachCell(cell => {
    applyFill(cell, CLR.totalRow);
    applyFont(cell, { bold: true, color: CLR.greenHeader });
    applyAlignment(cell, 'left');
  });
}

function dataRow(row, isEven) {
  row.eachCell(cell => {
    if (isEven) applyFill(cell, CLR.evenRow);
    applyFont(cell, { size: 10 });
    applyAlignment(cell, 'left', 'middle');
  });
}

const fmt2 = n => parseFloat(n || 0).toFixed(2);
const pct = (n, total) => total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '0%';

router.get('/', async (req, res) => {
  try {
    const { from, to, category, business_unit, type = 'all' } = req.query;

    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (type === 'this_month') {
      query += " AND strftime('%Y-%m', date) = ?";
      params.push(thisYM);
    } else if (type === 'custom') {
      if (from) { query += ' AND date >= ?'; params.push(from); }
      if (to) { query += ' AND date <= ?'; params.push(to); }
    }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (business_unit) { query += ' AND business_unit = ?'; params.push(business_unit); }
    query += ' ORDER BY date ASC';

    const records = db.prepare(query).all(...params).map(r => ({
      ...r,
      line_items: JSON.parse(r.line_items || '[]'),
      container_numbers: JSON.parse(r.container_numbers || '[]'),
      bl_numbers: JSON.parse(r.bl_numbers || '[]'),
    }));

    // Savings records in range
    let savingsQ = 'SELECT * FROM clearance_savings WHERE 1=1';
    const savingsP = [];
    if (type === 'this_month') { savingsQ += " AND strftime('%Y-%m', date) = ?"; savingsP.push(thisYM); }
    else if (type === 'custom') {
      if (from) { savingsQ += ' AND date >= ?'; savingsP.push(from); }
      if (to) { savingsQ += ' AND date <= ?'; savingsP.push(to); }
    }
    savingsQ += ' ORDER BY date ASC';
    const savingsRecords = db.prepare(savingsQ).all(...savingsP);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Agthia Petty Cash';
    wb.created = now;

    const dateRange = from && to ? `${from} to ${to}` :
      type === 'this_month' ? thisYM : 'All Time';

    const totalAED = records.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0);

    // ─── Sheet 1: Summary ────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Summary');
    ws1.columns = [
      { key: 'a', width: 32 },
      { key: 'b', width: 20 },
      { key: 'c', width: 18 },
      { key: 'd', width: 18 },
      { key: 'e', width: 18 },
      { key: 'f', width: 18 },
    ];

    // Row 1: Company header
    ws1.mergeCells('A1:F1');
    titleHeader(ws1.getCell('A1'), 'AGTHIA GROUP — PETTY CASH EXPENSE REPORT');
    ws1.getRow(1).height = 36;

    // Row 2: Sub-header
    ws1.mergeCells('A2:F2');
    const subCell = ws1.getCell('A2');
    subCell.value = `Period: ${dateRange}   |   Generated: ${now.toLocaleDateString('en-AE')}   |   Total Records: ${records.length}`;
    applyFill(subCell, '1a2332');
    applyFont(subCell, { size: 9, color: 'FFaaaaaa' });
    applyAlignment(subCell, 'center');
    ws1.getRow(2).height = 20;

    // Row 3: Blank
    ws1.getRow(3).height = 8;

    // Row 4: KEY METRICS section
    ws1.mergeCells('A4:F4');
    sectionTitle(ws1.getCell('A4'), '  KEY METRICS');
    ws1.getRow(4).height = 22;

    const foreignCount = records.filter(r => r.currency !== 'AED').length;
    const thisMonthRecs = records.filter(r => r.date && r.date.startsWith(thisYM));
    const thisMonthAED = thisMonthRecs.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0);

    const metrics = [
      ['Total Spent (AED)', `AED ${parseFloat(totalAED).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Total Transactions', records.length.toString()],
      ['Avg Transaction (AED)', `AED ${(totalAED / (records.length || 1)).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Foreign Currency Records', foreignCount.toString()],
      [`This Month (${thisYM}) AED`, `AED ${thisMonthAED.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ];

    metrics.forEach(([label, val], i) => {
      const rowNum = 5 + i;
      ws1.mergeCells(`A${rowNum}:C${rowNum}`);
      ws1.mergeCells(`D${rowNum}:F${rowNum}`);
      const lCell = ws1.getCell(`A${rowNum}`);
      const vCell = ws1.getCell(`D${rowNum}`);
      lCell.value = label;
      vCell.value = val;
      applyFont(lCell, { size: 10 });
      applyFont(vCell, { size: 11, bold: true, color: CLR.greenHeader });
      applyAlignment(lCell, 'left', 'middle');
      applyAlignment(vCell, 'right', 'middle');
      if (i % 2 === 0) { applyFill(lCell, CLR.evenRow); applyFill(vCell, CLR.evenRow); }
      ws1.getRow(rowNum).height = 20;
    });

    // Blank row
    ws1.getRow(10).height = 12;

    // SPEND BY CATEGORY
    ws1.mergeCells('A11:F11');
    sectionTitle(ws1.getCell('A11'), '  SPEND BY CATEGORY');
    ws1.getRow(11).height = 22;

    // Category header
    ['Category', 'Transactions', 'Amount (AED)', '% of Total'].forEach((h, ci) => {
      const col = ['A', 'C', 'D', 'F'][ci];
      if (ci === 0) ws1.mergeCells('A12:B12');
      if (ci === 2) ws1.mergeCells('D12:E12');
      const cell = ws1.getCell(col + '12');
      colHeader(cell, h);
    });
    ws1.getCell('F12').value = '% of Total';
    ws1.getRow(12).height = 22;

    const catBreakdown = db.prepare(`
      SELECT category, COUNT(*) as count, SUM(COALESCE(amount_aed, amount)) as total
      FROM expenses WHERE 1=1
      ${type === 'this_month' ? "AND strftime('%Y-%m', date) = '" + thisYM + "'" : ''}
      ${type === 'custom' && from ? "AND date >= '" + from + "'" : ''}
      ${type === 'custom' && to ? "AND date <= '" + to + "'" : ''}
      GROUP BY category ORDER BY total DESC
    `).all();

    catBreakdown.forEach((c, i) => {
      const rn = 13 + i;
      ws1.mergeCells(`A${rn}:B${rn}`);
      ws1.mergeCells(`D${rn}:E${rn}`);
      ws1.getCell(`A${rn}`).value = c.category;
      ws1.getCell(`C${rn}`).value = c.count;
      ws1.getCell(`D${rn}`).value = parseFloat(c.total).toFixed(2);
      ws1.getCell(`F${rn}`).value = pct(c.total, totalAED);
      if (i % 2 === 0) {
        ['A', 'C', 'D', 'F'].forEach(col => applyFill(ws1.getCell(col + rn), CLR.evenRow));
      }
      ws1.getRow(rn).height = 18;
    });

    const catEndRow = 13 + catBreakdown.length;
    ws1.getRow(catEndRow).height = 12;

    // SPEND BY BUSINESS UNIT
    const buStartRow = catEndRow + 1;
    ws1.mergeCells(`A${buStartRow}:F${buStartRow}`);
    sectionTitle(ws1.getCell(`A${buStartRow}`), '  SPEND BY BUSINESS UNIT');
    ws1.getRow(buStartRow).height = 22;

    const buHeaderRow = buStartRow + 1;
    ['Business Unit', 'Transactions', 'Amount (AED)', '% of Total'].forEach((h, ci) => {
      const col = ['A', 'C', 'D', 'F'][ci];
      if (ci === 0) { try { ws1.mergeCells(`A${buHeaderRow}:B${buHeaderRow}`); } catch (_) {} }
      if (ci === 2) { try { ws1.mergeCells(`D${buHeaderRow}:E${buHeaderRow}`); } catch (_) {} }
      const cell = ws1.getCell(col + buHeaderRow);
      colHeader(cell, h);
    });
    ws1.getRow(buHeaderRow).height = 22;

    const buBreakdown = db.prepare(`
      SELECT business_unit, COUNT(*) as count, SUM(COALESCE(amount_aed, amount)) as total
      FROM expenses WHERE 1=1
      ${type === 'this_month' ? "AND strftime('%Y-%m', date) = '" + thisYM + "'" : ''}
      ${type === 'custom' && from ? "AND date >= '" + from + "'" : ''}
      ${type === 'custom' && to ? "AND date <= '" + to + "'" : ''}
      GROUP BY business_unit ORDER BY total DESC
    `).all();

    buBreakdown.forEach((b, i) => {
      const rn = buHeaderRow + 1 + i;
      try { ws1.mergeCells(`A${rn}:B${rn}`); } catch (_) {}
      try { ws1.mergeCells(`D${rn}:E${rn}`); } catch (_) {}
      ws1.getCell(`A${rn}`).value = b.business_unit || '—';
      ws1.getCell(`C${rn}`).value = b.count;
      ws1.getCell(`D${rn}`).value = parseFloat(b.total).toFixed(2);
      ws1.getCell(`F${rn}`).value = pct(b.total, totalAED);
      if (i % 2 === 0) {
        ['A', 'C', 'D', 'F'].forEach(col => applyFill(ws1.getCell(col + rn), CLR.evenRow));
      }
      ws1.getRow(rn).height = 18;
    });

    // ─── Sheet 2: All Expenses ───────────────────────────────────────────────
    const ws2 = wb.addWorksheet('All Expenses', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    const expCols = [
      { header: 'Sr.No',              key: 'sr',             width: 7  },
      { header: 'Date',               key: 'date',           width: 13 },
      { header: 'Invoice No.',        key: 'invoice',        width: 16 },
      { header: 'Vendor / Supplier',  key: 'vendor',         width: 26 },
      { header: 'Type',               key: 'type',           width: 16 },
      { header: 'Category',           key: 'category',       width: 22 },
      { header: 'Business Unit',      key: 'bu',             width: 15 },
      { header: 'Currency',           key: 'currency',       width: 10 },
      { header: 'Original Amount',    key: 'orig_amount',    width: 16 },
      { header: 'AED Amount',         key: 'aed_amount',     width: 16 },
      { header: 'Payment Method',     key: 'payment',        width: 16 },
      { header: 'Purpose',            key: 'purpose',        width: 36 },
      { header: 'Submitted By',       key: 'submitted_by',   width: 18 },
      { header: 'Notes',              key: 'notes',          width: 28 },
      { header: 'BL / Reference',     key: 'bl',             width: 22 },
      { header: 'Containers',         key: 'containers',     width: 26 },
    ];

    ws2.columns = expCols;

    // Style header row
    ws2.getRow(1).eachCell((cell, ci) => {
      colHeader(cell, expCols[ci - 1].header);
    });
    ws2.getRow(1).height = 28;

    const typeLabel = (t) => {
      if (t === 'adnoc') return 'Petrol & Fuel';
      if (t === 'shipping') return 'Shipping Bill';
      return 'General';
    };

    records.forEach((r, i) => {
      const isEven = i % 2 === 0;
      const isForeign = r.currency && r.currency !== 'AED';
      const bls = Array.isArray(r.bl_numbers) && r.bl_numbers.length > 0
        ? r.bl_numbers.join(', ')
        : (r.bl_number || '');
      const conts = Array.isArray(r.container_numbers) && r.container_numbers.length > 0
        ? r.container_numbers.join(', ')
        : (r.container_number || '');

      const row = ws2.addRow({
        sr: i + 1,
        date: r.date,
        invoice: r.invoice_number || '',
        vendor: r.vendor_name,
        type: typeLabel(r.expense_type),
        category: r.category,
        bu: r.business_unit || '',
        currency: r.currency || 'AED',
        orig_amount: parseFloat(r.amount || 0),
        aed_amount: parseFloat(r.amount_aed || r.amount || 0),
        payment: r.payment_method || '',
        purpose: r.purpose || '',
        submitted_by: r.submitted_by || '',
        notes: r.notes || '',
        bl: bls,
        containers: conts,
      });

      row.eachCell(cell => {
        applyFont(cell, { size: 10 });
        applyAlignment(cell, 'left', 'middle', false);
        if (isEven) applyFill(cell, CLR.evenRow);
      });

      // Right-align and format amount columns
      const origCell = row.getCell('orig_amount');
      origCell.numFmt = '#,##0.00';
      applyAlignment(origCell, 'right', 'middle');
      if (isForeign) applyFill(origCell, CLR.amber);

      const aedCell = row.getCell('aed_amount');
      aedCell.numFmt = '#,##0.00';
      applyFont(aedCell, { size: 10, bold: true });
      applyAlignment(aedCell, 'right', 'middle');

      row.height = 18;
    });

    // Total row
    const totalRow2 = ws2.addRow({
      sr: '',
      date: '',
      invoice: '',
      vendor: 'TOTAL',
      type: '',
      category: '',
      bu: '',
      currency: '',
      orig_amount: '',
      aed_amount: records.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0),
      payment: `${records.length} records`,
    });
    totalRowStyle(totalRow2);
    const tr2aed = totalRow2.getCell('aed_amount');
    tr2aed.numFmt = '#,##0.00';
    applyAlignment(tr2aed, 'right', 'middle');
    totalRow2.height = 24;

    // Freeze + autofilter
    ws2.views = [{ state: 'frozen', ySplit: 1 }];
    ws2.autoFilter = { from: 'A1', to: { row: 1, column: expCols.length } };

    // ─── Sheet 3: Shipping Details ───────────────────────────────────────────
    const ws3 = wb.addWorksheet('Shipping Details', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    const STANDARD_CHARGES = [
      'Ocean Freight', 'THC (Terminal Handling)', 'Demurrage', 'Detention',
      'Documentation Fee', 'BOE / Customs Clearance', 'MOIAT Fee', 'Agent Fee',
      'Customs Duty', 'Inspection Fee', 'Transport / Delivery', 'Port Charges', 'Local Charges'
    ];

    const shipCols = [
      { header: 'Invoice',          key: 'invoice',  width: 18 },
      { header: 'Shipping Line',    key: 'vendor',   width: 24 },
      { header: 'Date',             key: 'date',     width: 13 },
      { header: 'BU',               key: 'bu',       width: 12 },
      { header: 'Port',             key: 'port',     width: 10 },
      { header: 'I/E',              key: 'ie',       width: 9  },
      { header: 'BL Numbers',       key: 'bls',      width: 26 },
      { header: 'Containers',       key: 'conts',    width: 26 },
      ...STANDARD_CHARGES.map(c => ({ header: c, key: c, width: 16 })),
      { header: 'Other Charges',    key: 'other',    width: 16 },
      { header: 'TOTAL AED',        key: 'total',    width: 16 },
    ];

    ws3.columns = shipCols;
    ws3.getRow(1).eachCell((cell, ci) => {
      colHeader(cell, shipCols[ci - 1]?.header || '');
    });
    ws3.getRow(1).height = 28;

    const shippingRecs = records.filter(r => r.expense_type === 'shipping');
    const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normStd = STANDARD_CHARGES.map(normalize);

    shippingRecs.forEach((r, i) => {
      const isEven = i % 2 === 0;
      const bls = Array.isArray(r.bl_numbers) && r.bl_numbers.length > 0
        ? r.bl_numbers.join(', ')
        : (r.bl_number || '');
      const conts = Array.isArray(r.container_numbers) && r.container_numbers.length > 0
        ? r.container_numbers.join(', ')
        : (r.container_number || '');

      const chargeMap = {};
      let otherTotal = 0;
      if (Array.isArray(r.line_items)) {
        r.line_items.forEach(li => {
          const n = normalize(li.label || li.name || '');
          const idx = normStd.indexOf(n);
          if (idx >= 0) {
            chargeMap[STANDARD_CHARGES[idx]] = parseFloat(li.amount || 0);
          } else {
            otherTotal += parseFloat(li.amount || 0);
          }
        });
      }

      const rowData = {
        invoice: r.invoice_number || '',
        vendor: r.vendor_name,
        date: r.date,
        bu: r.business_unit || '',
        port: r.port || '',
        ie: r.shipment_type || '',
        bls,
        conts,
        other: otherTotal > 0 ? otherTotal : '',
        total: parseFloat(r.amount_aed || r.amount || 0),
      };
      STANDARD_CHARGES.forEach(c => { rowData[c] = chargeMap[c] || ''; });

      const row = ws3.addRow(rowData);
      row.eachCell(cell => {
        applyFont(cell, { size: 10 });
        applyAlignment(cell, 'left', 'middle');
        if (isEven) applyFill(cell, CLR.evenRow);
      });

      // Format numeric charge cells
      const totalIdx = shipCols.findIndex(c => c.key === 'total') + 1;
      const otherIdx = shipCols.findIndex(c => c.key === 'other') + 1;
      for (let ci = 9; ci <= shipCols.length; ci++) {
        const cell = row.getCell(ci);
        if (cell.value !== '') {
          cell.numFmt = '#,##0.00';
          applyAlignment(cell, 'right', 'middle');
        }
      }
      row.getCell(totalIdx).font = { bold: true, size: 10, name: 'Calibri', color: { argb: CLR.greenText } };
      row.height = 18;
    });

    // Shipping total row
    if (shippingRecs.length > 0) {
      const shpTotal = shippingRecs.reduce((s, r) => s + (r.amount_aed || r.amount || 0), 0);
      const shipTotalRow = ws3.addRow({ invoice: 'TOTAL', total: shpTotal });
      totalRowStyle(shipTotalRow);
      const stCell = shipTotalRow.getCell(shipCols.findIndex(c => c.key === 'total') + 1);
      stCell.numFmt = '#,##0.00';
      applyAlignment(stCell, 'right', 'middle');
      applyFont(stCell, { bold: true, color: CLR.greenHeader });
      shipTotalRow.height = 24;
    }

    ws3.views = [{ state: 'frozen', ySplit: 1 }];

    // ─── Sheet 4: Savings Report (optional) ─────────────────────────────────
    if (savingsRecords.length > 0) {
      const ws4 = wb.addWorksheet('Savings Report');
      const savCols = [
        { header: 'Date',             key: 'date',       width: 13 },
        { header: 'Month',            key: 'month',      width: 12 },
        { header: 'BU',               key: 'bu',         width: 10 },
        { header: 'Port',             key: 'port',       width: 10 },
        { header: 'Reference No.',    key: 'ref',        width: 18 },
        { header: 'I/E',              key: 'ie',         width: 9  },
        { header: 'Previous Agent',   key: 'prev',       width: 20 },
        { header: 'Current Agent',    key: 'curr',       width: 20 },
        { header: 'Old Fee (AED)',     key: 'old_fee',    width: 14 },
        { header: 'New Fee (AED)',     key: 'new_fee',    width: 14 },
        { header: 'Savings (AED)',     key: 'savings',    width: 14 },
        { header: 'Project Name',     key: 'project',    width: 20 },
        { header: 'Description',      key: 'desc',       width: 30 },
      ];
      ws4.columns = savCols;

      // Header row
      ws4.getRow(1).eachCell((cell, ci) => {
        colHeader(cell, savCols[ci - 1]?.header || '');
      });
      ws4.getRow(1).height = 28;

      // Group by month
      const byMonth = {};
      savingsRecords.forEach(r => {
        const m = r.month || (r.date ? r.date.substring(0, 7) : 'Unknown');
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push(r);
      });

      let dataRowIdx = 2;
      const allMonths = Object.keys(byMonth).sort();

      allMonths.forEach(month => {
        const recs = byMonth[month];

        // Month header row
        ws4.mergeCells(`A${dataRowIdx}:M${dataRowIdx}`);
        const mCell = ws4.getCell(`A${dataRowIdx}`);
        mCell.value = month;
        applyFill(mCell, CLR.greenLight);
        applyFont(mCell, { bold: true, size: 10, color: CLR.greenHeader });
        applyAlignment(mCell, 'left');
        ws4.getRow(dataRowIdx).height = 22;
        dataRowIdx++;

        recs.forEach((r, i) => {
          const isEven = i % 2 === 0;
          const row = ws4.addRow({
            date: r.date,
            month: r.month || '',
            bu: r.business_unit || '',
            port: r.port || '',
            ref: r.reference_number || '',
            ie: r.import_export || '',
            prev: r.previous_agent || '',
            curr: r.current_agent || '',
            old_fee: parseFloat(r.old_fee || 0),
            new_fee: parseFloat(r.new_fee || 0),
            savings: parseFloat(r.savings || 0),
            project: r.project_name || '',
            desc: r.description || '',
          });
          row.eachCell(cell => {
            applyFont(cell, { size: 10 });
            applyAlignment(cell, 'left', 'middle');
            if (isEven) applyFill(cell, CLR.evenRow);
          });
          ['old_fee', 'new_fee', 'savings'].forEach(k => {
            const ci = savCols.findIndex(c => c.key === k) + 1;
            const cell = row.getCell(ci);
            cell.numFmt = '#,##0.00';
            applyAlignment(cell, 'right', 'middle');
          });
          row.height = 18;
          dataRowIdx++;
        });

        // Monthly subtotal
        const monthTotal = recs.reduce((s, r) => s + (r.savings || 0), 0);
        const subRow = ws4.addRow({
          date: 'Subtotal',
          savings: monthTotal,
        });
        subRow.eachCell(cell => {
          applyFill(cell, CLR.totalRow);
          applyFont(cell, { bold: true, color: CLR.greenHeader });
        });
        const savCI = savCols.findIndex(c => c.key === 'savings') + 1;
        subRow.getCell(savCI).numFmt = '#,##0.00';
        applyAlignment(subRow.getCell(savCI), 'right', 'middle');
        subRow.height = 20;
        dataRowIdx++;
      });

      // Grand totals
      const grandSavings = savingsRecords.reduce((s, r) => s + (r.savings || 0), 0);
      const grandOld = savingsRecords.reduce((s, r) => s + (r.old_fee || 0), 0);
      const grandNew = savingsRecords.reduce((s, r) => s + (r.new_fee || 0), 0);

      const grandRow = ws4.addRow({
        date: 'GRAND TOTAL',
        old_fee: grandOld,
        new_fee: grandNew,
        savings: grandSavings,
      });
      grandRow.eachCell(cell => {
        applyFill(cell, CLR.greenHeader);
        applyFont(cell, { bold: true, color: CLR.white, size: 11 });
      });
      ['old_fee', 'new_fee', 'savings'].forEach(k => {
        const ci = savCols.findIndex(c => c.key === k) + 1;
        grandRow.getCell(ci).numFmt = '#,##0.00';
        applyAlignment(grandRow.getCell(ci), 'right', 'middle');
      });
      grandRow.height = 26;
      dataRowIdx++;

      // Summary box
      dataRowIdx++;
      const fuelCost = db.prepare(`
        SELECT COALESCE(SUM(COALESCE(amount_aed, amount)), 0) as fuel FROM expenses WHERE expense_type = 'adnoc'
        ${type === 'this_month' ? "AND strftime('%Y-%m', date) = '" + thisYM + "'" : ''}
        ${type === 'custom' && from ? "AND date >= '" + from + "'" : ''}
        ${type === 'custom' && to ? "AND date <= '" + to + "'" : ''}
      `).get().fuel;

      const summaryItems = [
        ['Gross Agent Fee Savings:', `AED ${grandSavings.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
        ['Self-Clearance Fuel Cost:', `AED ${fuelCost.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
        ['NET SAVINGS:', `AED ${(grandSavings - fuelCost).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`],
      ];

      summaryItems.forEach(([label, val], i) => {
        const rn = dataRowIdx + i;
        try { ws4.mergeCells(`A${rn}:G${rn}`); } catch (_) {}
        try { ws4.mergeCells(`H${rn}:M${rn}`); } catch (_) {}
        const lc = ws4.getCell(`A${rn}`);
        const vc = ws4.getCell(`H${rn}`);
        lc.value = '  ' + label;
        vc.value = val;
        const isNet = i === 2;
        applyFill(lc, isNet ? CLR.greenLight : CLR.evenRow);
        applyFill(vc, isNet ? CLR.greenLight : CLR.evenRow);
        applyFont(lc, { bold: isNet, size: isNet ? 11 : 10, color: CLR.greenHeader });
        applyFont(vc, { bold: isNet, size: isNet ? 12 : 10, color: CLR.greenHeader });
        applyAlignment(vc, 'right');
        ws4.getRow(rn).height = isNet ? 26 : 20;
      });

      ws4.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // ─── Respond ─────────────────────────────────────────────────────────────
    const fileDate = dateRange.replace(/[^a-zA-Z0-9\-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AgthiaPettyCash_${fileDate}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

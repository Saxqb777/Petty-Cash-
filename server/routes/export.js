const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../db/database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { from, to, category, business_unit, type = 'all' } = req.query;

    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    const now = new Date();
    if (type === 'this_month') {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      query += " AND strftime('%Y-%m', date) = ?";
      params.push(ym);
    } else if (type === 'custom') {
      if (from) { query += ' AND date >= ?'; params.push(from); }
      if (to) { query += ' AND date <= ?'; params.push(to); }
    }

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (business_unit) { query += ' AND business_unit = ?'; params.push(business_unit); }
    query += ' ORDER BY date ASC';

    const records = db.prepare(query).all(...params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Agthia Petty Cash';
    const ws = wb.addWorksheet('Petty Cash Records', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // Header row styling
    ws.columns = [
      { header: 'Sr.No', key: 'sr', width: 7 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Invoice No.', key: 'invoice_number', width: 16 },
      { header: 'Vendor / Shop', key: 'vendor_name', width: 24 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Business Unit', key: 'business_unit', width: 16 },
      { header: 'Amount (AED)', key: 'amount', width: 16 },
      { header: 'Payment Method', key: 'payment_method', width: 17 },
      { header: 'Purpose / Description', key: 'purpose', width: 40 },
      { header: 'Submitted By', key: 'submitted_by', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Style header
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF16a34a' } }
      };
    });
    headerRow.height = 28;

    // Data rows
    records.forEach((r, i) => {
      const row = ws.addRow({
        sr: i + 1,
        date: r.date,
        invoice_number: r.invoice_number || '-',
        vendor_name: r.vendor_name,
        category: r.category,
        business_unit: r.business_unit || '-',
        amount: r.amount,
        payment_method: r.payment_method || 'Cash',
        purpose: r.purpose || '-',
        submitted_by: r.submitted_by || '-',
        notes: r.notes || '-',
      });

      const isEven = (i + 1) % 2 === 0;
      row.eachCell(cell => {
        cell.font = { size: 10, name: 'Calibri' };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        }
      });

      // Amount column - right align, bold
      const amtCell = row.getCell('amount');
      amtCell.numFmt = '#,##0.00';
      amtCell.alignment = { horizontal: 'right', vertical: 'middle' };
      amtCell.font = { bold: true, size: 10, name: 'Calibri' };
      row.height = 20;
    });

    // Total row
    const totalRow = ws.addRow({
      sr: '',
      date: '',
      invoice_number: '',
      vendor_name: 'TOTAL',
      category: '',
      business_unit: '',
      amount: records.reduce((s, r) => s + r.amount, 0),
      payment_method: '',
      purpose: `${records.length} transaction(s)`,
    });
    totalRow.eachCell(cell => {
      cell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF166534' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    });
    totalRow.getCell('amount').numFmt = '#,##0.00';
    totalRow.getCell('amount').alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.height = 24;

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const dateRange = from && to ? `${from}_to_${to}` : type === 'this_month'
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : 'All';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AgthiaPettyCash_${dateRange}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

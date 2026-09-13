#!/usr/bin/env python3
"""
Builds the Doc Ledger user guide / SOP as a PDF.

Styled in the app's own Overprint language so the document and the product
read as one thing: two spot inks, hard rectangles, no rounded corners and no
shadows. Regenerate with:  python3 docs/build_sop.py
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak, NextPageTemplate, Flowable,
)

# ── Inks ─────────────────────────────────────────────────────────────────────
PAPER  = colors.HexColor('#EDECE8')
PAPER2 = colors.HexColor('#F7F6F3')
RULE   = colors.HexColor('#D8D5CD')
INK    = colors.HexColor('#14141A')
INK6   = colors.HexColor('#43434E')
INK4   = colors.HexColor('#6B6B75')
BLUE   = colors.HexColor('#22356F')
BLUE1  = colors.HexColor('#DDE3F3')
BLUE5  = colors.HexColor('#EFF2FA')
FLARE  = colors.HexColor('#FF4A17')
FLARE7 = colors.HexColor('#C4340D')
FLARE0 = colors.HexColor('#FFF1EB')
GREEN  = colors.HexColor('#00A95C')
GREEN7 = colors.HexColor('#00753F')
GREEN0 = colors.HexColor('#E8F7EF')

PW, PH = A4
M = 20 * mm

BODY_W = PW - 2 * M

# ── Styles ───────────────────────────────────────────────────────────────────
def S(name, **kw):
    kw.setdefault('fontName', 'Helvetica')
    kw.setdefault('fontSize', 9.5)
    kw.setdefault('leading', 14)
    kw.setdefault('textColor', INK)
    kw.setdefault('alignment', TA_LEFT)
    return ParagraphStyle(name, **kw)

body     = S('body', spaceAfter=7)
lead     = S('lead', fontSize=11, leading=16.5, textColor=INK6, spaceAfter=10)
h1       = S('h1', fontName='Helvetica-Bold', fontSize=19, leading=23,
             textColor=BLUE, spaceBefore=4, spaceAfter=3)
h2       = S('h2', fontName='Helvetica-Bold', fontSize=12.5, leading=16,
             textColor=INK, spaceBefore=13, spaceAfter=4, keepWithNext=1)
h3       = S('h3', fontName='Helvetica-Bold', fontSize=10, leading=13.5,
             textColor=INK, spaceBefore=9, spaceAfter=2, keepWithNext=1)
eyebrow  = S('eyebrow', fontName='Helvetica-Bold', fontSize=7.5, leading=10,
             textColor=INK4, spaceAfter=2)
mono     = S('mono', fontName='Courier', fontSize=8.5, leading=12.5, textColor=INK)
cell     = S('cell', fontSize=8.7, leading=12)
cellb    = S('cellb', fontSize=8.7, leading=12, fontName='Helvetica-Bold')
cellh    = S('cellh', fontSize=7.5, leading=10, fontName='Helvetica-Bold',
             textColor=PAPER)
callout  = S('callout', fontSize=9, leading=13.5)
stepno   = S('stepno', fontName='Helvetica-Bold', fontSize=13, leading=15,
             textColor=FLARE7)
footer   = S('footer', fontSize=7.5, leading=10, textColor=INK4)


class Rule(Flowable):
    """A hard horizontal rule. Thickness carries meaning: 2pt is structural."""
    def __init__(self, w=BODY_W, thickness=2, color=INK, space=6):
        Flowable.__init__(self)
        self.w, self.t, self.c, self.space = w, thickness, color, space
        self.height = thickness + space

    def wrap(self, aw, ah):
        return (self.w, self.height)

    def draw(self):
        self.canv.setStrokeColor(self.c)
        self.canv.setLineWidth(self.t)
        self.canv.line(0, self.space, self.w, self.space)


# Section head -> folio, learned on the first build pass so the contents table
# can carry real page numbers instead of guesses.
_PAGES = {}


class Mark(Flowable):
    """Zero-height marker that records which page its section landed on."""
    def __init__(self, key):
        Flowable.__init__(self)
        self.key = key

    def wrap(self, aw, ah):
        return (0, 0)

    def draw(self):
        # The cover is page 1 and carries no folio, so the printed number is n-1.
        _PAGES[self.key] = self.canv.getPageNumber() - 1


def section(number, title):
    """Numbered section head: flare number, ink title, structural rule."""
    t = Table(
        [[Paragraph(f'<font color="#C4340D">{number}</font>', stepno),
          Paragraph(title, h1)]],
        colWidths=[14 * mm, BODY_W - 14 * mm],
    )
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    out = [t, Rule(thickness=2, color=INK, space=4), Spacer(1, 7)]
    if number:
        out.insert(0, Mark(number))
    return out


def box(text, kind='note'):
    """Callout. Flare means 'this will bite you', green means 'good outcome'."""
    bg, bd = {
        'note':  (BLUE5, BLUE),
        'warn':  (FLARE0, FLARE7),
        'good':  (GREEN0, GREEN7),
        'quiet': (PAPER2, RULE),
    }[kind]
    t = Table([[Paragraph(text, callout)]], colWidths=[BODY_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('LINEBEFORE', (0, 0), (0, -1), 3, bd),
        ('BOX', (0, 0), (-1, -1), 0.5, bd),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([t, Spacer(1, 8)])


def table(rows, widths, head=True, zebra=True):
    data = []
    for i, r in enumerate(rows):
        style = cellh if (head and i == 0) else cell
        data.append([Paragraph(str(c), style) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('BOX', (0, 0), (-1, -1), 1.5, INK),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, RULE),
    ]
    if head:
        st.append(('BACKGROUND', (0, 0), (-1, 0), INK))
    if zebra:
        start = 1 if head else 0
        for i in range(start, len(rows)):
            if (i - start) % 2 == 1:
                st.append(('BACKGROUND', (0, i), (-1, i), PAPER2))
    t.setStyle(TableStyle(st))
    return [t, Spacer(1, 9)]


def steps(items):
    """Numbered procedure. The number is the flare ink, the only colour used."""
    rows = []
    for i, txt in enumerate(items, 1):
        rows.append([
            Paragraph(f'<font color="#C4340D"><b>{i:02d}</b></font>', cell),
            Paragraph(txt, cell),
        ])
    t = Table(rows, colWidths=[9 * mm, BODY_W - 9 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, RULE),
    ]))
    return [t, Spacer(1, 9)]


def bullets(items):
    rows = [[Paragraph('<font color="#22356F"><b>|</b></font>', cell),
             Paragraph(t, cell)] for t in items]
    t = Table(rows, colWidths=[5 * mm, BODY_W - 5 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    return KeepTogether([t, Spacer(1, 7)])


# ── Page furniture ───────────────────────────────────────────────────────────
def cover(canv, doc):
    canv.saveState()
    canv.setFillColor(BLUE)
    canv.rect(0, 0, PW, PH, stroke=0, fill=1)

    # Mark: flare square with the monogram, the app's own
    canv.setFillColor(FLARE)
    canv.rect(M, PH - M - 17 * mm, 17 * mm, 17 * mm, stroke=0, fill=1)
    canv.setFillColor(INK)
    canv.setFont('Helvetica-Bold', 19)
    canv.drawString(M + 3.4 * mm, PH - M - 12 * mm, 'DL')

    canv.setFillColor(colors.white)
    canv.setFont('Helvetica-Bold', 31)
    canv.drawString(M + 22 * mm, PH - M - 12 * mm, 'Doc Ledger')

    # The overprint: two plates crossing, multiply where they meet.
    bx, by = M, PH * 0.40
    canv.setFillColor(colors.white)
    canv.rect(bx, by, 62 * mm, 44 * mm, stroke=0, fill=1)
    canv.setFillColor(INK4)
    canv.setFont('Courier', 7.5)
    canv.drawString(bx + 5 * mm, by + 35 * mm, 'RECEIPT 0417')
    canv.setFillColor(RULE)
    for i, w in enumerate([48, 40, 34]):
        canv.rect(bx + 5 * mm, by + 29 * mm - i * 4 * mm, w * mm * 0.8, 1.6 * mm,
                  stroke=0, fill=1)
    canv.setFillColor(INK)
    canv.setFont('Courier', 11)
    canv.drawString(bx + 5 * mm, by + 10 * mm, 'AED 1,240.00')

    canv.saveState()
    try:
        from reportlab.lib.utils import ImageReader  # noqa: F401
        canv.setFillColor(FLARE)
        canv.setFillAlpha(0.92)
    except Exception:
        canv.setFillColor(FLARE)
    canv.rect(bx + 40 * mm, by - 14 * mm, 40 * mm, 40 * mm, stroke=0, fill=1)
    canv.restoreState()

    canv.setFillColor(GREEN)
    canv.rect(bx + 8 * mm, by - 22 * mm, 34 * mm, 2.6 * mm, stroke=0, fill=1)

    canv.setFillColor(colors.white)
    canv.setFont('Helvetica-Bold', 17)
    canv.drawString(M, 62 * mm, 'User Guide and Standard')
    canv.drawString(M, 54 * mm, 'Operating Procedure')

    canv.setFillColor(BLUE1)
    canv.setFont('Helvetica', 10)
    canv.drawString(M, 44 * mm,
                    'Recording petty cash, freight and fuel expenses from receipt to report.')

    canv.setFillColor(FLARE)
    canv.rect(M, 33 * mm, 26 * mm, 2.4 * mm, stroke=0, fill=1)

    canv.setFillColor(BLUE1)
    canv.setFont('Courier', 8)
    canv.drawString(M, 25 * mm, 'VERSION 2.0   /   ISSUED SEPTEMBER 2026')
    canv.drawString(M, 20 * mm, 'CAPTURE  /  EXTRACT  /  RECONCILE  /  EXPORT')
    canv.restoreState()


def page(canv, doc):
    canv.saveState()
    canv.setFillColor(colors.white)
    canv.rect(0, 0, PW, PH, stroke=0, fill=1)

    # Running head
    canv.setFillColor(INK4)
    canv.setFont('Helvetica', 7.5)
    canv.drawString(M, PH - M + 5 * mm, 'Doc Ledger')
    canv.drawRightString(PW - M, PH - M + 5 * mm,
                         'User Guide and Standard Operating Procedure')
    canv.setStrokeColor(RULE)
    canv.setLineWidth(0.5)
    canv.line(M, PH - M + 3 * mm, PW - M, PH - M + 3 * mm)

    # Foot: flare tick plus folio
    canv.setFillColor(FLARE)
    canv.rect(M, M - 9 * mm, 8 * mm, 1.8 * mm, stroke=0, fill=1)
    canv.setFillColor(INK4)
    canv.setFont('Courier', 8)
    canv.drawRightString(PW - M, M - 9 * mm, f'{canv.getPageNumber() - 1:02d}')
    canv.restoreState()


def build(path):
    """Two passes: the first learns where each section landed, the second
    writes the contents table with those real page numbers."""
    import io
    _render(io.BytesIO())
    _render(path)


def _render(path):
    doc = BaseDocTemplate(
        path, pagesize=A4,
        leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=M + 4 * mm,
        title='Doc Ledger: User Guide and Standard Operating Procedure',
        author='Doc Ledger', subject='Expense management SOP',
    )
    frame = Frame(M, M + 4 * mm, BODY_W, PH - 2 * M - 4 * mm, id='f',
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id='cover', frames=[frame], onPage=cover),
        PageTemplate(id='body', frames=[frame], onPage=page),
    ])
    doc.build(story())


# ═════════════════════════════════════════════════════════════════════════════
def story():
    s = []
    A = s.append
    E = s.extend

    # Switch off the cover template before the first real page, or the cover
    # artwork repeats behind every page of the document.
    A(NextPageTemplate('body'))
    A(PageBreak())

    # ── Contents ─────────────────────────────────────────────────────────────
    TOC = [
        ('1',  'What this system replaces',            'Everyone'),
        ('2',  'Getting access',                        'Everyone'),
        ('3',  'Roles and what each one can do',        'Everyone'),
        ('4',  'Recording an expense',                  'Everyone'),
        ('5',  'The expense types',                     'Everyone'),
        ('6',  'Money: currency and AED conversion',    'Everyone'),
        ('7',  'Duplicates and flagged extractions',    'Everyone'),
        ('8',  'Finding, editing and exporting records','Everyone / Finance'),
        ('9',  'Clearance savings',                     'Finance'),
        ('10', 'Settings',                              'Finance'),
        ('11', 'Managing people',                       'Admin'),
        ('12', 'Building a custom expense type',        'Admin'),
        ('13', 'The platform console',                  'Platform owner'),
        ('14', 'Rules and good practice',               'Everyone'),
        ('15', 'When something goes wrong',             'Everyone'),
    ]
    E(section('', 'Contents'))
    E(table(
        [['Section', 'For whom', 'Page']] +
        [[f'{n}&nbsp;&nbsp;{t}', who,
          f'{_PAGES[n]:02d}' if n in _PAGES else '&#183;&#183;']
         for n, t, who in TOC],
        [BODY_W * 0.58, BODY_W * 0.27, BODY_W * 0.15]))

    # ── 1 ────────────────────────────────────────────────────────────────────
    E(section('1', 'What this system replaces'))
    A(Paragraph(
        'Doc Ledger records petty cash spending from the receipt itself. Someone '
        'photographs a receipt, the system reads it and fills in the fields, a person '
        'checks the result and saves it. Finance then reports on it without retyping '
        'anything.', lead))
    A(Paragraph('It replaces three things that used to be separate:', body))
    A(bullets([
        'The paper voucher book and the envelope of receipts.',
        'The spreadsheet that was retyped from those receipts at month end.',
        'The separate tracker for customs clearing agent fees and the savings against them.',
    ]))
    A(Paragraph(
        'Every organisation using Doc Ledger is completely separate. You see your own '
        'organisation\'s expenses and nobody else\'s, and no one outside your '
        'organisation can see yours.', body))

    # ── 2 ────────────────────────────────────────────────────────────────────
    E(section('2', 'Getting access'))

    A(Paragraph('Creating your account', h2))
    E(steps([
        'Open the Doc Ledger address your administrator gave you and choose '
        '<b>Create one</b> under the sign in box.',
        'Enter your full name, work email and a password of at least eight characters.',
        'Choose whether you are <b>creating a new organisation</b> or '
        '<b>joining an existing one</b>.',
    ]))

    A(Paragraph('Creating versus joining', h2))
    A(Paragraph(
        'These are genuinely different and the choice cannot be undone by you afterwards.', body))
    E(table([
        ['Choice', 'What happens'],
        ['<b>Create a new organisation</b>',
         'You name the organisation and become its <b>owner</b> immediately. You get a '
         'fresh, empty set of records, the three built in expense types and a default '
         'set of exchange rates. Use this only if your company is not already on the '
         'system.'],
        ['<b>Join an existing one</b>',
         'You pick your organisation from the list and your request goes to its '
         'administrators. You cannot see or do anything until one of them approves you. '
         'This is the right choice for almost everyone.'],
    ], [BODY_W * 0.3, BODY_W * 0.7]))

    A(box(
        '<b>If you are waiting for approval</b> you will see a holding screen rather than '
        'the dashboard. It checks every twelve seconds on its own, so leave it open. '
        'Nothing is wrong. Chase an administrator if it is still waiting the next day.',
        'quiet'))

    # ── 3 ────────────────────────────────────────────────────────────────────
    E(section('3', 'Roles and what each one can do'))
    A(Paragraph(
        'There are four roles. Each one includes everything the roles above it in this '
        'table can do.', body))
    E(table([
        ['Role', 'Can do', 'Typically'],
        ['<b>Member</b>',
         'Record an expense, upload receipts, view and edit records, see the dashboard '
         'and the savings figures.',
         'Anyone who spends petty cash'],
        ['<b>Finance</b>',
         'Everything a member can, plus <b>delete</b> records, <b>export</b> to Excel, '
         'change <b>settings</b> and exchange rates, and record <b>clearance savings</b>.',
         'Accounts team'],
        ['<b>Admin</b>',
         'Everything finance can, plus approve or reject people who ask to join, change '
         'their roles, remove them, and build custom expense types.',
         'Department head'],
        ['<b>Owner</b>',
         'Everything. The person who created the organisation.',
         'Business owner'],
    ], [BODY_W * 0.15, BODY_W * 0.55, BODY_W * 0.30]))

    A(box(
        '<b>Worth knowing.</b> Any member can edit any expense in the organisation, not '
        'only their own. Deleting is restricted to finance and above, but editing is not. '
        'If that is too open for your controls, keep most people as members and rely on '
        'the export for the record of what changed.', 'warn'))

    # ── 4 ────────────────────────────────────────────────────────────────────
    E(section('4', 'Recording an expense'))
    A(Paragraph(
        'This is the procedure everyone follows, every time. It takes under a minute '
        'once the receipt is in front of you.', lead))

    A(Paragraph('The procedure', h2))
    E(steps([
        'Open <b>Add Expense</b> from the left.',
        'Pick the <b>expense type</b> that matches the document in your hand. Section 5 '
        'explains the difference. Picking the right one changes which fields you get and '
        'how well the reading works.',
        'Either drop the photograph or PDF onto the large panel, or click it to browse. '
        'If you have no document at all, choose <b>Type it in</b> instead.',
        'Wait while the receipt is read. This normally takes a few seconds and can take '
        'up to a minute for a dense shipping bill. Do not refresh the page.',
        'Check every field against the document. Fields the system was unsure about are '
        'marked in orange, and those are the ones to check first.',
        'Correct anything wrong, fill in anything blank that matters, then press '
        '<b>Save expense</b>.',
    ]))

    A(Paragraph('What the system reads for you', h2))
    A(Paragraph(
        'The receipt is read by an AI model that has been told what kind of document to '
        'expect, based on the expense type you chose. It pulls out the vendor, the '
        'amount, the currency, the date, a sensible category and, for shipping bills, '
        'every individual charge line, the bill of lading numbers and the container '
        'numbers.', body))
    A(Paragraph(
        'It is good, not perfect. It is reading a photograph of a piece of paper. The '
        'review step exists because you are the one who confirms the number, not the '
        'machine.', body))

    A(box(
        '<b>You are responsible for what you save.</b> Once you press save, the figures '
        'are the record. Check the amount and the date against the document every single '
        'time, even when nothing is marked in orange.', 'warn'))

    A(Paragraph('What you can upload', h2))
    E(table([
        ['Accepted', 'JPG, PNG, WEBP and PDF'],
        ['Maximum size', '15 MB per file'],
        ['Best results', 'A flat, well lit photograph of the whole receipt, right way up, '
                         'with the total visible and not cut off'],
        ['Poor results', 'Crumpled thermal paper, a photograph at an angle, a shadow '
                         'across the total, or a picture of a screen showing a receipt'],
    ], [BODY_W * 0.22, BODY_W * 0.78], head=False))

    # ── 5 ────────────────────────────────────────────────────────────────────
    E(section('5', 'The expense types'))
    A(Paragraph(
        'Three types come built in. Choosing correctly matters, because each one asks '
        'the reader to look for different things.', body))

    A(Paragraph('General expense', h3))
    A(Paragraph(
        'Parking, printing and photocopying, office supplies, materials, food and '
        'beverages, medical, accommodation and travel, and anything that does not fit '
        'elsewhere. You choose a category, which is what the dashboard breakdown is '
        'built from.', body))

    A(Paragraph('Petrol and fuel', h3))
    A(Paragraph(
        'Fuel station receipts. As well as the usual fields it captures the fuel grade, '
        'the litres, the odometer reading and the vehicle plate where these are printed '
        'on the receipt. Use this rather than general expense for fuel, or you lose the '
        'vehicle record.', body))

    A(Paragraph('Shipping line bill', h3))
    A(Paragraph(
        'Freight invoices, terminal handling, demurrage and customs clearance bills. '
        'This is the richest type. It captures every charge line separately rather than '
        'only the total, all bill of lading numbers, all container numbers, the port and '
        'whether the shipment is an import or an export. It is also where clearance '
        'savings are recorded, covered in section 9.', body))

    A(box(
        '<b>On a shipping bill the total is calculated from the charge lines you enter, '
        'not typed directly.</b> If the total does not match the invoice, a charge line '
        'is missing or wrong. That is the point of entering them separately.', 'note'))

    A(Paragraph('Custom types', h3))
    A(Paragraph(
        'Your administrators can build additional types with their own fields, described '
        'in section 12. They behave exactly like the built in ones.', body))

    # ── 6 ────────────────────────────────────────────────────────────────────
    E(section('6', 'Money: currency and AED conversion'))
    A(Paragraph(
        'Expenses are stored in the currency they were paid in. Alongside that, the '
        'system stores the equivalent in AED, and every report and total is built from '
        'the AED figure.', body))

    E(table([
        ['Rule', 'What it means for you'],
        ['<b>The rate is taken at the moment you save</b>',
         'The conversion uses the organisation\'s configured rate at the instant the '
         'expense is saved, and that converted figure is then fixed.'],
        ['<b>Old records never re-convert</b>',
         'If finance changes a rate next month, last month\'s expenses keep the figure '
         'they were saved with. This is deliberate. Accounts that silently restate '
         'themselves are not accounts.'],
        ['<b>AED is always exactly one</b>',
         'An expense paid in dirhams is never converted.'],
    ], [BODY_W * 0.34, BODY_W * 0.66]))

    A(Paragraph(
        'The consequence is worth stating plainly: <b>save foreign currency expenses '
        'promptly</b>. An invoice entered six weeks late is converted at today\'s rate, '
        'not the rate on the day it was incurred.', body))

    # ── 7 ────────────────────────────────────────────────────────────────────
    E(section('7', 'Duplicates and flagged extractions'))

    A(Paragraph('Duplicate protection', h2))
    A(Paragraph('The same receipt cannot be claimed twice. Three checks run, in order.', body))
    E(table([
        ['Check', 'What triggers it', 'Result'],
        ['<b>Same file</b>',
         'The identical image or PDF has already been uploaded, even renamed.',
         'Refused'],
        ['<b>Same invoice</b>',
         'Same invoice number, vendor, date and amount as an existing record.',
         'Refused'],
        ['<b>Looks similar</b>',
         'No invoice number, but same vendor, date and amount.',
         'Warning only, saving is allowed'],
    ], [BODY_W * 0.22, BODY_W * 0.55, BODY_W * 0.23]))

    A(Paragraph(
        'If a refusal is wrong, for instance two genuinely separate taxi fares for the '
        'same amount on the same day from the same vendor, add the invoice or receipt '
        'number to tell them apart.', body))

    A(Paragraph('Fields marked in orange', h2))
    A(Paragraph(
        'When the reader is not confident about a field, or when the figures do not add '
        'up, the field is marked in orange and a note appears above the form. The record '
        'is then flagged as needing review and the dashboard shows a count of them.', body))
    A(Paragraph('Common reasons a field is flagged:', body))
    A(bullets([
        'The amount was unreadable, or looks implausible.',
        'The date is in the future, or is more than two years old.',
        'The currency is not one of the supported currencies.',
        'On a shipping bill, the charge lines do not add up to the stated total.',
    ]))

    # ── 8 ────────────────────────────────────────────────────────────────────
    E(section('8', 'Finding, editing and exporting records'))

    A(Paragraph('The records table', h2))
    A(Paragraph(
        'Everything saved appears under <b>Records</b>. Search by vendor or invoice '
        'number, filter by type, category, business unit or date range, and sort any '
        'column by clicking its heading. Click a row to expand the full detail, '
        'including the receipt image and, for shipping bills, the charge breakdown.', body))

    A(Paragraph('Editing and deleting', h2))
    E(table([
        ['Edit a record', 'Any member. Open the row, change what is wrong, save.'],
        ['Delete a record', 'Finance and above only. It cannot be undone, and the '
                            'receipt image is deleted at the same time.'],
    ], [BODY_W * 0.24, BODY_W * 0.76], head=False))

    A(Paragraph('The Excel export', h2))
    A(Paragraph(
        'Finance and above can export from the Records screen. Any filters you have '
        'applied carry into the export. The workbook has four sheets:', body))
    E(table([
        ['Sheet', 'Contents'],
        ['<b>Summary</b>', 'Totals, counts and averages, with breakdowns by category, '
                           'type and business unit.'],
        ['<b>All Expenses</b>', 'One row per expense with every field, including the '
                                'exchange rate used and the port.'],
        ['<b>Shipping Details</b>', 'The individual charge lines, grouped per bill.'],
        ['<b>Savings Report</b>', 'Clearance savings by month.'],
    ], [BODY_W * 0.26, BODY_W * 0.74]))

    # ── 9 ────────────────────────────────────────────────────────────────────
    E(section('9', 'Clearance savings'))
    A(Paragraph(
        'This tracks money saved by changing customs clearing agent. It answers one '
        'question: what would this shipment have cost with the old agent, and what did '
        'it actually cost.', lead))

    A(Paragraph(
        'When you save a shipping expense you can record the previous agent\'s fee '
        'alongside it. The saving is simply the old fee minus what was actually paid, '
        'and it is linked to that shipment so it can always be traced back.', body))

    E(table([
        ['Old fee', 'What the previous agent would have charged'],
        ['New fee', 'What was actually paid, taken from the expense'],
        ['Saving', 'Old fee minus new fee, calculated for you'],
    ], [BODY_W * 0.2, BODY_W * 0.8], head=False))

    A(Paragraph(
        'The <b>Savings</b> screen shows these by month and by agent, and they form the '
        'fourth sheet of the Excel export. Finance can also import a batch from a '
        'spreadsheet rather than entering them one at a time.', body))

    A(box(
        '<b>The figure reported is gross savings.</b> It is the difference in agent fees '
        'and nothing else. It does not net off fuel, staff time or any other cost of '
        'doing the clearance differently. Present it as what it is.', 'warn'))

    # ── 10 ───────────────────────────────────────────────────────────────────
    E(section('10', 'Settings'))
    A(Paragraph('Finance and above. Changes apply to the whole organisation.', body))
    E(table([
        ['Setting', 'Notes'],
        ['<b>Exchange rates</b>',
         'The rate used to convert each currency into AED. Review monthly. Changing a '
         'rate affects future entries only.'],
        ['<b>Expense categories</b>',
         'The category list offered on a general expense. These drive the dashboard '
         'breakdown, so keep the list short and meaningful.'],
        ['<b>Business units</b>',
         'The divisions expenses are attributed to.'],
        ['<b>Approval threshold</b>',
         'Expenses above this amount are flagged for attention.'],
        ['<b>Company details</b>',
         'Name, department and the month your financial year starts.'],
    ], [BODY_W * 0.26, BODY_W * 0.74]))

    # ── 11 ───────────────────────────────────────────────────────────────────
    E(section('11', 'Managing people'))
    A(Paragraph('Administrators and owners only, under <b>Members</b>.', body))
    E(steps([
        'People who have asked to join appear at the top as pending. Approve or reject '
        'each one. Until you approve them they cannot see anything at all.',
        'Set the right role at the point of approval. Most people should be members. '
        'Only give finance to people who should be able to delete records and change '
        'rates.',
        'Remove people who leave, promptly. Removing them ends their access but leaves '
        'the expenses they recorded intact.',
    ]))
    A(box(
        '<b>Approve deliberately.</b> Anyone can request to join your organisation from '
        'the sign up screen by picking it from the list. Approval is the only thing '
        'standing between a stranger and your expense records. If you do not recognise '
        'the name, do not approve it.', 'warn'))

    # ── 12 ───────────────────────────────────────────────────────────────────
    E(section('12', 'Building a custom expense type'))
    A(Paragraph(
        'Administrators can add expense types beyond the three built in ones, under '
        '<b>Expense Types</b>. Use this when a recurring kind of document has fields the '
        'standard form does not capture, for example hotel bills needing check in and '
        'check out dates.', body))
    E(steps([
        'Give it a name, and optionally a description, an icon and a colour so people '
        'can pick it out at a glance.',
        'Write the <b>extraction hints</b>: a sentence or two telling the reader what '
        'this document is and what to look for. This has more effect on accuracy than '
        'anything else on the page.',
        'Add the fields you need, choosing the right type for each, text, number, '
        'amount, date, dropdown or long text. Mark the ones that must be filled in.',
        'Save. It appears immediately as an option when adding an expense.',
    ]))
    A(Paragraph(
        'Vendor, amount and date are always present and do not need adding. Built in '
        'types cannot be edited or removed. Custom types can be archived, which hides '
        'them from the Add Expense screen while leaving existing records untouched.', body))

    # ── 13 ───────────────────────────────────────────────────────────────────
    E(section('13', 'The platform console'))
    A(Paragraph(
        'Visible only to the platform owner, who is the person operating Doc Ledger '
        'itself rather than any one organisation. It lists every organisation on the '
        'system with its member count, expense count, total spend and last activity, and '
        'allows renaming or deleting an organisation.', body))
    A(box(
        '<b>Deleting an organisation is absolute.</b> It removes every expense, receipt, '
        'setting, expense type and membership belonging to it, and the receipt files are '
        'deleted from storage at the same time. There is no undo and no export step '
        'built into the action. Export first, always.', 'warn'))

    # ── 14 ───────────────────────────────────────────────────────────────────
    E(section('14', 'Rules and good practice'))
    E(table([
        ['Do', 'Why'],
        ['Photograph the receipt when you receive it, not at month end.',
         'Thermal paper fades, and foreign currency converts at the rate on the day you '
         'save.'],
        ['Check the amount and date against the document before saving, every time.',
         'The reading is good but it is still a machine reading a photograph.'],
        ['Deal with anything marked in orange before saving.',
         'A flagged record that is saved anyway simply carries the doubt into your '
         'reports.'],
        ['Choose the specific expense type rather than general.',
         'General loses the fuel, vehicle and shipment detail permanently.'],
        ['Enter shipping charges line by line.',
         'The total is built from them, and the mismatch check depends on them.'],
        ['Export and keep a copy at each month end.',
         'It is your record outside the system.'],
    ], [BODY_W * 0.45, BODY_W * 0.55]))

    E(table([
        ['Do not', 'Why'],
        ['Share your login.',
         'Everything recorded under it is attributed to you.'],
        ['Re-photograph and re-enter a receipt that failed to save.',
         'Check Records first. It may well be there already.'],
        ['Delete a record to correct it.',
         'Edit it. Deleting destroys the receipt image with it.'],
        ['Treat the savings figure as net profit.',
         'It is the difference in agent fees only.'],
    ], [BODY_W * 0.45, BODY_W * 0.55]))

    # ── 15 ───────────────────────────────────────────────────────────────────
    E(section('15', 'When something goes wrong'))
    E(table([
        ['What you see', 'What it means and what to do'],
        ['Stuck on the waiting for approval screen',
         'No administrator has approved you yet. The screen checks itself every twelve '
         'seconds. Contact an administrator.'],
        ['Sent back to the sign in screen',
         'Your session has expired. Sign in again. Sessions last thirty days of use.'],
        ['<b>Duplicate</b> when saving',
         'This receipt is already recorded. Search Records for the vendor and amount to '
         'find it. If they are genuinely different, add the invoice number.'],
        ['The reading came back mostly empty',
         'The photograph was probably unreadable. Retake it flat and well lit, or choose '
         '<b>Type it in</b> and enter the fields yourself.'],
        ['The upload fails immediately',
         'The file is over 15 MB or is not a JPG, PNG, WEBP or PDF. Photograph it again '
         'at a lower resolution.'],
        ['Export or delete is not offered',
         'Both need the finance role. Ask an administrator.'],
        ['A total does not look right',
         'Check whether you are reading a filtered view. Filters apply to what is shown '
         'and to the export.'],
    ], [BODY_W * 0.30, BODY_W * 0.70]))

    A(Spacer(1, 10))
    A(Rule(thickness=2, color=INK, space=4))
    A(Paragraph(
        'Doc Ledger, version 2.0. Issued September 2026. Prepared as the operating '
        'procedure for recording petty cash, fuel and freight expenditure. Review this '
        'document whenever roles, categories or exchange rate policy change.', footer))
    return s


if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       'Doc-Ledger-User-Guide-SOP.pdf')
    build(out)
    print('wrote', out)

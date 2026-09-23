import { degrees, PDFFont, PDFPage, rgb } from 'pdf-lib';

// Draws the CMS-1500 (02/12) form itself: a vector reproduction of the public-domain NUCC form built on
// the same 10 CPI x 6 LPI grid as the data (see layout.ts), so the two always line up. It's meant for
// viewing and plain-paper copies; payers that take paper claims need the data printed onto the
// official red OCR form instead.

export interface Cms1500FormFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

const RED = rgb(232 / 255, 37 / 255, 43 / 255);
const SHADE = rgb(247 / 255, 228 / 255, 234 / 255);
const GHOST = rgb(240 / 255, 214 / 255, 224 / 255);
const WHITE = rgb(1, 1, 1);

const CAPTION = 6.1;
const THIN = 0.6;
const DASH = [1.8, 1.2];

// Distance from the top of the page to the bottom of print line n.
const L = (n: number): number => n * 12;
// Rules run through the middle of a character column that is left blank.
const G = (col: number): number => (col - 0.5) * 7.2;
const IN = (inches: number): number => inches * 72;

const LEFT = G(3);
const MID = G(52);
const LEFT_MID = G(32);
const RIGHT = G(82);
const SIDE_BAR = IN(8.26);

interface TextOptions {
  size?: number;
  font?: PDFFont;
  color?: typeof RED;
}

export function drawCms1500Form(page: PDFPage, fonts: Cms1500FormFonts): void {
  const height = page.getHeight();
  const y = (fromTop: number): number => height - fromTop;

  const hline = (fromTop: number, x0: number, x1: number, thickness = THIN, dashed = false): void =>
    page.drawLine({
      start: { x: x0, y: y(fromTop) },
      end: { x: x1, y: y(fromTop) },
      thickness,
      color: RED,
      dashArray: dashed ? DASH : undefined,
    });
  const vline = (x: number, top: number, bottom: number, thickness = THIN, dashed = false): void =>
    page.drawLine({
      start: { x, y: y(top) },
      end: { x, y: y(bottom) },
      thickness,
      color: RED,
      dashArray: dashed ? DASH : undefined,
    });
  const shade = (x0: number, top: number, x1: number, bottom: number, color = SHADE): void =>
    page.drawRectangle({ x: x0, y: y(bottom), width: x1 - x0, height: bottom - top, color });
  const text = (value: string, x: number, baseline: number, options: TextOptions = {}): void =>
    page.drawText(value, {
      x,
      y: y(baseline),
      size: options.size ?? CAPTION,
      font: options.font ?? fonts.regular,
      color: options.color ?? RED,
    });
  const widthOf = (value: string, options: TextOptions = {}): number =>
    (options.font ?? fonts.regular).widthOfTextAtSize(value, options.size ?? CAPTION);
  const centered = (value: string, x0: number, x1: number, baseline: number, options: TextOptions = {}): void =>
    text(value, (x0 + x1 - widthOf(value, options)) / 2, baseline, options);
  const rightAligned = (value: string, x: number, baseline: number, options: TextOptions = {}): void =>
    text(value, x - widthOf(value, options), baseline, options);
  // Largest size up to `preferredSize` at which the text fits in `width` points.
  const sizeToFit = (value: string, width: number, preferredSize = CAPTION): number =>
    Math.min(preferredSize, width / widthOf(value, { size: 1 }));
  // Centered, shrunk as needed to fit between two rules.
  const fitted = (value: string, x0: number, x1: number, baseline: number, preferredSize = CAPTION): void =>
    centered(value, x0, x1, baseline, { size: sizeToFit(value, x1 - x0 - 1.5, preferredSize) });
  // Left-aligned, shrunk as needed to end before `maxX`.
  const fittedLeft = (value: string, x: number, maxX: number, baseline: number): void =>
    text(value, x, baseline, { size: sizeToFit(value, maxX - x) });
  // Left and right edges of the cells from column `col` spanning `width` characters.
  const cells = (col: number, width: number): [number, number] => [(col - 1) * 7.2, (col - 1 + width) * 7.2];
  // Check box around the "X" that prints in column `col` of print line `line`, with an optional caption
  // just to its left or right.
  const BOX_HALF_WIDTH = 5.4;
  const checkbox = (
    col: number,
    line: number,
    caption?: string,
    side: 'left' | 'right' = 'right',
    size = 6.5
  ): void => {
    page.drawRectangle({
      x: G(col) - BOX_HALF_WIDTH,
      y: y(L(line) - 1),
      width: 2 * BOX_HALF_WIDTH,
      height: 10,
      borderColor: RED,
      borderWidth: THIN,
    });
    boxCaption(col, line, caption, side, size);
  };
  // Open corner boxes used for the sex and SSN/EIN choices.
  const cornerBox = (col: number, line: number, corner: 'top' | 'bottom', caption?: string): void => {
    const left = G(col) - BOX_HALF_WIDTH;
    vline(left, L(line) - 11, L(line) - 1);
    const edge = corner === 'top' ? L(line) - 11 : L(line) - 1;
    hline(edge, left, left + 2 * BOX_HALF_WIDTH);
    boxCaption(col, line, caption, 'left', 6.5);
  };
  const boxCaption = (
    col: number,
    line: number,
    caption: string | undefined,
    side: 'left' | 'right',
    size: number
  ): void => {
    if (!caption) return;
    const baseline = L(line) - 3.5;
    if (side === 'right') text(caption, G(col) + BOX_HALF_WIDTH + 2, baseline, { size });
    else rightAligned(caption, G(col) - BOX_HALF_WIDTH - 2, baseline, { size });
  };
  // Dashed tick separating the parts of a date or a qualifier from its value.
  const tick = (x: number, top: number, bottom: number): void => vline(x, top, bottom, THIN, true);
  // MM / DD / YY captions centered over date parts that start in the given columns.
  const dateCaptions = (mm: number, dd: number, year: number, yearWidth: number, baseline: number): void => {
    centered('MM', ...cells(mm, 2), baseline);
    centered('DD', ...cells(dd, 2), baseline);
    centered('YY', ...cells(year, yearWidth), baseline);
  };

  drawHeader();
  drawPatientAndInsured();
  drawPhysicianAndSupplier();
  drawServiceLines();
  drawFooterAndSideBars();

  function drawHeader(): void {
    text('HEALTH INSURANCE CLAIM FORM', IN(0.275), 66.5, { size: 11, font: fonts.bold });
    text('APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12', IN(0.275), 78.3);
    // PICA alignment boxes
    for (const x0 of [LEFT, RIGHT - 21.6]) {
      hline(85, x0, x0 + 21.6);
      [0, 7.2, 14.4, 21.6].forEach((dx) => vline(x0 + dx, 85, L(8)));
    }
    text('PICA', LEFT + 24, 93);
    rightAligned('PICA', RIGHT - 24, 93);
  }

  function drawPatientAndInsured(): void {
    // Frame and rules
    hline(L(8), LEFT, RIGHT, 2.4);
    [10, 12, 14, 18, 26, 28].forEach((n) => hline(L(n), LEFT, RIGHT));
    [16, 20, 22, 24].forEach((n) => {
      hline(L(n), LEFT, LEFT_MID);
      hline(L(n), MID, RIGHT);
    });
    vline(MID, L(8), L(32));
    vline(LEFT_MID, L(10), L(28));
    vline(G(28), L(14), L(16));
    vline(G(76), L(14), L(16));
    vline(G(16), L(16), L(18));
    vline(G(65), L(16), L(18));

    // 1, 1a
    text('1.', IN(0.3), 103.5);
    text('MEDICARE', IN(0.477), 103.5);
    text('MEDICAID', IN(1.16), 103.5);
    text('TRICARE', IN(1.877), 103.5);
    text('CHAMPVA', IN(2.767), 103.5);
    for (const [upper, lower, x] of [
      ['GROUP', 'HEALTH PLAN', 3.467],
      ['FECA', 'BLK LUNG', 4.25],
    ] as const) {
      text(upper, IN(x), 101.9, { size: 5.3 });
      text(lower, IN(x), 106.9, { size: 5.3 });
    }
    text('OTHER', IN(4.85), 103.5);
    const programs: [number, string][] = [
      [4, '(Medicare#)'],
      [11, '(Medicaid#)'],
      [18, '(ID#/DoD#)'],
      [27, '(Member ID#)'],
      [34, '(ID#)'],
      [42, '(ID#)'],
      [48, '(ID#)'],
    ];
    programs.forEach(([col, hint]) => {
      checkbox(col, 10);
      text(hint, G(col) + BOX_HALF_WIDTH + 1.5, L(10) - 3.5, { font: fonts.italic });
    });
    text("1a. INSURED'S I.D. NUMBER", IN(5.2), 103.5);
    text('(For Program in Item 1)', IN(7.04), 103.5);

    // 2, 3, 4
    text("2. PATIENT'S NAME (Last Name, First Name, Middle Initial)", IN(0.3), 126.7);
    text("3. PATIENT'S BIRTH DATE", IN(3.18), 126.7);
    dateCaptions(34, 37, 40, 4, 132.5);
    tick(G(36), 129, L(12));
    tick(G(39), 129, L(12));
    text('SEX', IN(4.585), 127.5);
    cornerBox(45, 12, 'top', 'M');
    cornerBox(50, 12, 'bottom', 'F');
    text("4. INSURED'S NAME (Last Name, First Name, Middle Initial)", IN(5.2), 126.7);

    // 5, 6, 7
    text("5. PATIENT'S ADDRESS (No., Street)", IN(0.3), 150.7);
    text('6. PATIENT RELATIONSHIP TO INSURED', IN(3.18), 150.7);
    const relationships: [string, number][] = [
      ['Self', 36],
      ['Spouse', 41],
      ['Child', 45],
      ['Other', 50],
    ];
    relationships.forEach(([caption, col]) => checkbox(col, 14, caption, 'left'));
    text("7. INSURED'S ADDRESS (No., Street)", IN(5.2), 150.7);
    for (const [x0, stateX] of [
      [0.3, 2.817],
      [5.2, 7.567],
    ]) {
      text('CITY', IN(x0), 174.7);
      text('STATE', IN(stateX), 174.7);
      text('ZIP CODE', IN(x0), 198.7);
    }
    text('8. RESERVED FOR NUCC USE', IN(3.18), 174.7);
    for (const [captionX, openX, closeX] of [
      [1.61, 1.655, 2.015],
      [6.483, 6.643, 7.023],
    ]) {
      text('TELEPHONE (Include Area Code)', IN(captionX), 198.7);
      text('(', IN(openX), 211.5, { size: 11 });
      text(')', IN(closeX), 211.5, { size: 11 });
    }

    // 9, 10, 11
    text("9. OTHER INSURED'S NAME (Last Name, First Name, Middle Initial)", IN(0.3), 222.7);
    text("a. OTHER INSURED'S POLICY OR GROUP NUMBER", IN(0.3), 246.7);
    text('b. RESERVED FOR NUCC USE', IN(0.3), 270.7);
    text('c. RESERVED FOR NUCC USE', IN(0.3), 294.7);
    text('d. INSURANCE PLAN NAME OR PROGRAM NAME', IN(0.3), 318.7);

    text("10. IS PATIENT'S CONDITION RELATED TO:", IN(3.18), 222.7);
    const conditions: [string, number][] = [
      ['a. EMPLOYMENT? (Current or Previous)', 22],
      ['b. AUTO ACCIDENT?', 24],
      ['c. OTHER ACCIDENT?', 26],
    ];
    conditions.forEach(([caption, line]) => {
      text(caption, IN(3.18), L(line - 2) + 6.7);
      checkbox(38, line, 'YES');
      checkbox(44, line, 'NO');
    });
    text('PLACE (State)', IN(4.55), 273.5);
    vline(IN(4.657), 280, 287);
    hline(287, IN(4.657), IN(4.94));
    vline(IN(4.94), 280, 287);
    text('10d. CLAIM CODES (Designated by NUCC)', IN(3.18), 318.7);

    text("11. INSURED'S POLICY GROUP OR FECA NUMBER", IN(5.2), 222.7);
    text("a. INSURED'S DATE OF BIRTH", IN(5.2), 246.7);
    dateCaptions(56, 59, 62, 4, 252.5);
    tick(G(58), 253, L(22));
    tick(G(61), 253, L(22));
    text('SEX', IN(7.33), 246.7);
    cornerBox(71, 22, 'top', 'M');
    cornerBox(78, 22, 'bottom', 'F');
    text('b. OTHER CLAIM ID (Designated by NUCC)', IN(5.2), 270.7);
    tick(IN(5.405), 276, L(24));
    text('c. INSURANCE PLAN NAME OR PROGRAM NAME', IN(5.2), 294.7);
    text('d. IS THERE ANOTHER HEALTH BENEFIT PLAN?', IN(5.2), 318.7);
    checkbox(55, 28, 'YES');
    checkbox(60, 28, 'NO');
    const ifYes = 'If yes';
    text(ifYes, IN(6.45), 331.5, { font: fonts.boldItalic });
    text(', complete items 9, 9a, and 9d.', IN(6.45) + widthOf(ifYes, { font: fonts.boldItalic }), 331.5);

    // 12, 13
    text('READ BACK OF FORM BEFORE COMPLETING & SIGNING THIS FORM.', IN(1.293), 342.5, { font: fonts.bold });
    fittedLeft(
      "12. PATIENT'S OR AUTHORIZED PERSON'S SIGNATURE  I authorize the release of any medical or other information necessary",
      IN(0.3),
      MID - 4,
      349.9
    );
    fittedLeft(
      'to process this claim. I also request payment of government benefits either to myself or to the party who accepts assignment',
      IN(0.433),
      MID - 4,
      356.4
    );
    text('below.', IN(0.433), 363.6);
    text('SIGNED', IN(0.45), 380.4);
    hline(381, IN(0.78), IN(3.3));
    text('DATE', IN(3.543), 380.4);
    hline(381, IN(3.78), IN(5.12));
    fittedLeft("13. INSURED'S OR AUTHORIZED PERSON'S SIGNATURE I authorize", IN(5.2), RIGHT - 3, 343.2);
    fittedLeft('payment of medical benefits to the undersigned physician or supplier for', IN(5.333), RIGHT - 3, 349.9);
    text('services described below.', IN(5.333), 356.4);
    text('SIGNED', IN(5.393), 380.4);
  }

  function drawPhysicianAndSupplier(): void {
    hline(L(32), LEFT, RIGHT, 2.4);
    [34, 36, 38, 42].forEach((n) => hline(L(n), LEFT, RIGHT));
    hline(L(40), MID, RIGHT);
    vline(MID, L(32), L(44));
    vline(G(30), L(32), L(36));

    // 14, 15, 16
    text('14. DATE OF CURRENT ILLNESS, INJURY, or PREGNANCY (LMP)', IN(0.3), 391.2);
    dateCaptions(5, 8, 11, 4, 396.8);
    tick(G(7), 395, L(34));
    tick(G(10), 395, L(34));
    text('QUAL.', IN(1.49), 405);
    tick(G(18), 396, L(34));
    text('15. OTHER DATE', IN(2.977), 391.2);
    text('QUAL.', IN(3.0), 403);
    tick(IN(3.25), 396, L(34));
    tick(IN(3.6), 390, 402);
    dateCaptions(40, 43, 46, 4, 396.8);
    tick(G(42), 395, L(34));
    tick(G(45), 395, L(34));
    text('16. DATES PATIENT UNABLE TO WORK IN CURRENT OCCUPATION', IN(5.2), 391.2);
    fromToDates(396.8);

    // 17, 17a, 17b, 18
    text('17. NAME OF REFERRING PROVIDER OR OTHER SOURCE', IN(0.3), 415);
    tick(G(6), 420, L(36));
    shade(G(30), L(34), MID, L(35));
    hline(L(35), IN(3.165), MID, THIN, true);
    vline(IN(3.165), L(34), L(36));
    vline(IN(3.395), L(34), L(36));
    text('17a.', IN(3.0), 417.5);
    text('17b.', IN(3.0), 429.5);
    text('NPI', IN(3.22), 429.5);
    text('18. HOSPITALIZATION DATES RELATED TO CURRENT SERVICES', IN(5.2), 415);
    fromToDates(420.8);

    // 19, 20
    text('19. ADDITIONAL CLAIM INFORMATION (Designated by NUCC)', IN(0.3), 439);
    text('20. OUTSIDE LAB?', IN(5.2), 439);
    text('$ CHARGES', IN(6.8), 439);
    checkbox(55, 38, 'YES');
    checkbox(60, 38, 'NO');
    vline(IN(6.31), L(37), L(38));
    vline(IN(7.28), L(37), L(38));

    // 21
    text('21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY  Relate A-L to service line below (24E)', IN(0.3), 463);
    text('ICD Ind.', IN(4.033), 466);
    tick(G(44), 458, 470);
    tick(G(46), 458, 470);
    const codeSlots: [number, number, number][] = [
      [0.35, 0.467, 1.17],
      [1.64, 1.76, 2.47],
      [2.95, 3.06, 3.78],
      [4.27, 4.38, 5.09],
    ];
    ['ABCD', 'EFGH', 'IJKL'].forEach((letters, row) => {
      const underline = 479 + row * 12;
      codeSlots.forEach(([captionX, x0, x1], i) => {
        text(`${letters[i]}.`, IN(captionX), underline - 1);
        vline(IN(x0), underline - 9, underline);
        hline(underline, IN(x0), IN(x1));
      });
    });

    // 22, 23
    text('22. RESUBMISSION', IN(5.2), 463);
    text('CODE', IN(5.333), 469.5);
    text('ORIGINAL REF. NO.', IN(6.477), 469.5);
    vline(IN(6.31), 468, L(40));
    text('23. PRIOR AUTHORIZATION NUMBER', IN(5.2), 487);
  }

  function fromToDates(captionBaseline: number): void {
    dateCaptions(57, 60, 63, 4, captionBaseline);
    dateCaptions(71, 74, 77, 4, captionBaseline);
    text('FROM', IN(5.327), captionBaseline + 7.5);
    text('TO', IN(6.833), captionBaseline + 7.5);
    const top = captionBaseline - 2;
    [59, 62, 73, 76].forEach((col) => tick(G(col), top, top + 13));
  }

  function drawServiceLines(): void {
    // Header
    const header = L(42);
    const baselines = [header + 6.5, header + 13.5, header + 21];
    const columns: [string[], number, number][] = [
      [['B.', 'PLACE OF', 'SERVICE'], G(21), G(24)],
      [['C.', '', 'EMG'], G(24), G(27)],
      [['E.', 'DIAGNOSIS', 'POINTER'], G(47), G(52)],
      [['F.', '', '$ CHARGES'], G(52), G(61)],
      [['I.', 'ID.', 'QUAL'], G(67), G(70)],
      [['J.', 'RENDERING', 'PROVIDER ID. #'], G(70), RIGHT],
    ];
    columns.forEach(([captions, x0, x1]) =>
      captions.forEach((caption, i) => {
        if (caption) fitted(caption, x0, x1, baselines[i]);
      })
    );
    const smallStacks: [string[], number, number][] = [
      [['G.', 'DAYS', 'OR', 'UNITS'], G(61), G(65)],
      [['H.', 'EPSDT', 'Family', 'Plan'], G(65), G(67)],
    ];
    smallStacks.forEach(([captions, x0, x1]) => {
      centered(captions[0], x0, x1, baselines[0]);
      captions.slice(1).forEach((caption, i) => fitted(caption, x0, x1, header + 11.5 + i * 5, 4.8));
    });
    text('24.  A.', IN(0.3), baselines[0]);
    text('DATE(S) OF SERVICE', IN(0.74), baselines[0]);
    centered('From', LEFT, G(12), baselines[1]);
    centered('To', G(12), G(21), baselines[1]);
    [3, 6, 9, 12, 15, 18].forEach((gutterCol, i) =>
      centered(['MM', 'DD', 'YY'][i % 3], G(gutterCol), G(gutterCol + 3), baselines[2])
    );
    text('D. PROCEDURES, SERVICES, OR SUPPLIES', IN(2.717), baselines[0]);
    text('(Explain Unusual Circumstances)', IN(2.9), baselines[1]);
    centered('CPT/HCPCS', G(27), G(34), baselines[2]);
    vline(G(34), header + 15, L(44));
    text('MODIFIER', IN(3.82), baselines[2]);
    [21, 24, 27, 47, 52, 61, 65, 67, 70].forEach((col) => vline(G(col), L(42), L(44)));

    // Six service lines: a shaded supplemental row above each main row
    const solid = [12, 21, 24, 34, 47, 52, 61, 65];
    const dashed = [6, 9, 15, 18, 38, 41, 44, 58];
    for (let i = 0; i < 6; i++) {
      const top = L(44 + 2 * i);
      const middle = top + 12;
      const bottom = top + 24;
      shade(LEFT, top, RIGHT, middle);
      hline(bottom, LEFT, RIGHT);
      solid.forEach((col) => vline(G(col), middle, bottom));
      dashed.forEach((col) => vline(G(col), middle, bottom, THIN, true));
      vline(G(27), middle, bottom, 1.2);
      vline(G(67), top, bottom);
      vline(G(70), top, bottom);
      hline(middle, G(67), RIGHT, THIN, true);
      centered('NPI', G(67), G(70), bottom - 2.8, { size: 6.5 });
      text(String(i + 1), IN(0.135), middle + 4.4, { size: 15 });
    }
    hline(L(44), LEFT, RIGHT);

    // 25-30
    const row = L(56);
    hline(L(58), LEFT, RIGHT);
    [G(25), IN(3.915), MID, IN(6.278), IN(7.238)].forEach((x) => vline(x, row, L(58)));
    text('25. FEDERAL TAX I.D. NUMBER', IN(0.3), row + 6.5);
    text('SSN', IN(1.893), row + 6.5);
    text('EIN', IN(2.1), row + 6.5);
    cornerBox(20, 58, 'top');
    cornerBox(22, 58, 'top');
    text("26. PATIENT'S ACCOUNT NO.", IN(2.5), row + 6.5);
    text('27. ACCEPT ASSIGNMENT?', IN(3.95), row + 6.5);
    text('(For govt. claims, see back)', IN(4.02), row + 11.5, { size: 4.8 });
    checkbox(41, 58, 'YES');
    checkbox(46, 58, 'NO');
    text('28. TOTAL CHARGE', IN(5.2), row + 6.5);
    text('$', IN(5.24), L(58) - 3.5, { size: 7 });
    text('29. AMOUNT PAID', IN(6.31), row + 6.5);
    text('$', IN(6.36), L(58) - 3.5, { size: 7 });
    text('30. Rsvd for NUCC Use', IN(7.27), row + 6.5);
    [IN(6.0), IN(7.0), IN(7.9)].forEach((x) => vline(x, row + 14, L(58), THIN, true));

    // 31, 32, 33
    vline(G(25), L(58), L(63));
    vline(MID, L(58), L(63));
    hline(L(62), G(25), RIGHT);
    shade(IN(3.61), L(62), MID, L(63));
    shade(IN(6.31), L(62), RIGHT, L(63));
    vline(IN(3.61), L(62), L(63));
    vline(IN(6.31), L(62), L(63));
    text('31. SIGNATURE OF PHYSICIAN OR SUPPLIER', IN(0.3), 702.5);
    text('INCLUDING DEGREES OR CREDENTIALS', IN(0.45), 709.5);
    text('(I certify that the statements on the reverse', IN(0.45), 716.4);
    text('apply to this bill and are made a part thereof.)', IN(0.45), 723.1);
    text('SIGNED', IN(0.317), 754);
    text('DATE', IN(1.817), 754);
    text('32. SERVICE FACILITY LOCATION INFORMATION', IN(2.5), 702.5);
    text('33. BILLING PROVIDER INFO & PH #', IN(5.2), 702.5);
    text('(', IN(6.767), 707.5, { size: 11 });
    text(')', IN(7.117), 707.5, { size: 11 });
    for (const [aX, bX, x0, x1] of [
      [2.5, 3.627, G(25), IN(3.61)],
      [5.2, 6.323, MID, IN(6.31)],
    ]) {
      centered('NPI', x0, x1, 755, { size: 17, font: fonts.bold, color: GHOST });
      text('a.', IN(aX), 750);
      text('b.', IN(bX), 750);
    }
  }

  function drawFooterAndSideBars(): void {
    // Outer frame
    vline(LEFT, L(8), L(63));
    vline(RIGHT, L(8), L(63));
    hline(L(63), LEFT, RIGHT, 2.9);
    text('NUCC Instruction Manual available at: www.nucc.org', IN(0.275), 765.5, { size: 7.9 });
    text('PLEASE PRINT OR TYPE', IN(3.467), 766, { size: 7.9, font: fonts.boldItalic });
    rightAligned('APPROVED OMB-0938-1197 FORM 1500 (02-12)', RIGHT + 2, 766, { size: 8.2 });

    const sections: [string, number, number][] = [
      ['CARRIER', IN(0.32), L(8)],
      ['PATIENT AND INSURED INFORMATION', L(8), L(32)],
      ['PHYSICIAN OR SUPPLIER INFORMATION', L(32), L(63)],
    ];
    sections.forEach(([label, top, bottom]) => {
      const start = top + 2;
      const end = bottom - 2;
      vline(SIDE_BAR, start, end, 0.9);
      hline(start, SIDE_BAR - 4, SIDE_BAR + 4, 0.9);
      hline(end, SIDE_BAR - 4, SIDE_BAR + 4, 0.9);
      arrowhead(start, 1);
      arrowhead(end, -1);
      const size = 8.2;
      const width = fonts.bold.widthOfTextAtSize(label, size);
      const center = (start + end) / 2;
      page.drawRectangle({ x: SIDE_BAR - 5, y: y(center + width / 2 + 3), width: 10, height: width + 6, color: WHITE });
      page.drawText(label, {
        x: SIDE_BAR + 2.9,
        y: y(center + width / 2),
        size,
        font: fonts.bold,
        color: RED,
        rotate: degrees(90),
      });
    });
  }

  // Filled triangle at a side bar end; direction 1 points up, -1 points down.
  function arrowhead(tip: number, direction: 1 | -1): void {
    page.drawSvgPath(`M 0 0 L -3.4 ${direction * 9} L 3.4 ${direction * 9} Z`, {
      x: SIDE_BAR,
      y: y(tip),
      color: RED,
      borderWidth: 0,
    });
  }
}

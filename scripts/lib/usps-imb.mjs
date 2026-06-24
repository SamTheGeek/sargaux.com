/**
 * USPS Intelligent Mail Barcode (IMb) encoder.
 *
 * Implements the USPS-B-3200 4-State Customer Barcode algorithm (USPS Pub 109,
 * Appendix C): big-number arithmetic over a 10-limb base-2048 representation,
 * an 11-bit CRC frame check, conversion into ten 13-bit codewords (weight-2 and
 * weight-5 Reed-Solomon-style codeword tables), and a fixed 65-bar permutation
 * mapping codewords to Ascender/Descender/Tracker/Full bars.
 *
 * Ported (ESM, dependency-free) from the CC0/public-domain "imb" npm package
 * (github.com/SuperSephy/imb, itself adapted from Bob Codes' IMb decoder,
 * bobcodes.weebly.com/imb.html). The bar-permutation tables below are
 * verified against the worked example in USPS documentation:
 *   barcodeId=00 serviceType=270 mailerId=123456 serialNum=200800001
 *   zip=98765 plus4=4321 deliveryPoint=01
 *   → TTFAFDADTFFFADTAFAFTTDATDFAAFTDAFDFDFDATFDFTDDDDFADFFDADDTDDTTDAT
 */

// ─── Bar permutation tables (USPS Pub 109 Table 4) ────────────────────────────

const ASC_CHAR = [
  4, 0, 2, 6, 3, 5, 1, 9, 8, 7, 1, 2, 0,
  6, 4, 8, 2, 9, 5, 3, 0, 1, 3, 7, 4, 6,
  8, 9, 2, 0, 5, 1, 9, 4, 3, 8, 6, 7, 1,
  2, 4, 3, 9, 5, 7, 8, 3, 0, 2, 1, 4, 0,
  9, 1, 7, 0, 2, 4, 6, 3, 7, 1, 9, 5, 8,
];
const ASC_BIT = [
  8, 1, 256, 2048, 2, 4096, 256, 2048,
  1024, 64, 16, 4096, 4, 128, 512, 64,
  128, 512, 4, 256, 16, 1, 4096, 128,
  1024, 512, 1, 128, 1024, 32, 128,
  512, 64, 256, 4, 4096, 2, 16, 4, 1,
  2, 32, 16, 64, 4096, 2, 1, 512, 16,
  128, 32, 1024, 4, 64, 512, 2048, 4,
  4096, 64, 128, 32, 2048, 1, 8, 4,
];
const DESC_CHAR = [
  7, 1, 9, 5, 8, 0, 2, 4, 6, 3, 5, 8, 9,
  7, 3, 0, 6, 1, 7, 4, 6, 8, 9, 2, 5, 1,
  7, 5, 4, 3, 8, 7, 6, 0, 2, 5, 4, 9, 3,
  0, 1, 6, 8, 2, 0, 4, 5, 9, 6, 7, 5, 2,
  6, 3, 8, 5, 1, 9, 8, 7, 4, 0, 2, 6, 3,
];
const DESC_BIT = [
  4, 1024, 4096, 32, 512, 2, 32, 16, 8,
  512, 2048, 32, 1024, 2, 64, 8, 16, 2,
  1024, 1, 4, 2048, 256, 64, 2, 4096,
  8, 256, 64, 16, 16, 2048, 1, 64, 2,
  512, 2048, 32, 8, 128, 8, 1024,
  128, 2048, 256, 4, 1024, 8, 32, 256,
  1, 8, 4096, 2048, 256, 16, 32, 2, 8,
  1, 128, 4096, 512, 256, 1024,
];

// ─── Codeword table (USPS Pub 109 Table 5) ────────────────────────────────────
// Built once at module load: every 13-bit value with population count 5 (1287
// codewords) or 2 (78 codewords) is assigned a slot in a 1365-entry table,
// front-filled with forward/reverse pairs and back-filled with palindromes.

const ENCODE_TABLE = new Array(1365);

function buildCodewordTable(bits, low, hi) {
  for (let fwd = 0; fwd < 8192; fwd++) {
    let pop = 0;
    let rev = 0;
    let tmp = fwd;
    for (let bit = 0; bit < 13; bit++) {
      pop += tmp & 1;
      rev = (rev << 1) | (tmp & 1);
      tmp >>= 1;
    }
    if (pop !== bits) continue;

    if (fwd === rev) {
      ENCODE_TABLE[hi] = fwd;
      hi--;
    } else if (fwd < rev) {
      ENCODE_TABLE[low] = fwd;
      low++;
      ENCODE_TABLE[low] = rev;
      low++;
    }
  }
}
buildCodewordTable(5, 0, 1286);
buildCodewordTable(2, 1287, 1364);

// ─── Big-number helpers (10 limbs of 11 bits each) ────────────────────────────

function add(num, value) {
  for (let n = num.length - 1; n >= 0 && value !== 0; n--) {
    const x = num[n] + value;
    value = x >> 11;
    num[n] = x & 0x7ff;
  }
}

function multiplyAndAdd(num, multiplier, value) {
  for (let n = num.length - 1; n >= 0; n--) {
    const x = num[n] * multiplier + value;
    value = x >> 11;
    num[n] = x & 0x7ff;
  }
}

function divideModulus(num, divisor) {
  let mod = 0;
  for (let n = 0; n < num.length; n++) {
    const x = num[n] + (mod << 11);
    const q = Math.floor(x / divisor);
    num[n] = q;
    mod = x - q * divisor;
  }
  return mod;
}

function calculateFrameCheck(num) {
  let fcs = 0x1f0;
  for (let n = 0; n < num.length; n++) {
    fcs ^= num[n];
    for (let bit = 0; bit < 11; bit++) {
      fcs <<= 1;
      if (fcs & 0x800) fcs ^= 0xf35;
    }
  }
  return fcs;
}

function charactersToText(chars) {
  let barcode = '';
  for (let n = 0; n < 65; n++) {
    const desc = chars[DESC_CHAR[n]] & DESC_BIT[n];
    const asc = chars[ASC_CHAR[n]] & ASC_BIT[n];
    if (desc) barcode += asc ? 'F' : 'D';
    else barcode += asc ? 'A' : 'T';
  }
  return barcode;
}

// ─── Input validation ──────────────────────────────────────────────────────────

function isDigits(str, ...validLengths) {
  if (typeof str !== 'string' || /\D/.test(str)) return false;
  return validLengths.length === 0 || validLengths.includes(str.length);
}

/**
 * @typedef {{
 *   barcodeId: string,      2 digits, second digit must be 0-4
 *   serviceType: string,    3 digits
 *   mailerId: string,       6 or 9 digits
 *   serialNum: string,      9 or 6 digits (mailerId.length + serialNum.length === 15)
 *   zip?: string,           5 digits, optional
 *   plus4?: string,         4 digits, optional (requires zip)
 *   deliveryPoint?: string, 2 digits, optional (requires plus4)
 * }} ImbFields
 */

/** Throws a descriptive Error if the IMb fields are malformed. */
function validateImbFields(fields) {
  if (!isDigits(fields.barcodeId, 2)) throw new Error('barcodeId must be 2 digits');
  if (Number(fields.barcodeId[1]) > 4) throw new Error('Second digit of barcodeId must be 0-4');
  if (!isDigits(fields.serviceType, 3)) throw new Error('serviceType must be 3 digits');
  if (!isDigits(fields.mailerId, 6, 9)) throw new Error('mailerId must be 6 or 9 digits');
  if (!isDigits(fields.serialNum) || fields.mailerId.length + fields.serialNum.length !== 15) {
    throw new Error('mailerId and serialNum together must total 15 digits');
  }
  if (fields.plus4 && !fields.zip) throw new Error('zip is required if plus4 is provided');
  if (fields.deliveryPoint && !fields.plus4) throw new Error('plus4 is required if deliveryPoint is provided');
  if (fields.zip && !isDigits(fields.zip, 5)) throw new Error('zip must be 5 digits');
  if (fields.plus4 && !isDigits(fields.plus4, 4)) throw new Error('plus4 must be 4 digits');
  if (fields.deliveryPoint && !isDigits(fields.deliveryPoint, 2)) throw new Error('deliveryPoint must be 2 digits');
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Encode USPS Intelligent Mail Barcode fields into the 65-character bar
 * string (A=Ascender, D=Descender, T=Tracker, F=Full).
 * @param {ImbFields} fields
 * @returns {string}
 */
export function encodeImb(fields) {
  validateImbFields(fields);

  const num = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let marker = 0;

  if (fields.zip) {
    num[9] = parseInt(fields.zip, 10);
    marker += 1;
  }
  if (fields.plus4) {
    multiplyAndAdd(num, 10000, parseInt(fields.plus4, 10));
    marker += 100000;
  }
  if (fields.deliveryPoint) {
    multiplyAndAdd(num, 100, parseInt(fields.deliveryPoint, 10));
    marker += 1000000000;
  }
  add(num, marker);

  multiplyAndAdd(num, 10, parseInt(fields.barcodeId[0], 10));
  multiplyAndAdd(num, 5, parseInt(fields.barcodeId[1], 10));
  multiplyAndAdd(num, 1000, parseInt(fields.serviceType, 10));

  if (fields.mailerId.length === 6) {
    multiplyAndAdd(num, 1000000, parseInt(fields.mailerId, 10));
    multiplyAndAdd(num, 100000, 0); // split to avoid overflowing a 32-bit multiply
    multiplyAndAdd(num, 10000, parseInt(fields.serialNum, 10));
  } else {
    multiplyAndAdd(num, 10000, 0);
    multiplyAndAdd(num, 100000, parseInt(fields.mailerId, 10));
    multiplyAndAdd(num, 1000000, parseInt(fields.serialNum, 10));
  }

  const fcs = calculateFrameCheck(num);

  const cw = new Array(10);
  cw[9] = divideModulus(num, 636) << 1;
  for (let n = 8; n > 0; n--) cw[n] = divideModulus(num, 1365);
  cw[0] = (num[8] << 11) | num[9];
  if (fcs & (1 << 10)) cw[0] += 659;

  const chars = new Array(10);
  for (let n = 0; n < 10; n++) {
    chars[n] = ENCODE_TABLE[cw[n]];
    if (fcs & (1 << n)) chars[n] ^= 8191;
  }

  return charactersToText(chars);
}

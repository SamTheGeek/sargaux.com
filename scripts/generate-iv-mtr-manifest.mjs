#!/usr/bin/env node
/**
 * Generate a manifest file for retroactively registering existing mailpieces
 * in USPS Informed Visibility (IV-MTR).
 *
 * Combines:
 * - Existing IMb serials and barcodes from usps-imb-serials.json
 * - Recipient addresses from the invitation CSV files
 * - Known mailing dates
 *
 * Output: iv-mtr-manifest.csv (for uploading to USPS IV-MTR system)
 *
 * Format is a delimited CSV with fields:
 * - IMb (full barcode)
 * - RecipientName
 * - Address1
 * - City
 * - State
 * - Zip
 * - Country
 * - MailingDate
 * - ServiceType
 * - PieceType
 *
 * Usage:
 *   node scripts/generate-iv-mtr-manifest.mjs
 *
 * Requires: usps-imb-serials.json, invitation-addresses-*.csv files
 */

import { readFileSync, writeFileSync } from 'fs';

// Simple CSV parser
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });
    records.push(record);
  }
  return records;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Read the serials registry
const serialsJson = JSON.parse(readFileSync('./scripts/data/usps-imb-serials.json', 'utf8'));
const serialsMap = new Map(Object.entries(serialsJson).map(([key, serial]) => [serial, key]));

// Read invitation CSVs
const nycCsv = readFileSync('./scripts/output/invitation-addresses-nyc-20260705.csv', 'utf8');
const franceCsv = readFileSync('./scripts/output/invitation-addresses-france-20260705.csv', 'utf8');

const nycRecords = parseCSV(nycCsv);
const franceRecords = parseCSV(franceCsv);

// Build manifest
const manifest = [];
manifest.push([
  'IMb',
  'RecipientName',
  'Address1',
  'Address2',
  'City',
  'State',
  'Zip',
  'Country',
  'MailingDate',
  'ServiceType',
  'PieceType'
]);

// Process NYC invitations
console.log('Processing NYC invitations...');
for (const row of nycRecords) {
  if (!row.EnvelopeName || !row.UspsImbBarcodeInvitation) continue;
  if (row.Country !== 'United States') continue; // Skip non-US

  manifest.push([
    row.UspsImbBarcodeInvitation,
    row.EnvelopeName,
    row.Address1 || '',
    row.Address2 || '',
    row.City || '',
    row.State || '',
    row.Postcode ? row.Postcode.split('-')[0] : '', // Extract ZIP5
    row.Country || '',
    '2026-06-24', // Estimated NYC invitation mailing date
    'First-Class Mail',
    'Invitation'
  ]);
}

// Process France pieces (both Save-the-Date and Invitation)
console.log('Processing France save-the-dates and invitations...');
for (const row of franceRecords) {
  if (!row.EnvelopeName) continue;
  if (row.Country !== 'United States') continue; // Skip non-US (France addresses can't be tracked via IV-MTR)

  // Save-the-Date
  if (row.UspsImbBarcodeSaveTheDate) {
    manifest.push([
      row.UspsImbBarcodeSaveTheDate,
      row.EnvelopeName,
      row.Address1 || '',
      row.Address2 || '',
      row.City || '',
      row.State || '',
      row.Postcode ? row.Postcode.split('-')[0] : '',
      row.Country || '',
      '2026-04-01', // Estimated France save-the-date mailing date
      'First-Class Mail',
      'SaveTheDate'
    ]);
  }

  // Invitation
  if (row.UspsImbBarcodeInvitation) {
    manifest.push([
      row.UspsImbBarcodeInvitation,
      row.EnvelopeName,
      row.Address1 || '',
      row.Address2 || '',
      row.City || '',
      row.State || '',
      row.Postcode ? row.Postcode.split('-')[0] : '',
      row.Country || '',
      '2026-05-15', // Estimated France invitation mailing date
      'First-Class Mail',
      'Invitation'
    ]);
  }
}

// Write CSV
const csv = manifest.map(row => row.map(col => `"${(col || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
writeFileSync('./scripts/output/iv-mtr-manifest.csv', csv);

console.log(`\nManifest generated: scripts/output/iv-mtr-manifest.csv`);
console.log(`Total pieces: ${manifest.length - 1}`);
console.log('');
console.log('TO USE THIS FILE:');
console.log('1. Log into https://iv.usps.com');
console.log('2. Go to: Queries & Feeds > Create & Manage Data Feeds > Create a New Feed');
console.log('3. Select:');
console.log('   - Feed Data Type: "Select" (or appropriate type)');
console.log('   - File Format: "Delimited File"');
console.log('   - Delimiter: Comma');
console.log('   - Define Target: Online Download (or SFTP server if configured)');
console.log('   - Frequency: One-time');
console.log('4. Upload this CSV file');
console.log('5. IMPORTANT: Data feeds only deliver events GOING FORWARD.');
console.log('   Pieces already delivered may not accumulate historical tracking.');
console.log('   For existing pieces, use a One-Time Query (Section 7) to check current status.');

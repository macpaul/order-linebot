/**
 * scripts/bundle.js
 * Concatenates src/ modules into a single dist/Code.gs for easy copy-pasting into Google Apps Script.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const fileOrder = [
  'Config.js',
  'I18n.js',
  'LineService.js',
  'SheetService.js',
  'UberEatsService.js',
  'FlexMessage.js',
  'OrderService.js',
  'Code.js'
];

let bundledContent = `/**
 * LINE Meal Ordering Bot for Google Apps Script (All-In-One Bundle)
 * Automatically generated on: ${new Date().toISOString()}
 * 
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Paste this entire content into Code.gs
 * 3. Set Project Settings -> Script Properties (CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET)
 * 4. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 */

`;

fileOrder.forEach(file => {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    bundledContent += `\n/* =========================================================\n * File: ${file}\n * ========================================================= */\n\n`;
    bundledContent += fs.readFileSync(filePath, 'utf8') + '\n';
  }
});

const distPath = path.join(distDir, 'Code.gs');
fs.writeFileSync(distPath, bundledContent, 'utf8');
console.log(`Successfully bundled ${fileOrder.length} files into ${distPath} (${(bundledContent.length / 1024).toFixed(1)} KB)`);

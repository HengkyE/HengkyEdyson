/**
 * Local Printer Server
 * Runs on your MacBook to bridge web app and USB printer
 * 
 * Usage: node services/printer-server.js
 * 
 * This server listens on http://localhost:3001 and accepts print requests
 * from your web app, then forwards ESC/POS commands to the USB printer.
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const isWindows = process.platform === 'win32';
// Printer name - will auto-detect if not specified
// You can also set this via environment variable: PRINTER_NAME="Your Printer Name"
let PRINTER_NAME = process.env.PRINTER_NAME || null;

/**
 * Match thermal / ESC/POS printers (80-V-LL, POS80, EPSON, etc.)
 */
function matchThermalPrinter(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('80-v-ll') ||
    lower.includes('80vll') ||
    lower.includes('pos80') ||
    lower.includes('stmicroelectronics') ||
    lower.includes('thermal') ||
    lower.includes('receipt') ||
    lower.includes('80mm') ||
    lower.includes('epson') ||
    lower.includes('esc/pos')
  );
}

/**
 * Find a thermal/POS printer automatically (80-V-LL, POS80, EPSON, etc.)
 */
function findPOS80Printer(callback) {
  getPrinters((error, printers) => {
    if (error) {
      callback(error, null);
      return;
    }
    if (printers.length === 0) {
      callback(new Error('No printers found'), null);
      return;
    }
    // Prefer 80-V-LL / thermal / EPSON / POS80
    const thermalPrinter = printers.find(p => matchThermalPrinter(p.name));
    const chosen = thermalPrinter || printers[0];
    if (!thermalPrinter && printers.length > 1) {
      console.warn(`No thermal printer matched. Using first available: ${chosen.name}`);
    }
    callback(null, chosen.name);
  });
}

/**
 * Send raw data to printer (macOS/Linux: lp, Windows: printer package or fallback)
 */
function sendToPrinter(data, printerName, callback) {
  const buffer = Buffer.from(data);

  if (isWindows) {
    sendToPrinterWindows(buffer, printerName, callback);
  } else {
    sendToPrinterUnix(buffer, printerName, callback);
  }
}

function sendToPrinterUnix(buffer, printerName, callback) {
  const tempFile = path.join(__dirname, '../temp_print_data.bin');
  fs.writeFile(tempFile, buffer, (err) => {
    if (err) {
      callback(err);
      return;
    }
    const command = `lp -d "${printerName.replace(/"/g, '\\"')}" -o raw "${tempFile}"`;
    exec(command, (error, stdout, stderr) => {
      fs.unlink(tempFile, () => {});
      if (error) {
        console.error('Print error:', error);
        callback(error);
        return;
      }
      if (stderr) console.warn('Print warning:', stderr);
      callback(null, stdout);
    });
  });
}

function sendToPrinterWindows(buffer, printerName, callback) {
  try {
    const printer = require('printer');
    printer.printDirect({
      data: buffer,
      printer: printerName,
      type: 'RAW',
      success: () => callback(null, 'OK'),
      error: (err) => callback(err || new Error('Print failed')),
    });
  } catch (e) {
    callback(new Error(
      'Raw printing on Windows requires the "printer" package. Run: npm install printer. ' +
      'Then restart the printer server.'
    ));
  }
}

/**
 * Get list of available printers (macOS/Linux: lpstat, Windows: wmic or printer package)
 */
function getPrinters(callback) {
  if (isWindows) {
    getPrintersWindows(callback);
  } else {
    getPrintersUnix(callback);
  }
}

function getPrintersUnix(callback) {
  exec('lpstat -p -d', (error, stdout, stderr) => {
    if (error) {
      callback(error, []);
      return;
    }
    const printers = [];
    const lines = stdout.split('\n');
    lines.forEach(line => {
      const match = line.match(/printer (.+?) is/);
      if (match) {
        printers.push({
          name: match[1].trim(),
          status: line.includes('idle') ? 'idle' : 'busy',
        });
      }
    });
    callback(null, printers);
  });
}

function getPrintersWindows(callback) {
  function fallbackWmic() {
    exec('wmic printer get name', { encoding: 'utf16le' }, (error, stdout) => {
      if (error) {
        callback(error, []);
        return;
      }
      const printers = [];
      const lines = (stdout || '').split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === 'name') continue;
        if (lines[i]) printers.push({ name: lines[i], status: 'idle' });
      }
      callback(null, printers);
    });
  }
  try {
    const printer = require('printer');
    const list = printer.getPrinters();
    if (list && list.length > 0) {
      callback(null, list.map(p => ({ name: p.name || p.displayName || '', status: 'idle' })));
    } else {
      fallbackWmic();
    }
  } catch (e) {
    fallbackWmic();
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Health check endpoint
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Printer server is running' }));
    return;
  }
  
  // Get printers list
  if (url.pathname === '/printers' && req.method === 'GET') {
    getPrinters((error, printers) => {
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ printers }));
    });
    return;
  }
  
  // Print endpoint
  if (url.pathname === '/print' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        if (!data.commands || !Array.isArray(data.commands)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request: commands array required' }));
          return;
        }
        
        // Convert array of numbers back to Uint8Array
        const uint8Array = new Uint8Array(data.commands);
        
        // Get printer name (use cached or find it)
        const printerNameToUse = PRINTER_NAME;
        
        if (!printerNameToUse) {
          // Find printer for this request
          findPOS80Printer((err, name) => {
            if (err || !name) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Printer not found. Please ensure printer is connected and powered on.' }));
              return;
            }
            
            PRINTER_NAME = name;
            console.log(`Using printer: ${PRINTER_NAME}`);
            
            sendToPrinter(uint8Array, PRINTER_NAME, (error, result) => {
              if (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
                return;
              }
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Print command sent' }));
            });
          });
          return;
        }
        
        sendToPrinter(uint8Array, printerNameToUse, (error, result) => {
          if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Print command sent' }));
        });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 Printer Server running on http://localhost:${PORT}`);
  
  // Auto-detect printer on startup
  findPOS80Printer((err, printerName) => {
    if (err || !printerName) {
      console.log(`⚠️  Printer: Not found (will auto-detect on first print)`);
      console.log(`   Make sure your printer is connected and powered on`);
    } else {
      PRINTER_NAME = printerName;
      console.log(`✅ Printer: ${PRINTER_NAME}`);
    }
    
    console.log(`\nEndpoints:`);
    console.log(`  GET  /health   - Health check`);
    console.log(`  GET  /printers - List available printers`);
    console.log(`  POST /print    - Send print commands\n`);
  });
});

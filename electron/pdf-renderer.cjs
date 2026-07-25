const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function createPdfRenderer(BrowserWindow) {
  return async (html, outputFile, pageSize) => {
    const tempFile = path.join(path.dirname(outputFile), `.render-${crypto.randomUUID()}.html`);
    const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await fs.writeFile(tempFile, html, 'utf8');
      await printWindow.loadFile(tempFile);
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize,
        preferCSSPageSize: true,
        margins: { marginType: 'none' }
      });
      await fs.writeFile(outputFile, pdf);
    } finally {
      printWindow.destroy();
      await fs.rm(tempFile, { force: true });
    }
  };
}

module.exports = { createPdfRenderer };

const fs = require('fs');

const content = fs.readFileSync('articulos.csv', 'utf8');
const lines = content.split('\n').filter(line => line.trim() !== '');

// Find data lines (they start with LAB-)
const dataLines = lines.filter(line => line.startsWith('LAB-'));

const articles = [];
const suppliersSet = new Set();
const suppliers = [];

dataLines.forEach(line => {
  // Use regex to split by comma outside quotes
  const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  if (parts.length >= 12) {
    const id = parts[0].replace(/"/g, '').trim();
    const name = parts[1].replace(/"/g, '').trim();
    const category = parts[2].replace(/"/g, '').trim();
    const supplierName = parts[3].replace(/"/g, '').trim();
    const supplierRef = parts[5].replace(/"/g, '').trim();
    const priceStr = parts[9].replace(/"/g, '').trim(); // Precio CON IVA
    const minStock = parseInt(parts[10].replace(/"/g, '').trim(), 10);
    
    // generate default random stock for mockup
    const stock = Math.floor(Math.random() * (minStock * 3)) + 1;
    
    articles.push({
      id,
      name,
      category,
      supplierName,
      supplierRef,
      stock,
      minStock,
      price: priceStr
    });
    
    if (supplierName && !suppliersSet.has(supplierName)) {
      suppliersSet.add(supplierName);
      suppliers.push({
        id: `PROV-${String(suppliers.length + 1).padStart(3, '0')}`,
        name: supplierName,
        contact: 'Contacto Gral.',
        email: `contacto@${supplierName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+34 600 ${Math.floor(100000 + Math.random() * 900000)}`
      });
    }
  }
});

const output = `
export const mockArticles = ${JSON.stringify(articles, null, 2)};

export const mockSuppliers = ${JSON.stringify(suppliers, null, 2)};
`;

fs.writeFileSync('src/data.js', output);

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('imported_articles.json', 'utf8'));

let sql = "INSERT INTO articles (id, name, category, \"supplierName\", \"supplierRef\", price, stock, \"minStock\") VALUES\n";

const values = data.map((art, i) => {
  const idStr = `'ART-BIO-25-${i.toString().padStart(4, '0')}'`;
  const nameStr = `'${art.name.replace(/'/g, "''")}'`;
  const refStr = `'${art.supplierRef.replace(/'/g, "''")}'`;
  return `(${idStr}, ${nameStr}, 'General', 'BIOLINEA', ${refStr}, '${art.price}', 0, 5)`;
});

sql += values.join(",\n") + "\nON CONFLICT (id) DO NOTHING;";

fs.writeFileSync('import_2025.sql', sql);
console.log('Saved to import_2025.sql');

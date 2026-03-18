import fs from 'fs';
import { mockArticles } from './src/data.js';

let sql = `INSERT INTO articles (id, name, category, "supplierName", "supplierRef", price, stock, "minStock") VALUES\n`;

const values = mockArticles.map(art => {
  const sanitize = (str) => str ? str.replace(/'/g, "''") : '';
  return `('${sanitize(art.id)}', '${sanitize(art.name)}', '${sanitize(art.category)}', '${sanitize(art.supplierName)}', '${sanitize(art.supplierRef || '')}', '${sanitize(art.price)}', ${art.stock}, ${art.minStock})`;
}).join(',\n');

sql += values + ';\n';

fs.writeFileSync('seed.sql', sql);
console.log('seed.sql generated');

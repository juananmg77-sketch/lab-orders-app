import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = '/tmp/biolinea_pdfs/BIOLINEA/11 NOVIEMBRE BIOLINEA 01F125002025.PDF';

let dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('sample_pdf_text.txt', data.text);
    console.log('Saved to sample_pdf_text.txt');
}).catch(console.error);

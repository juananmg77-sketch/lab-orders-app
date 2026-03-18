import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const data = JSON.parse(fs.readFileSync('imported_articles.json', 'utf8'));

async function upload() {
  console.log(`Uploading ${data.length} articles...`);
  
  // Use consistent IDs: ART-BIO-25-XXXX
  data.forEach((item, i) => {
    item.id = `ART-BIO-25-${i.toString().padStart(4, '0')}`;
  });

  const { error } = await supabase
    .from('articles')
    .upsert(data);
    
  if (error) {
    console.error('Error uploading:', error);
  } else {
    console.log('Successfully uploaded articles.');
  }
}

upload();

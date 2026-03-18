import { createClient } from '@supabase/supabase-js';
import { mockArticles } from './data.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log(`Uploading ${mockArticles.length} articles to Supabase...`);
  
  // Omit price transformation if it's stored as text, but let's just insert as is
  const { data, error } = await supabase
    .from('articles')
    .upsert(mockArticles, { onConflict: 'id' });

  if (error) {
    console.error('Error inserting articles:', error);
  } else {
    console.log('Successfully inserted articles.');
  }
}

seed();

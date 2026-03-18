import { supabase } from './src/supabaseClient.js';

async function checkTables() {
  const tables = ['articles', 'suppliers', 'orders'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table}: NOT FOUND or ERROR (${error.message})`);
    } else {
      console.log(`Table ${table}: OK`);
    }
  }
}

checkTables();

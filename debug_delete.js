import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
  console.log("--- Suppliers Table ---");
  const { data: sups } = await supabase.from('suppliers').select('*');
  console.log(sups.map(s => `"${s.name}" (ID: ${s.id})`));

  console.log("\n--- Articles referencing Thermo or similar ---");
  const { data: arts } = await supabase.from('articles').select('name, supplierName');
  
  const thermoArts = arts.filter(a => 
    a.supplierName?.toLowerCase().includes('thermo')
  );
  
  console.log("Found " + thermoArts.length + " articles with 'thermo' in supplierName:");
  thermoArts.forEach(a => console.log(`- Art: "${a.name}", Supplier: "${a.supplierName}"`));

  // Check unique names in articles
  const uniqueNames = [...new Set(arts.map(a => a.supplierName))];
  console.log("\nUnique supplierNames in Articles table:");
  uniqueNames.forEach(n => console.log(`- "${n}"`));
}

debug();

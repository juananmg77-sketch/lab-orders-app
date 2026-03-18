import { supabase } from './src/supabaseClient.js';

async function inspectSchema() {
  console.log("--- Inspecting 'articles' table ---");
  const { data: artData, error: artError } = await supabase.from('articles').select('*').limit(1);
  if (artError) {
    console.error("Error articles:", artError.message);
  } else if (artData && artData.length > 0) {
    console.log("Columns:", Object.keys(artData[0]));
  } else {
    console.log("Table 'articles' is empty, cannot inspect columns easily.");
  }

  console.log("\n--- Inspecting 'orders' table ---");
  const { data: ordData, error: ordError } = await supabase.from('orders').select('*').limit(1);
  if (ordError) {
    console.error("Error orders:", ordError.message);
  } else if (ordData && ordData.length > 0) {
    console.log("Columns:", Object.keys(ordData[0]));
  } else {
    console.log("Table 'orders' is empty, cannot inspect columns easily.");
  }
  
  console.log("\n--- Inspecting 'suppliers' table ---");
  const { data: supData, error: supError } = await supabase.from('suppliers').select('*').limit(1);
  if (supError) {
    console.error("Error suppliers:", supError.message);
  } else if (supData && supData.length > 0) {
    console.log("Columns:", Object.keys(supData[0]));
  } else {
    console.log("Table 'suppliers' is empty, cannot inspect columns easily.");
  }
  
  process.exit(0);
}

inspectSchema();

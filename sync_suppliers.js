import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function sync() {
  // Get all unique supplier names from articles
  const { data: articles, error: artError } = await supabase.from('articles').select('supplierName')
  if (artError) {
    console.error("Error fetching articles:", artError)
    return
  }
  
  const uniqueNames = [...new Set(articles.map(a => a.supplierName).filter(Boolean))]
  console.log(`Found ${uniqueNames.length} unique suppliers in articles.`)
  
  // Get existing suppliers
  const { data: suppliers, error: supError } = await supabase.from('suppliers').select('name')
  if (supError) {
    console.error("Error fetching suppliers:", supError)
    return
  }
  
  const existingNames = new Set(suppliers.map(s => s.name))
  const toAdd = uniqueNames.filter(name => !existingNames.has(name))
  
  if (toAdd.length === 0) {
    console.log("All suppliers are already in the database.")
    return
  }
  
  console.log(`Adding ${toAdd.length} new suppliers to the directory...`)
  const { error: insError } = await supabase.from('suppliers').insert(
    toAdd.map(name => ({ name }))
  )
  
  if (insError) {
    console.error("Error inserting suppliers:", insError)
  } else {
    console.log("Sync complete!")
  }
}

sync()

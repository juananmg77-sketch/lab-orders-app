// Server-side proxy — API key never exposed in the browser bundle
const API_BASE = 'https://ltuukumhzmbyvtvicuze.supabase.co/functions/v1/api-hoteles'

exports.handler = async (event) => {
  const apiKey = process.env.HOTELS_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'HOTELS_API_KEY not configured' }) }
  }

  const { endpoint = 'hoteles', ...params } = event.queryStringParameters || {}
  const qs = new URLSearchParams(params).toString()
  const url = `${API_BASE}/${endpoint}${qs ? '?' + qs : ''}`

  try {
    const resp = await fetch(url, { headers: { 'x-api-key': apiKey } })
    const data = await resp.json()
    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) }
  }
}

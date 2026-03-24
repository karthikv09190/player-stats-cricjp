import express from 'express'
import * as cheerio from 'cheerio'
import cors from 'cors'
import axios from 'axios'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors()) // Allow all during debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})
app.use(express.json())

// CricClubs uses <th> for ALL cells (both header and data rows).
// Data rows are in <tbody>, header rows in <thead>.

function parseMultiRowTable($, table) {
  // Get column headers from <thead> th elements
  const headers = []
  $(table).find('thead th').each((_, th) => {
    headers.push($(th).text().trim().toLowerCase().replace(/\s+/g, ' '))
  })
  if (headers.length === 0) return []

  // Parse each <tbody> row — cells are <th> or <td>
  const rows = []
  $(table).find('tbody tr').each((_, tr) => {
    const cells = $(tr).find('th, td')
    if (cells.length === 0) return
    const row = {}
    cells.each((i, cell) => {
      const h = headers[i]
      if (h) row[h] = $(cell).text().trim()
    })
    // Only keep rows with a series type label (skip expansion rows)
    if (row['series type'] && row['series type'].length < 30) {
      rows.push(row)
    }
  })
  return rows
}

function extractStats($) {
  const stats = { formats: [] }
  const title = $('title').text().trim()
  console.log(`[Scraper] Title: "${title}" | Tables: ${$('table').length}`)

  // Player name is in <h4>
  $('h4').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length > 2 && text.length < 60 && !/player view|login|home|message/i.test(text)) {
      stats.name = text
      return false // break
    }
  })

  // Fallback: title tag
  if (!stats.name && title) {
    const titleMatch = title.match(/^([^-|]+)/)
    if (titleMatch) stats.name = titleMatch[1].trim()
  }

  // Parse tables
  const battingRows = []
  const bowlingRows = []

  $('table').each((ti, table) => {
    const headers = []
    $(table).find('thead th').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase())
    })
    if (headers.length === 0) return

    const headerStr = headers.join(' ')
    const isBowling = /wkts|overs|econ/i.test(headerStr)
    const isBatting = !isBowling && /inns|runs|ave|sr/i.test(headerStr)

    if (isBowling || isBatting) {
      const rows = parseMultiRowTable($, table)
      console.log(`[Scraper] Table ${ti}: ${isBatting ? 'Batting' : 'Bowling'} found ${rows.length} rows`)
      if (isBowling) bowlingRows.push(...rows)
      else battingRows.push(...rows)
    }
  })

  // Deduplicate by series type and exclude sub-tables (tables 4+ are season/tournament breakdowns)
  const seenBat = new Set()
  const seenBowl = new Set()
  const validRow = (r) => r['series type'] && !/practice|loading|t10/i.test(r['series type']) && r['series type'].length < 30

  const mainBatting = battingRows.filter(r => {
    if (!validRow(r)) return false
    if (seenBat.has(r['series type'])) return false
    seenBat.add(r['series type'])
    return true
  }).slice(0, 5)

  const mainBowling = bowlingRows.filter(r => {
    if (!validRow(r)) return false
    if (seenBowl.has(r['series type'])) return false
    seenBowl.add(r['series type'])
    return true
  }).slice(0, 5)

  stats.batting = mainBatting
  stats.bowling = mainBowling

  return stats
}

async function fetchWithAxios(url, cookieHeader) {
  const res = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://cricclubs.com/',
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
    },
  })
  return res.data
}

async function fetchWithPuppeteer(url, cookieHeader) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled'],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Optimization: Skip images, CSS, and fonts to save RAM/Time
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const type = req.resourceType()
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) req.abort()
      else req.continue()
    })

    if (cookieHeader && cookieHeader.trim()) {
      const parsedUrl = new URL(url)
      const cookies = cookieHeader.split(';').map(part => {
        const [name, ...rest] = part.trim().split('=')
        return { name: name.trim(), value: rest.join('=').trim(), domain: parsedUrl.hostname }
      }).filter(c => c.name && c.value)
      if (cookies.length > 0) await page.setCookie(...cookies)
    }

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise(r => setTimeout(r, 3000))
    return await page.content()
  } finally {
    await browser.close()
  }
}

app.get('/api/stats', async (req, res) => {
  const { url, cookie } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' })
  }
  if (!url.includes('cricclubs.com')) {
    return res.status(400).json({ error: 'URL must be a cricclubs.com link' })
  }

  try {
    console.log(`Fetching: ${url}`)
    let html

    // Try fast axios first — works when Cloudflare doesn't challenge
    try {
      html = await fetchWithAxios(url, cookie)
      console.log('[axios] success')
    } catch (axiosErr) {
      console.log(`[axios] failed (${axiosErr.message}), falling back to Puppeteer`)
      html = await fetchWithPuppeteer(url, cookie)
    }

    if (html.includes('cf_chl_opt') || html.includes('Just a moment')) {
      return res.status(403).json({
        error: 'Cloudflare challenge could not be solved. Paste your browser cookies (including cf_clearance) and try again.',
      })
    }

    const $ = cheerio.load(html)
    $('script, style, nav, footer, header').remove()

    const stats = extractStats($)
    console.log('Name:', stats.name, '| Batting rows:', stats.batting?.length, '| Bowling rows:', stats.bowling?.length)
    res.json({ stats, url })
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Failed to fetch page'
    if (message.includes('404')) message = 'Player page not found (404) — double-check the URL.'
    else if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) message = 'Could not reach cricclubs.com — check your internet connection.'
    else if (message.includes('timeout') || message.includes('Timeout')) message = 'Page took too long to load. Try again.'
    console.error('Error:', message)
    res.status(500).json({ error: message, debug: err instanceof Error ? err.stack : String(err) })
  }
})

app.get('/health', (_, res) => res.json({ ok: true }))

// Serve frontend static files if dist/ exists (production)
const distPath = join(__dirname, 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req, res) => res.sendFile(join(distPath, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`✅ CricClubs proxy server running at http://localhost:${PORT}`)
  console.log(`🔍 Puppeteer executable path: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'default'}`)
})

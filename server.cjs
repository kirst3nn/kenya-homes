const express = require('express')
const { DatabaseSync } = require('node:sqlite')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { promisify } = require('node:util')
const session = require('express-session')
const { rateLimit } = require('express-rate-limit')
const scrypt = promisify(crypto.scrypt)

const app = express()
const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a number from 1 to 65535.')
}

app.disable('x-powered-by')
app.use(express.json({ limit: '16kb' }))

// Starter data: inserted only when the properties table is empty.
const sampleProperties = [
  {
    id: 'garden-villa',
    title: 'Garden Villa',
    location: 'Karen, Nairobi',
    features: '4 bedrooms · 3 bathrooms',
    price: 'KSh 28,000,000',
    description: 'A fictional family home with a garden and spacious living areas.',
    note: 'Fictional property, not available for sale.',
    image: '/images/garden-villa.jpg',
    imageAlt: 'White building with a balcony, used as a demo illustration.',
    photographer: 'LARAM'
  },
  {
    id: 'city-apartment',
    title: 'City Apartment',
    location: 'Kilimani, Nairobi',
    features: '2 bedrooms · 2 bathrooms',
    price: 'KSh 65,000 per month',
    description: 'A fictional apartment with an open-plan living area and a balcony.',
    note: 'Fictional property, not available for rent.',
    image: '/images/city-apartment.jpg',
    imageAlt: 'Empty apartment kitchen and living space, used as a demo illustration.',
    photographer: 'Lisa Anna'
  }
]

// Keep the database beside this server, inside a data folder.
const dataFolder = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data')
fs.mkdirSync(dataFolder, { recursive: true })
const databasePath = path.join(dataFolder, 'kenya-homes.sqlite')
const database = new DatabaseSync(databasePath)


// Admin credentials and session secrets must remain inside the private data folder.
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && !process.env.APP_ORIGIN) {
  throw new Error('Set APP_ORIGIN to the HTTPS website origin before public hosting.')
}
const allowedOrigins = new Set(isProduction
  ? [process.env.APP_ORIGIN]
  : [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'http://localhost:5173', 'http://127.0.0.1:5173'])
if (isProduction && !process.env.APP_ORIGIN.startsWith('https://')) {
  throw new Error('Public admin login requires HTTPS.')
}
// Enable only for a hosting service with exactly one trusted reverse proxy.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)

const secretPath = path.join(dataFolder, 'session-secret.txt')
if (!fs.existsSync(secretPath)) {
  fs.writeFileSync(secretPath, crypto.randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 })
}
const sessionSecret = fs.readFileSync(secretPath, 'utf8').trim()
if (sessionSecret.length < 64) throw new Error('The private session secret is invalid.')

database.exec(`CREATE TABLE IF NOT EXISTS admin_sessions (
  sid TEXT PRIMARY KEY, contents TEXT NOT NULL, expires INTEGER NOT NULL
) STRICT`)
class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    try {
      const row = database.prepare('SELECT contents, expires FROM admin_sessions WHERE sid = ?').get(sid)
      if (!row || row.expires <= Date.now()) {
        if (row) database.prepare('DELETE FROM admin_sessions WHERE sid = ?').run(sid)
        return callback(null, null)
      }
      callback(null, JSON.parse(row.contents))
    } catch (error) { callback(error) }
  }
  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 3600000
      database.prepare('DELETE FROM admin_sessions WHERE expires <= ?').run(Date.now())
      database.prepare('INSERT OR REPLACE INTO admin_sessions (sid, contents, expires) VALUES (?, ?, ?)')
        .run(sid, JSON.stringify(value), expires)
      callback(null)
    } catch (error) { callback(error) }
  }
  destroy(sid, callback = () => {}) {
    try {
      database.prepare('DELETE FROM admin_sessions WHERE sid = ?').run(sid)
      callback(null)
    } catch (error) { callback(error) }
  }
}

app.use('/api/admin', (request, response, next) => {
  response.set('Cache-Control', 'no-store')
  response.set('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    // Custom headers require browser preflight across origins; we enable no CORS.
    if (request.get('X-Admin-Request') !== '1' ||
        (request.get('origin') && !allowedOrigins.has(request.get('origin')))) {
      return response.status(403).json({ message: 'Admin request not allowed.' })
    }
  }
  next()
})
app.use('/api/admin', session({
  name: 'kh.admin.sid',
  secret: sessionSecret,
  store: new SQLiteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', secure: isProduction, maxAge: 3600000, path: '/api/admin' }
}))

function requireAdmin(request, response, next) {
  if (!request.session?.admin) {
    return response.status(401).json({ message: 'Please log in as admin.' })
  }
  next()
}

app.get('/api/admin/session', (request, response) => {
  response.json({ authenticated: Boolean(request.session.admin), username: request.session.admin || null })
})
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' }
})
app.post('/api/admin/login', loginLimiter, async (request, response, next) => {
  try {
    if (!request.is('application/json')) return response.status(415).json({ message: 'Send JSON.' })
    const { username, password } = request.body || {}
    if (typeof username !== 'string' || typeof password !== 'string' ||
        username.length > 40 || password.length > 128 || !password.length) {
      return response.status(401).json({ message: 'Incorrect username or password.' })
    }
    const accountPath = path.join(dataFolder, 'admin.json')
    if (!fs.existsSync(accountPath)) {
      return response.status(503).json({ message: 'Admin account is not configured. Run setup-admin.cjs privately.' })
    }
    const account = JSON.parse(fs.readFileSync(accountPath, 'utf8'))
    if (account.algorithm !== 'scrypt' || !/^[a-f0-9]{128}$/.test(account.hash) ||
        !/^[a-f0-9]{64}$/.test(account.salt)) throw new Error('Invalid admin credential file.')
    const candidate = await scrypt(password, account.salt, 64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    const validPassword = crypto.timingSafeEqual(candidate, Buffer.from(account.hash, 'hex'))
    if (!validPassword || username.trim() !== account.username) {
      return response.status(401).json({ message: 'Incorrect username or password.' })
    }
    request.session.regenerate(error => {
      if (error) return next(error)
      request.session.admin = account.username
      request.session.save(saveError => {
        if (saveError) return next(saveError)
        response.json({ authenticated: true, username: account.username })
      })
    })
  } catch (error) { next(error) }
})
app.post('/api/admin/logout', (request, response, next) => {
  request.session.destroy(error => {
    if (error) return next(error)
    response.clearCookie('kh.admin.sid', { path: '/api/admin', httpOnly: true, sameSite: 'strict', secure: isProduction })
    response.json({ authenticated: false })
  })
})
// Every subsequent admin route requires server-side authorization.
app.use('/api/admin', requireAdmin)
app.get('/api/admin/check', (request, response) => {
  response.json({ message: 'Protected admin access confirmed.', username: request.session.admin })
})

// A table is like a spreadsheet: each property is one row.
database.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    features TEXT NOT NULL,
    price TEXT NOT NULL,
    description TEXT NOT NULL,
    note TEXT NOT NULL,
    image TEXT NOT NULL,
    imageAlt TEXT NOT NULL,
    photographer TEXT NOT NULL
  ) STRICT
`)

const count = database.prepare('SELECT COUNT(*) AS total FROM properties').get()
if (count.total === 0) {
  const insertProperty = database.prepare(`
    INSERT INTO properties (
      id, title, location, features, price, description,
      note, image, imageAlt, photographer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  database.exec('BEGIN')
  try {
    for (const property of sampleProperties) {
      insertProperty.run(
        property.id, property.title, property.location,
        property.features, property.price, property.description,
        property.note, property.image, property.imageAlt,
        property.photographer
      )
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

const selectProperties = database.prepare('SELECT * FROM properties ORDER BY rowid')

app.get('/api/health', (request, response) => {
  response.json({
    message: 'Kenya Homes backend is running',
    status: 'ok'
  })
})

app.get('/api/properties', (request, response) => {
  try {
    response.json(selectProperties.all())
  } catch (error) {
    console.error('Could not read properties:', error.message)
    response.status(500).json({ message: 'Could not load properties.' })
  }
})

// Enquiries are saved on the server. There is no email delivery or public list.
database.exec(`
  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
    email TEXT NOT NULL CHECK(length(email) BETWEEN 1 AND 254),
    message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT
`)
const insertEnquiry = database.prepare(
  'INSERT INTO enquiries (name, email, message) VALUES (?, ?, ?)'
)
const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many enquiry attempts. Try again in 10 minutes.' }
})
app.post('/api/enquiries', enquiryLimiter, (request, response) => {
  if (!request.is('application/json')) {
    return response.status(415).json({ message: 'Send enquiry data as JSON.' })
  }
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({ message: 'Provide a name, email and message.' })
  }
  const { name, email, message } = body
  if ([name, email, message].some(value => typeof value !== 'string')) {
    return response.status(400).json({ message: 'Name, email and message must be text.' })
  }
  const cleanName = name.trim()
  const cleanEmail = email.trim()
  const cleanMessage = message.trim()
  if (!cleanName || cleanName.length > 100) {
    return response.status(400).json({ message: 'Enter a name of 1 to 100 characters.' })
  }
  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return response.status(400).json({ message: 'Enter a valid email address.' })
  }
  if (!cleanMessage || cleanMessage.length > 2000) {
    return response.status(400).json({ message: 'Enter a message of 1 to 2000 characters.' })
  }
  try {
    const result = insertEnquiry.run(cleanName, cleanEmail, cleanMessage)
    return response.status(201).json({
      message: 'Demo enquiry saved locally. No email was sent.',
      id: Number(result.lastInsertRowid)
    })
  } catch (error) {
    console.error('Could not save enquiry:', error.message)
    return response.status(500).json({ message: 'Could not save the enquiry. Please try again.' })
  }
})

// Unknown API routes must never return the website HTML.
app.use('/api', (request, response) => {
  response.status(404).json({ message: 'API route not found.' })
})

// Vite builds the website into dist. Hash navigation needs no wildcard route.
const websiteFolder = path.join(__dirname, 'dist')
app.use(express.static(websiteFolder, { dotfiles: 'deny' }))
app.get('/', (request, response) => {
  response.status(503).type('text').send('Website build missing. Run npm run build, then refresh.')
})
app.use((request, response) => {
  response.status(404).json({ message: 'Page not found.' })
})

// Return readable errors without exposing internal details.
app.use((error, request, response, next) => {
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ message: 'The enquiry is too large.' })
  }
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ message: 'The enquiry contains invalid JSON.' })
  }
  console.error('Request failed:', error.message)
  return response.status(500).json({ message: 'Something went wrong. Please try again.' })
})

app.listen(PORT, HOST, () => {
  console.log(`Kenya Homes website and API: http://${HOST}:${PORT}`)
  console.log('SQLite database:', databasePath)
})

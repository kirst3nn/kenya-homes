const express = require('express')
const { DatabaseSync } = require('node:sqlite')
const path = require('node:path')
const fs = require('node:fs')

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

app.post('/api/enquiries', (request, response) => {
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

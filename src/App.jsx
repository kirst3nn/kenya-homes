import { useEffect, useState } from 'react'
import './App.css'

function PropertyPhoto({ property }) {
  return (
    <figure style={{ margin: '0 0 24px', minWidth: 0 }}>
      <img
        src={property.image}
        alt={property.imageAlt}
        width="1200"
        height="800"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          aspectRatio: '3 / 2',
          objectFit: 'cover',
          borderRadius: '12px'
        }}
      />
      <figcaption style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.5, color: '#505850' }}>
        Illustrative photo only, not this fictional property. Photo by {property.photographer} on Unsplash.
      </figcaption>
    </figure>
  )
}

function PropertyCard({ property }) {
  return (
    <article className="property-card">
      <PropertyPhoto property={property} />
      <h3>{property.title}</h3>
      <p>{property.location}</p>
      <p>{property.features}</p>
      <p><strong>{property.price}</strong></p>
      <p>
        <a href={`#/property/${property.id}`}>View details</a>
      </p>
      <p>{property.note}</p>
    </article>
  )
}

function PropertyList({ title, introduction, properties, loading, error, searchable = false }) {
  const [search, setSearch] = useState('')
  if (loading || error) {
    return <PropertyStatus loading={loading} error={error} />
  }

  const query = search.trim().toLowerCase()
  const visibleProperties = searchable
    ? properties.filter((property) =>
        `${property.title} ${property.location}`.toLowerCase().includes(query)
      )
    : properties

  return (
    <section className="featured">
      <h2>{title}</h2>
      <p>{introduction}</p>
      {searchable && (
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <label htmlFor="property-search" style={{ display: 'block', marginBottom: '8px' }}>
            Search by property name or location
          </label>
          <input
            id="property-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try Karen or City Apartment"
            style={{ width: '100%', padding: '12px', border: '1px solid #687568', borderRadius: '8px', font: 'inherit', background: 'white', color: '#202020' }}
          />
          <p role="status" aria-live="polite" style={{ marginBottom: 0 }}>
            {visibleProperties.length} {visibleProperties.length === 1 ? 'property' : 'properties'} found.
          </p>
        </div>
      )}
      {visibleProperties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
      {visibleProperties.length === 0 && (
        <p>{properties.length === 0
          ? 'No sample properties are available yet.'
          : 'No matching properties. Try another name or location, or clear the search.'}</p>
      )}
    </section>
  )
}

function ContactForm() {
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const name = String(fields.get('name') || '').trim()
    const email = String(fields.get('email') || '').trim()
    const message = String(fields.get('message') || '').trim()

    if (!name || !email || !message) {
      setResult({ error: 'Please enter a name, email and message, not just spaces.' })
      return
    }

    if (message.length < 10) {
      setResult({ error: 'Enter a sample message of at least 10 characters.' })
      return
    }

    setSaving(true)
    setResult(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
        signal: controller.signal
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.message || 'The backend could not save your enquiry.')
      }
      if (!Number.isSafeInteger(data?.id) || data.id < 1) {
        throw new Error('The backend did not confirm an enquiry ID.')
      }
      setResult({ id: data.id })
      form.reset()
    } catch (error) {
      setResult({ error: error.name === 'AbortError'
        ? 'The request timed out. It may have been saved. Do not submit repeatedly.'
        : `${error.message} Check that the backend is running. Your form details are still here.` })
    } finally {
      clearTimeout(timeout)
      setSaving(false)
    }
  }

  const fieldStyle = {
    display: 'block',
    width: '100%',
    marginTop: '8px',
    padding: '12px',
    border: '1px solid #687568',
    borderRadius: '8px',
    background: 'white',
    color: '#202020',
    font: 'inherit'
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        onChange={() => setResult(null)}
        aria-busy={saving}
        aria-describedby="contact-demo-note"
        style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}
      >
        <label htmlFor="contact-name">
          Name (required)
          <input id="contact-name" name="name" type="text" disabled={saving} required maxLength={100} style={fieldStyle} />
        </label>
        <label htmlFor="contact-email">
          Email (required)
          <input id="contact-email" name="email" type="email" disabled={saving} required maxLength={254} style={fieldStyle} />
        </label>
        <label htmlFor="contact-message">
          Message (required)
          <textarea id="contact-message" name="message" disabled={saving} required minLength={10} maxLength={2000} rows={5} style={{ ...fieldStyle, resize: 'vertical' }} />
        </label>
        <span style={{ fontSize: '14px' }}>Use a sample message of at least 10 characters. Do not enter sensitive information.</span>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '14px 22px', background: '#203c2c', color: 'white', border: 0, borderRadius: '8px', font: 'inherit', cursor: 'pointer', justifySelf: 'start' }}
        >
          {saving ? 'Saving...' : 'Save demo enquiry'}
        </button>
      </form>
      <div role="status" aria-live="polite" style={{ marginTop: '24px', overflowWrap: 'anywhere' }}>
        {result?.error && <p role="alert">{result.error}</p>}
        {result?.id && (
          <div style={{ padding: '20px', background: 'white', borderRadius: '12px' }}>
            <h2>Demo enquiry saved locally.</h2>
            <p>Enquiry ID: {result.id}</p>
            <p>No email was sent. This is a learning demo, not a real property enquiry.</p>
          </div>
        )}
      </div>
    </>
  )
}

function PropertyStatus({ loading, error }) {
  return (
    <section className="hero" aria-live="polite">
      {loading ? (
        <p role="status">Loading properties from the backend...</p>
      ) : (
        <>
          <h2>Could not load properties</h2>
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '14px 22px', background: '#203c2c', color: 'white', border: 0, borderRadius: '8px', font: 'inherit', cursor: 'pointer' }}
          >
            Try again
          </button>
        </>
      )}
    </section>
  )
}

function readPage() {
  return window.location.hash.slice(1) || '/'
}

export default function App() {
  const [page, setPage] = useState(readPage)
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 10000)

    async function loadProperties() {
      try {
        const response = await fetch('/api/properties', {
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error('The backend could not return properties.')
        }
        const data = await response.json()
        const requiredFields = [
          'id', 'title', 'location', 'features', 'price',
          'description', 'note', 'image', 'imageAlt', 'photographer'
        ]
        if (!Array.isArray(data) || data.some((property) =>
          !property || requiredFields.some((field) => typeof property[field] !== 'string')
        ) || new Set(data.map((property) => property.id)).size !== data.length) {
          throw new Error('The backend returned unexpected property data.')
        }
        if (active) setProperties(data)
      } catch {
        if (active) {
          setError('Check that the backend is running on port 3001, then try again.')
        }
      } finally {
        clearTimeout(timeout)
        if (active) setLoading(false)
      }
    }

    loadProperties()
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    function updatePage() {
      setPage(readPage())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', updatePage)
    return () => {
      window.removeEventListener('hashchange', updatePage)
    }
  }, [])

  const selectedProperty = properties.find(
    (property) => page === `/property/${property.id}`
  )
  const isPublicPage = ['/', '/properties', '/about', '/contact'].includes(page)
  const isPropertyPage = page.startsWith('/property/')

  return (
    <>
      <header>
        <h2>Kenya Homes</h2>
        <nav>
          <a href="#/">Home</a>
          <a href="#/properties">Properties</a>
          <a href="#/about">About Us</a>
          <a href="#/contact">Contact</a>
        </nav>
      </header>
      <main>
        {page === '/' && (
          <>
            <section className="hero">
              <h1>Find your next home in Kenya.</h1>
              <p>Explore homes to rent or buy, in a place that suits you.</p>
              <a href="#/properties">Browse properties</a>
            </section>
            <PropertyList
              properties={properties}
              loading={loading}
              error={error}
              title="Featured homes"
              introduction="Sample listings for our learning project."
            />
          </>
        )}
        {page === '/properties' && (
          <>
            <section className="hero">
              <h1>Properties</h1>
              <p>Browse our fictional homes for rent and sale.</p>
            </section>
            <PropertyList
              properties={properties}
              loading={loading}
              error={error}
              title="All sample properties"
              introduction="These listings are for learning only."
              searchable
            />
          </>
        )}
        {isPropertyPage && (loading || error) && (
          <PropertyStatus loading={loading} error={error} />
        )}
        {selectedProperty && (
          <section className="hero">
            <h1>{selectedProperty.title}</h1>
            <PropertyPhoto property={selectedProperty} />
            <p>{selectedProperty.location}</p>
            <p>{selectedProperty.features}</p>
            <p><strong>{selectedProperty.price}</strong></p>
            <p>{selectedProperty.description}</p>
            <p>{selectedProperty.note}</p>
            <a href="#/properties">Back to properties</a>
          </section>
        )}
        {page === '/about' && (
          <section className="hero">
            <h1>About Us</h1>
            <p>Kenya Homes is our real-estate learning project.</p>
            <p>We are building it one step at a time using React and CSS.</p>
          </section>
        )}
        {page === '/contact' && (
          <section className="hero">
            <h1>Contact</h1>
            <p id="contact-demo-note">Learning demo only. Enquiries are saved in the local database, not emailed to an agent. Use fictional details, not personal or sensitive information.</p>
            <ContactForm />
          </section>
        )}
        {!isPublicPage && !selectedProperty && !(isPropertyPage && (loading || error)) && (
          <section className="hero">
            <h1>Page not found</h1>
            <p>That page does not exist.</p>
            <a href="#/">Back to Home</a>
          </section>
        )}
      </main>
    </>
  )
}


import { useEffect, useState } from 'react'
import './App.css'

function PropertyPhoto({ property, priority = false }) {
  return (
    <figure style={{ margin: '0 0 24px', minWidth: 0 }}>
      <img
        src={property.image}
        alt={property.imageAlt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
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

function PropertyCard({ property, priority = false }) {
  return (
    <article className="property-card">
      <PropertyPhoto property={property} priority={priority} />
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
      {visibleProperties.map((property, index) => (
        <PropertyCard key={property.id} property={property} priority={index === 0} />
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


function AdminPanel() {
  const [account, setAccount] = useState(null)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    fetch('/api/admin/session', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not check your login session.')
        const data = await response.json()
        setAccount(data.authenticated ? data.username : null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not check your session. Check the backend, then refresh.')
      })
      .finally(() => {
        clearTimeout(timer)
        setChecking(false)
      })
    return () => { clearTimeout(timer); controller.abort() }
  }, [])

  async function adminRequest(endpoint, body) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || 'The admin request failed.')
      return data
    } catch (failure) {
      if (failure.name === 'AbortError') throw new Error('Request timed out. Refresh to check your session before trying again.')
      throw failure
    } finally { clearTimeout(timer) }
  }

  async function logIn(event) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const credentials = { username: String(fields.get('username') || '').trim(), password: String(fields.get('password') || '') }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await adminRequest('login', credentials)
      if (!data.authenticated || typeof data.username !== 'string') throw new Error('Login was not confirmed.')
      form.reset()
      setAccount(data.username)
      setNotice('You are logged in. Property management and enquiry viewing are the next steps.')
    } catch (failure) {
      setError(failure.message)
      form.elements.namedItem('password').value = ''
    } finally { setBusy(false) }
  }

  async function logOut() {
    setBusy(true)
    setError('')
    try {
      await adminRequest('logout', {})
      setAccount(null)
      setNotice('You are logged out.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  const fieldStyle = { display: 'block', width: '100%', marginTop: 8, padding: 12, border: '1px solid #687568', borderRadius: 8, background: 'white', color: '#202020', font: 'inherit' }
  const buttonStyle = { padding: '14px 22px', background: '#203c2c', color: 'white', border: 0, borderRadius: 8, font: 'inherit', cursor: 'pointer', justifySelf: 'start' }
  return (
    <section className="hero">
      <h1>{account ? 'Admin dashboard' : 'Admin login'}</h1>
      {checking ? <p role="status">Checking your session...</p> : account ? (
        <>
          <p>Signed in as {account}.</p>
          <p>This first step connects login and logout only. Property editing and enquiry viewing are not available yet.</p>
          <button type="button" disabled={busy} onClick={logOut} style={buttonStyle}>{busy ? 'Logging out...' : 'Log out'}</button>
        </>
      ) : (
        <>
          <p>Use the account you created locally. There is no public admin registration.</p>
          <form onSubmit={logIn} aria-busy={busy} style={{ display: 'grid', gap: 20, maxWidth: 500 }}>
            <label htmlFor="admin-username">Username
              <input id="admin-username" name="username" required maxLength={40} autoComplete="username" disabled={busy} style={fieldStyle} />
            </label>
            <label htmlFor="admin-password">Password
              <input id="admin-password" name="password" type="password" required maxLength={128} autoComplete="current-password" disabled={busy} style={fieldStyle} />
            </label>
            <button type="submit" disabled={busy} style={buttonStyle}>{busy ? 'Logging in...' : 'Log in'}</button>
          </form>
        </>
      )}
      {error && <p role="alert" style={{ marginTop: 20 }}>{error}</p>}
      {notice && <p role="status" style={{ marginTop: 20 }}>{notice}</p>}
    </section>
  )
}

function LegalPage({ terms = false }) {
  return (
    <section className="hero" aria-labelledby="legal-title">
      <h1 id="legal-title">{terms ? 'Terms and conditions' : 'Privacy policy'}</h1>
      <p><strong>Learning demo notice. Not a live property service.</strong> These notices describe this local version and must be reviewed before public launch.</p>
      {terms ? (
        <>
          <h2>Demo use only</h2>
          <p>Kenya Homes is an educational software project. All listings, locations, prices and descriptions are fictional examples, not offers to sell or rent. Photos are illustrative and do not show the fictional properties.</p>
          <h2>No transactions or agency service</h2>
          <p>This website does not accept payments, reserve property, verify listings or arrange viewings. Saving a demo enquiry does not contact an agent, send an email or create an agreement.</p>
          <h2>Responsible use</h2>
          <p>Use fictional details when testing forms. Do not submit sensitive information, spam the service, attempt unauthorized admin access or use it to mislead others.</p>
          <h2>Photos and credits</h2>
          <p>Illustrative photos are credited beside the images. Their inclusion does not imply endorsement by a photographer or property owner.</p>
          <h2>Availability and changes</h2>
          <p>This project is under development. Features may change and local demo records may be reset. Do not rely on it for housing, financial or legal decisions. These terms do not limit rights that cannot lawfully be excluded.</p>
          <h2>Before public launch</h2>
          <p>The operator must identify themselves, provide a working contact method and review these terms for the actual service. This draft is not a statement of legal compliance.</p>
        </>
      ) : (
        <>
          <h2>Demo enquiries</h2>
          <p>The contact form sends the name, email address and message you enter to this project's backend. They are saved in its local SQLite database for testing. No enquiry email is sent. Use fictional information only.</p>
          <h2>Admin account and cookies</h2>
          <p>The admin account is created privately. The backend stores a salted password hash, not the original password. Login sends credentials to the backend for verification. Never share admin credentials in a demo enquiry.</p>
          <p>Successful admin login uses an essential session cookie called kh.admin.sid to maintain access. The session cookie has a one-hour lifetime and is cleared by logout; the server invalidates the session on logout. Disabling cookies prevents admin login from working.</p>
          <h2>Analytics and other storage</h2>
          <p>This version has no analytics integration or optional tracking cookies. No optional analytics consent is collected yet. This policy and cookie controls must be updated before any optional tracking is enabled.</p>
          <h2>Photos and technical requests</h2>
          <p>Demo photos are served with this project. Browsers send technical information with requests, including an IP address. A future hosting provider may process request logs; its actual practices must be disclosed before publication.</p>
          <h2>Retention and deletion</h2>
          <p>Demo enquiries remain in the local database until the project operator removes them or resets the database. There is not yet an automatic enquiry deletion schedule or a public deletion-request channel. Local backups may also contain demo records.</p>
          <h2>Before public launch</h2>
          <p>The operator must publish their identity and contact method, define a retention period, identify hosting and analytics providers, and explain how people can make privacy requests. This local-demo notice does not establish readiness to collect real personal information.</p>
        </>
      )}
      <a href="#/">Back to Home</a>
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
  const isPublicPage = ['/', '/properties', '/about', '/contact', '/admin', '/privacy', '/terms'].includes(page)
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
          <a href="#/admin">Admin</a>
        </nav>
      </header>
      <main>
        {page === '/privacy' && <LegalPage />}
        {page === '/terms' && <LegalPage terms />}
        {page === '/admin' && <AdminPanel />}
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
            <PropertyPhoto property={selectedProperty} priority />
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
      <footer style={{ maxWidth: 1000, margin: '0 auto', padding: '24px', borderTop: '1px solid #dddddd', lineHeight: 1.6 }}>
        <p>Kenya Homes learning demo. Fictional listings, illustrative photos, no real transactions.</p>
        <nav aria-label="Legal information">
          <a href="#/privacy">Privacy policy</a>
          <a href="#/terms">Terms and conditions</a>
        </nav>
      </footer>
    </>
  )
}

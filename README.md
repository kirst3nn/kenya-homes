> Kenya Homes
> A fictional Kenyan real-estate learning project built with React, Vite, Express and SQLite.
> 
> FEATURES
> • Home, Properties, property details, About and Contact pages.
> • Search by property name or location.
> • Properties loaded from an Express API and stored in SQLite.
> • Contact enquiries saved locally, with validation and error handling.
> • Responsive layout with illustrative photos.
> 
> REQUIREMENTS
> Node.js 24 and npm. SQLite is built into Node, so no separate database installation is required.
> 
> RUN LOCALLY
> Open the project folder containing package.json and server.cjs.
> Install dependencies: npm install
> Start the backend in one terminal: node server.cjs
> Start the frontend in another terminal: npm run dev
> Keep both running. Open the address printed by Vite, normally http://localhost:5173.
> The backend runs on http://127.0.0.1:3001. Vite forwards /api requests to it during development.
> 
> DATABASE
> The backend creates data/kenya-homes.sqlite automatically. It adds two sample properties when the properties table is empty. Saved enquiries remain after restarting.
> GET /api/health checks the backend.
> GET /api/properties returns fictional properties.
> POST /api/enquiries saves an enquiry locally.
> No email is sent. There is no public enquiry-list endpoint. Use fictional details only.
> Keep data/, .env files and node_modules out of Git. Do not share the local database.
> 
> CHECKS
> Build: npm run build
> Code checks: npm run lint
> Tested locally: property display, search, details, saving enquiries, required fields, invalid email, backend-off errors, retry, database persistence and narrow layout.
> 
> LIMITATIONS
> This is a local learning demo, not a production service. Listings are fictional and unavailable. There are no accounts, payments, agent messaging or admin dashboard.
> Public deployment still needs production API routing, security controls and persistent database storage. The frontend build alone does not run the backend.
> 
> PHOTO CREDITS
> Garden Villa: LARAM on Unsplash.
> City Apartment: Lisa Anna on Unsplash.
> Photos are illustrative, not photographs of the fictional listings.
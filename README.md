# Khareef Adventure Booking

A bilingual Arabic/English adventure vehicle rental and booking platform for Khareef season in Salalah / Dhofar.

The application includes a premium tourism landing page, booking workflow, QR booking section, multilingual RTL/LTR UI, FastAPI backend, SQLite database, seed vehicles/routes, and an admin dashboard.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, i18next
- Backend: FastAPI, SQLAlchemy, Pydantic, Alembic, SQLite
- Admin auth: JWT

## Project Structure

```text
frontend/
  src/
    api/
    components/
    i18n/locales/en.json
    i18n/locales/ar.json
    pages/
backend/
  app/
    main.py
    models.py
    schemas.py
    auth.py
    database.py
    seed.py
  alembic/
```

## Run Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will run at `http://127.0.0.1:8000`.

Default admin login:

```text
Username: admin
Password: admin123
```

## Run Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

## Main Pages

- `/` Home page with hero, quick booking, summary, how-to-book, popular routes, why-us, and QR booking.
- `/booking` Complete guest booking form with payment choice and confirmation.
- `/experiences` Route cards and adventure experiences.
- `/faq` Frequently asked questions.
- `/contact` Contact form and business details.
- `/admin` Admin dashboard for bookings, vehicles, routes, status updates, and revenue stats.

## API Endpoints

Public:

- `GET /api/vehicles`
- `GET /api/routes`
- `POST /api/bookings`
- `GET /api/availability`
- `POST /api/payments/create`

Admin:

- `POST /api/admin/login`
- `GET /api/admin/bookings`
- `PATCH /api/admin/bookings/{id}/status`
- `POST /api/admin/vehicles`
- `PUT /api/admin/vehicles/{id}`
- `DELETE /api/admin/vehicles/{id}`
- `POST /api/admin/routes`
- `PUT /api/admin/routes/{id}`
- `DELETE /api/admin/routes/{id}`
- `GET /api/admin/dashboard-stats`

## Notes

- Arabic uses RTL direction automatically when selected from the navbar.
- English uses LTR direction.
- Seed data is inserted on backend startup when the database is empty.
- Payment creation is a demo endpoint and should be replaced with a real payment gateway before production.
- Change `SECRET_KEY` in `backend/app/auth.py` before deployment.
"# buggydhofar" 

# Internship Manager

Simple full-stack app to:
- upload a master student sheet once
- upload a placed students sheet once
- upload applicant sheets whenever needed
- automatically remove already placed students using BT-ID matching
- manage the placed list manually from the admin panel

## Stack

- Frontend: React + Vite + Tailwind
- Backend: FastAPI
- Database: PostgreSQL
- File parsing: pandas
- Auth: JWT + bcrypt
- Email: Gmail SMTP

## Flow

1. Upload the master students file from the Dashboard or Truly Unplaced page.
2. Upload the initial placed students file from the Dashboard or Placed Students page.
3. Use the Placed Students page to add, remove, or bulk paste placed entries.
4. Upload any applicant file on the Applicants page.
5. The app normalizes BT-IDs, removes duplicates, removes already placed students, and shows only eligible applicants.

## Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Create the PostgreSQL database named `internship_manager` first, or update `DATABASE_URL` to point to an existing database.

API docs: `http://localhost:8000/docs`

## Frontend setup

```bash
cd frontend
npm install
echo VITE_API_URL=http://localhost:8000 > .env.local
npm run dev
```

Frontend: `http://localhost:5173`

## Environment variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_manager
DB_POOL_MIN_SIZE=1
DB_POOL_MAX_SIZE=10
DB_POOL_TIMEOUT=15

ADMIN_PASSWORD=change-me
# Prefer this in production instead of ADMIN_PASSWORD
# ADMIN_PASSWORD_HASH=<bcrypt hash>

JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480

EMAIL_USER=your@gmail.com
EMAIL_PASS=your_gmail_app_password
NOTIFICATION_EMAIL=xyz@gmail.com

FRONTEND_URL=http://localhost:5173
```

## Main API routes

- `POST /auth/login`
- `GET /auth/verify`
- `POST /students/master/upload`
- `GET /students/master`
- `GET /students/unplaced`
- `GET /students/status`
- `POST /placed/upload`
- `GET /placed/`
- `POST /placed/add`
- `DELETE /placed/{bt_id}`
- `POST /placed/bulk-paste`
- `POST /applicants/upload`
- `GET /applicants/filter`
- `GET /applicants/download`

## Expected file columns

Master students:
- `BT-ID`
- `Name`
- `Department`
- `CGPA` optional

Placed students:
- `BT-ID`
- `Name`
- `Department` optional
- `Company` optional
- `Stipend` optional

Applicants:
- `Email`
- `BT-ID`
- `Department`
- `Name`
- `10th %`
- `12th %`
- `CGPA`
- `Active Backlogs`
- `Resume Link`

Column names are flexible. Common variants like `btid`, `dept`, `student name`, `backlogs`, and `resume` are auto-mapped.

## Notes

- Master, placed, and latest applicant uploads are stored in PostgreSQL.
- Applicant uploads replace the previous applicant upload, which keeps filtering simple.
- Placed and master imports replace the previous stored dataset.
- BT-ID values are trimmed and uppercased before matching.
- Duplicate BT-IDs in uploaded files are removed automatically.

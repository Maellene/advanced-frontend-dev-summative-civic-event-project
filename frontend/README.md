# CivicEvents+ Frontend

Frontend for the CivicEvents+ project, built with HTML, Tailwind CSS (CDN) and jQuery only. It uses the provided backend API.

## Backend setup

1. Install Node.js (v18+) and PostgreSQL (v15+).
2. Create the database `civic-events-db` (pgAdmin or `psql`).
3. Run `backend/migrations/001_create_tables.sql` on that database to create the tables.
4. In `backend/.env`, set your database credentials (user, password, host, port, database name).
5. In the `backend` folder run:

   ```
   npm install
   npm run dev
   ```

   The API runs at `http://localhost:4000` and prints a success message once it is connected to the database.

## Run the frontend

The frontend needs no build step and has no environment variables.

1. Open the `frontend` folder in VS Code.
2. Right-click `index.html` and choose **Open with Live Server** (or serve the folder with any static server).
3. Open the address it shows, for example `http://127.0.0.1:5500`.

## Connect to the backend

The backend address is set at the top of `main.js`:

```js
const BASE_URL = "http://localhost:4000";
const API_URL = BASE_URL + "/api";
```

API base URL: **`http://localhost:4000/api`**. If your backend runs on another address or port, change `BASE_URL` only.

Every request to a protected endpoint sends `Authorization: Bearer <token>`.

## Accounts

- Sign up on the signup page to create a normal user.
- Signup always creates a normal user. To make an admin, run this on the database, then log in again:

  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
  ```

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout, navbar, footer and every screen |
| `style.css` | Small custom styles |
| `main.js` | Settings, login and signup, session storage, API helper, routing and role guards |
| `events.js` | Events list, detail and admin form |
| `registrations.js` | Event registration, feedback and My registrations |
| `announcements.js` | Audio announcements |
| `promos.js` | Video promos with captions |
| `notifications.js` | Bell, notification panel and inbox |
| `users.js` | Profile, admin dashboard and user management |

## Role-based access guards

Guards only improve the user experience. The backend does the real security.

- `main.js`, `route()`: Guard 1 sends logged-out users to login. Guard 2 sends normal users away from admin screens.
- `main.js`, `applyRoleVisibility()` and `showAdminSidebar()`: Guard 3 hides admin-only buttons and builds the admin menu only for admins.
- `ADMIN_PAGES` lists the admin-only screens. Each feature file adds its own (`events.js`, `announcements.js`, `promos.js`, `users.js`).
- `registrations.js`, `loadEventExtras()`: admins see registrants and all feedback, normal users see the register button and their own feedback.

## Token storage

If "Remember me" is ticked the token is kept in `localStorage`, otherwise in `sessionStorage`. `localStorage` can be read by any script on the page (XSS risk), which is why it is only used when the user chooses it.

## Known backend limits

- An event that has registrations cannot be deleted (database foreign key).
- The backend does not block disabled users at login, so the frontend checks the account after login and signs disabled users out.
- Announcements have no duration or transcript field. The length is read from the audio file.
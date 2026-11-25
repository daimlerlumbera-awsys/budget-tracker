# Budget Tracker

A personal budget tracking web app for planning budgets, recording income and expenses, and reviewing spending history. Built with Vue 3 and Supabase.

## Features

- **Authentication**: register and sign in with Supabase Auth. Protected routes send signed-out users to the login page.
- **Overview**: dashboard with budget usage, planned vs. actual spending, and recent transactions.
- **Budgets**: create, edit, and delete budget items per category.
- **Transactions**: record and manage income and expense transactions.
- **History**: browse past transactions and budget activity.
- **BDO Life**: submit monthly deposits with proof-of-payment uploads (one deposit per month). Proofs open in an in-app preview that shows both images and PDFs. Admins can review and acknowledge submissions.
- **Settings**: general preferences (currency, date format, theme), salary cutoff periods, budget categories, and data management.
- **Light and dark mode**: switch themes from the header, or follow the system setting. The last theme you used is applied before the app loads, so the page doesn't flash in the wrong theme.
- **Default data seeding**: new users get default settings (PHP currency, `MM/DD/YYYY`, system theme) and a starter set of income and expense categories.

### Admin features

Admin accounts get their own section and are redirected away from the personal finance pages. Regular users can't open the admin pages.

- **Admin Dashboard** (`/admin`): monthly total income and expenses across all users, a per-user summary, and BDO Life submissions waiting to be acknowledged.
- **User Finances** (`/admin/users`): read-only view of any user's income and expense transactions.

User display names come from [frontend/src/data/users.ts](frontend/src/data/users.ts).

## Tech Stack

**Frontend** (`frontend/`)
- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/)
- [Vue Router](https://router.vuejs.org/) and [Pinia](https://pinia.vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/) (auth, database, storage)
- [Lucide](https://lucide.dev/) icons
- ESLint, Oxlint, Prettier

**Backend** (`backend/`, in progress)
- Node.js, Express, express-validator, MySQL (`mysql2`), dotenv, CORS

## Project Structure

```
budget-tracker/
├── backend/
│   └── src/app.js          # Express server (not yet implemented)
└── frontend/
    └── src/
        ├── assets/          # Global styles and theme tokens
        ├── components/      # Shared UI components
        ├── composables/     # useTheme (light/dark mode)
        ├── data/            # User display names
        ├── layouts/         # App layout, header, sidebar
        ├── lib/supabase.ts  # Supabase client
        ├── router/          # Routes, auth guard, admin/user route guards
        ├── services/        # User data seeding
        ├── stores/          # Pinia stores
        └── views/           # Pages
```

## Getting Started

### Prerequisites

- Node.js `^22.18.0` or `>=24.12.0`
- A Supabase project with:
  - Tables: `settings`, `categories`, `budget_items`, `transactions`, `bdo_life_submissions`
  - Storage bucket: `bdo-life-proofs`
  - RPC functions: `is_bdo_life_admin` (admin check) and `admin_list_users` (user list for admin pages)

### Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Run the dev server:

```bash
npm run dev
```

### Frontend scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start the Vite dev server            |
| `npm run build`      | Type-check and build for production  |
| `npm run preview`    | Preview the production build         |
| `npm run type-check` | Run `vue-tsc` type checking          |
| `npm run lint`       | Run Oxlint and ESLint with auto-fix  |
| `npm run format`     | Format `src/` with Prettier          |

### Backend setup

```bash
cd backend
npm install
```

The backend is a work in progress; `backend/src/app.js` is currently empty.

## AI Tools Used

- IBM Bob
- GitHub Copilot
- OpenAI
- Claude Code

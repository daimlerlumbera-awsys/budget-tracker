# Budget Tracker

A personal budget tracking web app for planning budgets, recording income and expenses, and reviewing spending history. Built with Vue 3 and Supabase.

## Features

- **Authentication**: register and sign in with Supabase Auth. Protected routes send signed-out users to the login page.
- **Overview**: dashboard with budget usage, planned vs. actual spending, and recent transactions.
- **Budgets**: create, edit, and delete budget items per category.
- **Transactions**: record and manage income and expense transactions.
- **History**: browse past transactions and budget activity.
- **BDO Life**: submit monthly deposits with proof-of-payment uploads. Admins can review and acknowledge submissions.
- **Settings**: general preferences (currency, date format, theme), salary cutoff periods, budget categories, and data management.
- **Default data seeding**: new users get default settings (PHP currency, `MM/DD/YYYY`, system theme) and a starter set of income and expense categories.

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
        ├── assets/          # Global styles
        ├── components/      # Shared UI components
        ├── layouts/         # App layout, header, sidebar
        ├── lib/supabase.ts  # Supabase client
        ├── router/          # Routes and auth guard
        ├── services/        # User data seeding
        ├── stores/          # Pinia stores
        └── views/           # Pages
```

## Getting Started

### Prerequisites

- Node.js `^22.18.0` or `>=24.12.0`
- A Supabase project with these tables: `settings`, `categories`, `budget_items`, `transactions`, `bdo_life_submissions`, and a `bdo-life-proofs` storage bucket

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

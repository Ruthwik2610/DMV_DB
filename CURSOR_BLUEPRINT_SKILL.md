# Data Platform Blueprint Skill — Cursor Prompt

> Copy-paste this entire file as a prompt into Cursor Agent mode.
> It is a single-pass, Karpathy-style blueprint that connects BigQuery, Salesforce, and Vercel — with a shadcn/ui + Tremor dashboard — in one methodical execution.

---

## System Instructions

You are building a unified data platform dashboard. Follow these guidelines strictly:

**Tradeoff:** These guidelines bias toward caution over speed. For trivial sub-tasks, use judgment.

### Principle 1 — Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly before writing any code.
- If a connection string, API key, or credential is needed, create a `.env.example` entry — never hardcode secrets.
- If multiple approaches exist (REST vs SDK, server-side vs client-side), present them in a comment — don't pick silently.
- If something is unclear about the user's BigQuery schema or Salesforce objects, add a `// TODO: confirm with user` comment.

### Principle 2 — Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No wrapper abstractions for single-use database calls.
- No feature flags, no "plugin architecture", no premature DRY.
- If a BigQuery query is 3 lines of SQL, don't build a query builder.
- If Salesforce needs one SOQL query, don't build an ORM layer.
- Every file you create must be directly traceable to a requirement below.

### Principle 3 — Surgical Changes
**Touch only what you must. Integrate with what exists.**

- Read the existing codebase first. This is a Vite + React 19 + Express project.
- Do NOT replace existing routing, auth, or Express server — extend them.
- Match existing code style (functional components, no TypeScript unless already used, JSX).
- If the project uses `react-router-dom` v7, use its conventions.

### Principle 4 — Goal-Driven Execution
**Define success criteria. Verify each step before moving on.**

```
1. Install dependencies        → verify: `npm ls` shows no missing peer deps
2. Create env config           → verify: `.env.example` has all required keys
3. Build backend connectors    → verify: each connector can be tested standalone
4. Build API routes            → verify: `curl` each endpoint returns expected shape
5. Build frontend components   → verify: components render with mock data
6. Wire frontend to backend    → verify: real data flows end-to-end
7. Error handling at boundaries → verify: bad credentials show user-friendly errors
```

---

## REQUIREMENTS — Execute All in One Pass

### A. Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Vite + React 19 (existing) | Already in project |
| **Backend** | Express 5 (existing `server.js`) | Already in project |
| **Core UI** | shadcn/ui (Radix + Tailwind) | Best accessibility, DX, zero lock-in |
| **Data Viz** | Tremor | Purpose-built for dashboards, Tailwind-native |
| **Tables** | TanStack Table v8 | Sorting, filtering, pagination for query results |
| **Forms** | React Hook Form + Zod (already in project) | Connector config forms |
| **Icons** | Lucide React (already in project) | Consistent icon set |
| **Charts** | Recharts (via Tremor) | BigQuery result visualization |

### B. Dependencies to Install

```bash
# UI Foundation
npx shadcn@latest init
npx shadcn@latest add button card dialog input label select table tabs toast sheet command dropdown-menu badge separator scroll-area

# Data Viz & Tables
npm install @tremor/react @tanstack/react-table

# Backend Connectors
npm install @google-cloud/bigquery jsforce

# Form handling (Zod already installed)
npm install react-hook-form @hookform/resolvers

# Tailwind (required by shadcn/ui, if not already present)
npm install -D tailwindcss @tailwindcss/vite autoprefixer
```

### C. Environment Configuration

Create `.env.example` with ALL required keys:

```env
# ── BigQuery ──
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
# OR use individual keys:
# BIGQUERY_CLIENT_EMAIL=
# BIGQUERY_PRIVATE_KEY=

# ── Salesforce ──
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_USERNAME=
SALESFORCE_PASSWORD=
SALESFORCE_SECURITY_TOKEN=
# OR OAuth:
# SALESFORCE_CLIENT_ID=
# SALESFORCE_CLIENT_SECRET=
# SALESFORCE_REDIRECT_URI=

# ── Vercel ──
VERCEL_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID=

# ── App ──
PORT=3001
VITE_API_URL=http://localhost:3001
```

### D. Backend Architecture — Three Connectors, One Pattern

Create these files in `server/connectors/`. Each connector follows the SAME interface:

```
server/
├── connectors/
│   ├── bigquery.js      — connect(), query(sql), listDatasets(), listTables(dataset)
│   ├── salesforce.js    — connect(), query(soql), listObjects(), describeObject(name)
│   └── vercel.js        — connect(), listProjects(), listDeployments(projectId), getProject(id)
├── routes/
│   ├── bigquery.js      — Express router: POST /api/bigquery/query, GET /api/bigquery/datasets, etc.
│   ├── salesforce.js    — Express router: POST /api/salesforce/query, GET /api/salesforce/objects, etc.
│   └── vercel.js        — Express router: GET /api/vercel/projects, GET /api/vercel/deployments/:id, etc.
└── middleware/
    └── errorHandler.js  — Catches connector errors, returns { error: string, code: number }
```

#### D1. BigQuery Connector (`server/connectors/bigquery.js`)

```javascript
import { BigQuery } from '@google-cloud/bigquery';

let client = null;

export async function connect() {
  if (client) return client;
  client = new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
  // Verify connection
  await client.query({ query: 'SELECT 1' });
  return client;
}

export async function query(sql, params = []) {
  const bq = await connect();
  const [rows] = await bq.query({ query: sql, params });
  return rows;
}

export async function listDatasets() {
  const bq = await connect();
  const [datasets] = await bq.getDatasets();
  return datasets.map(d => ({ id: d.id, location: d.metadata.location }));
}

export async function listTables(datasetId) {
  const bq = await connect();
  const dataset = bq.dataset(datasetId);
  const [tables] = await dataset.getTables();
  return tables.map(t => ({ id: t.id, type: t.metadata.type }));
}
```

#### D2. Salesforce Connector (`server/connectors/salesforce.js`)

```javascript
import jsforce from 'jsforce';

let conn = null;

export async function connect() {
  if (conn && conn.accessToken) return conn;
  conn = new jsforce.Connection({
    loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
  });
  await conn.login(
    process.env.SALESFORCE_USERNAME,
    process.env.SALESFORCE_PASSWORD + (process.env.SALESFORCE_SECURITY_TOKEN || '')
  );
  return conn;
}

export async function query(soql) {
  const sf = await connect();
  const result = await sf.query(soql);
  return { totalSize: result.totalSize, records: result.records };
}

export async function listObjects() {
  const sf = await connect();
  const result = await sf.describeGlobal();
  return result.sobjects
    .filter(o => o.queryable)
    .map(o => ({ name: o.name, label: o.label, custom: o.custom }));
}

export async function describeObject(objectName) {
  const sf = await connect();
  const meta = await sf.describe(objectName);
  return {
    name: meta.name,
    label: meta.label,
    fields: meta.fields.map(f => ({
      name: f.name, label: f.label, type: f.type, length: f.length,
    })),
  };
}
```

#### D3. Vercel Connector (`server/connectors/vercel.js`)

```javascript
const BASE = 'https://api.vercel.com';

async function vercelFetch(path) {
  const url = new URL(path, BASE);
  if (process.env.VERCEL_TEAM_ID) {
    url.searchParams.set('teamId', process.env.VERCEL_TEAM_ID);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function connect() {
  // Verify token works
  await vercelFetch('/v2/user');
  return true;
}

export async function listProjects() {
  const data = await vercelFetch('/v9/projects');
  return data.projects.map(p => ({
    id: p.id, name: p.name, framework: p.framework,
    updatedAt: p.updatedAt,
  }));
}

export async function listDeployments(projectId) {
  const data = await vercelFetch(`/v6/deployments?projectId=${projectId}&limit=20`);
  return data.deployments.map(d => ({
    id: d.uid, url: d.url, state: d.state,
    createdAt: d.createdAt, meta: d.meta,
  }));
}

export async function getProject(projectId) {
  return vercelFetch(`/v9/projects/${projectId}`);
}
```

#### D4. Express Routes

Each route file follows this exact pattern:

```javascript
// server/routes/bigquery.js
import { Router } from 'express';
import * as bq from '../connectors/bigquery.js';

const router = Router();

router.get('/datasets', async (req, res, next) => {
  try {
    res.json(await bq.listDatasets());
  } catch (err) { next(err); }
});

router.get('/datasets/:id/tables', async (req, res, next) => {
  try {
    res.json(await bq.listTables(req.params.id));
  } catch (err) { next(err); }
});

router.post('/query', async (req, res, next) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql is required' });
    res.json(await bq.query(sql));
  } catch (err) { next(err); }
});

export default router;
```

Repeat the same pattern for `salesforce.js` and `vercel.js` routes.

#### D5. Wire into existing `server.js`

Add to the existing `server.js` — do NOT rewrite it:

```javascript
import bigqueryRoutes from './server/routes/bigquery.js';
import salesforceRoutes from './server/routes/salesforce.js';
import vercelRoutes from './server/routes/vercel.js';

// After existing middleware
app.use('/api/bigquery', bigqueryRoutes);
app.use('/api/salesforce', salesforceRoutes);
app.use('/api/vercel', vercelRoutes);

// Error handler (add at the end, before app.listen)
app.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(err.status || 500).json({ error: err.message });
});
```

### E. Frontend Architecture

```
src/
├── components/
│   ├── ui/               — shadcn/ui components (auto-generated)
│   ├── dashboard/
│   │   ├── ConnectorCard.jsx    — Status card for each connector (connected/error/loading)
│   │   ├── QueryEditor.jsx      — SQL/SOQL textarea with run button
│   │   ├── ResultsTable.jsx     — TanStack Table rendering query results
│   │   ├── DatasetBrowser.jsx   — Tree view: datasets → tables (BigQuery)
│   │   ├── ObjectBrowser.jsx    — List Salesforce objects + field inspector
│   │   ├── DeploymentList.jsx   — Vercel deployments with status badges
│   │   └── MetricsPanel.jsx     — Tremor KPI cards (row counts, query time, etc.)
│   └── layout/
│       ├── Sidebar.jsx          — Navigation: BigQuery | Salesforce | Vercel | Query
│       └── Header.jsx           — App header with connection status indicators
├── pages/
│   ├── Dashboard.jsx            — Overview: all 3 connector statuses + recent activity
│   ├── BigQueryPage.jsx         — Dataset browser + query editor + results
│   ├── SalesforcePage.jsx       — Object browser + SOQL editor + results
│   ├── VercelPage.jsx           — Projects + deployments + analytics
│   └── UnifiedQueryPage.jsx     — Run queries against any connector from one place
├── hooks/
│   ├── useConnectorStatus.js    — GET /api/{connector}/status, returns { connected, error }
│   ├── useQuery.js              — POST /api/{connector}/query, returns { data, loading, error }
│   └── useBrowser.js            — Fetch datasets/objects/projects for sidebar browsing
└── lib/
    └── api.js                   — Thin fetch wrapper: base URL, error handling, JSON parsing
```

#### E1. API Client (`src/lib/api.js`)

```javascript
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

export const api = {
  bigquery: {
    datasets: () => apiFetch('/api/bigquery/datasets'),
    tables: (dataset) => apiFetch(`/api/bigquery/datasets/${dataset}/tables`),
    query: (sql) => apiFetch('/api/bigquery/query', {
      method: 'POST', body: JSON.stringify({ sql }),
    }),
  },
  salesforce: {
    objects: () => apiFetch('/api/salesforce/objects'),
    describe: (name) => apiFetch(`/api/salesforce/objects/${name}`),
    query: (soql) => apiFetch('/api/salesforce/query', {
      method: 'POST', body: JSON.stringify({ soql }),
    }),
  },
  vercel: {
    projects: () => apiFetch('/api/vercel/projects'),
    deployments: (id) => apiFetch(`/api/vercel/projects/${id}/deployments`),
    project: (id) => apiFetch(`/api/vercel/projects/${id}`),
  },
};
```

#### E2. Key Component — Results Table with TanStack

```jsx
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { ArrowUpDown } from 'lucide-react';

export default function ResultsTable({ data }) {
  const [sorting, setSorting] = useState([]);

  const columns = useMemo(() => {
    if (!data?.length) return [];
    return Object.keys(data[0]).map(key => ({
      accessorKey: key,
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting()}>
          {key} <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    }));
  }, [data]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (!data?.length) return <p className="text-muted-foreground p-4">No results</p>;

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id}>
              {hg.headers.map(h => (
                <TableHead key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">
          {data.length} rows
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </div>
    </div>
  );
}
```

#### E3. Dashboard Page with Tremor Metrics

```jsx
import { Card, Metric, Text, Flex, Grid, Badge } from '@tremor/react';
import { useConnectorStatus } from '../hooks/useConnectorStatus';
import { Database, Cloud, Rocket } from 'lucide-react';

const connectors = [
  { key: 'bigquery', label: 'BigQuery', icon: Database, color: 'blue' },
  { key: 'salesforce', label: 'Salesforce', icon: Cloud, color: 'cyan' },
  { key: 'vercel', label: 'Vercel', icon: Rocket, color: 'violet' },
];

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Data Platform</h1>
      <Grid numItemsMd={3} className="gap-4">
        {connectors.map(c => (
          <ConnectorStatusCard key={c.key} connector={c} />
        ))}
      </Grid>
    </div>
  );
}

function ConnectorStatusCard({ connector }) {
  const { connected, error, loading } = useConnectorStatus(connector.key);
  const Icon = connector.icon;

  return (
    <Card decoration="top" decorationColor={connected ? connector.color : 'gray'}>
      <Flex justifyContent="between" alignItems="center">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <Text>{connector.label}</Text>
        </div>
        <Badge color={loading ? 'gray' : connected ? 'green' : 'red'}>
          {loading ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}
        </Badge>
      </Flex>
      {error && <Text className="text-red-500 mt-2 text-sm">{error}</Text>}
    </Card>
  );
}
```

### F. Routing Setup

Add to existing `react-router-dom` setup:

```jsx
// In your App.jsx or router config
import Dashboard from './pages/Dashboard';
import BigQueryPage from './pages/BigQueryPage';
import SalesforcePage from './pages/SalesforcePage';
import VercelPage from './pages/VercelPage';
import UnifiedQueryPage from './pages/UnifiedQueryPage';

// Add these routes alongside existing routes:
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/bigquery" element={<BigQueryPage />} />
<Route path="/salesforce" element={<SalesforcePage />} />
<Route path="/vercel" element={<VercelPage />} />
<Route path="/query" element={<UnifiedQueryPage />} />
```

### G. Execution Checklist

Execute in this exact order. Do NOT skip steps. Do NOT parallelize steps that depend on previous ones.

```
Step 1: Read existing files
  - Read server.js, src/App.jsx, src/pages/*.jsx, package.json
  - Understand existing patterns before writing anything
  → verify: You can describe the existing auth flow, routing, and API patterns

Step 2: Install dependencies
  - Run the npm install commands from section B
  - Initialize shadcn/ui with: npx shadcn@latest init
  - Add shadcn components listed in section B
  → verify: npm ls shows no peer dep warnings

Step 3: Create .env.example
  - Copy the template from section C
  → verify: File exists with all keys

Step 4: Build backend connectors
  - Create server/connectors/bigquery.js
  - Create server/connectors/salesforce.js
  - Create server/connectors/vercel.js
  → verify: Each module exports connect(), query(), and list* functions

Step 5: Build API routes
  - Create server/routes/bigquery.js
  - Create server/routes/salesforce.js
  - Create server/routes/vercel.js
  → verify: Each router has GET and POST endpoints

Step 6: Wire routes into server.js
  - Import and mount routes
  - Add error handler middleware
  - DO NOT modify existing routes or middleware
  → verify: Server starts without errors

Step 7: Build frontend lib/api.js
  - Create src/lib/api.js
  → verify: Exports api object with all three connector methods

Step 8: Build frontend hooks
  - Create src/hooks/useConnectorStatus.js
  - Create src/hooks/useQuery.js
  - Create src/hooks/useBrowser.js
  → verify: Each hook returns { data, loading, error }

Step 9: Build UI components
  - Build in this order: layout → dashboard → browser → query → results
  - Use shadcn/ui for all interactive elements
  - Use Tremor for metrics and charts only
  → verify: Components render with mock data (hardcoded arrays)

Step 10: Wire frontend to backend
  - Replace mock data with real API calls via hooks
  - Add loading states and error boundaries
  → verify: Full data flow works end-to-end

Step 11: Add routes to App.jsx
  - Add new page routes alongside existing ones
  → verify: Navigation between all pages works
```

### H. What NOT To Do

- Do NOT create a monolithic "DatabaseService" class
- Do NOT add WebSocket support (HTTP polling is fine for v1)
- Do NOT build an auth system for the connectors page (reuse existing auth)
- Do NOT add Redux, Zustand, or any state management library (React state + hooks is enough)
- Do NOT create TypeScript types (project uses JSX, not TSX)
- Do NOT add unit tests in this pass (separate task)
- Do NOT modify the existing Chat, Login, or Sandpack functionality
- Do NOT add environment variable validation at startup (check on first use)
- Do NOT add a "connector settings" page — credentials go in .env

---

## Summary

This blueprint creates a unified data platform by adding 3 backend connectors (BigQuery, Salesforce, Vercel API), 3 Express route files, and a shadcn/ui + Tremor frontend with dataset browsing, query editors, and result tables. It integrates into the existing Vite + React + Express project without replacing anything. Total new files: ~20. Total modified files: 2 (server.js, App.jsx).

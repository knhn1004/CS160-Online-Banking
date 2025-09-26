### CS160 Online Banking

1. Env (.env)

- DATABASE_URL
- DIRECT_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

2. Install

```bash
pnpm install
```

3. DB migrate + seed

```bash
pnpm prisma migrate dev
pnpm seed
```

4. Run

```bash
pnpm dev
```

5. Tests

```bash
pnpm test
# watch mode
pnpm test:watch
```

6. Lint & Format

```bash
pnpm lint
pnpm format:fix
```

Seeded logins (for local testing):

- manager@example.com / Password123!
- ava@example.com / Password123!
- liam@example.com / Password123!

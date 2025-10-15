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

7. API Documentation

View docs: http://localhost:3000/api-doc (dev only)

Add docs to new routes:

```typescript
/**
 * @swagger
 * /api/your-route:
 *   get:
 *     summary: Brief description
 *     tags: [YourTag]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success response
 */
export async function GET(request: Request) {
  // your code
}
```

Seeded logins (for local testing):

- manager@example.com / Password123!
- ava@example.com / Password123!
- liam@example.com / Password123!

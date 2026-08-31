This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend integration

The console calls the Kratos user service through same-origin Next.js route handlers. Configure the server-only runtime variable when the Kratos HTTP service is not available at its local default:

```bash
KRATOS_USER_API_URL=http://localhost:8002
KRATOS_USER_API_TIMEOUT_MS=10000
GEO_CONSOLE_ACCESS_REFRESH_WINDOW_MS=300000
```

Access and refresh tokens are stored in HttpOnly cookies and are never exposed to browser JavaScript.
When an authenticated API or SSE request arrives within the configured access-token
refresh window, the route handler rotates the token pair before forwarding the
request. Concurrent refreshes are coalesced so an active browser session does not
lose authentication when several requests arrive at the same time.

## Docker deployment

Build one environment-independent image, then provide the user API address when
the container starts:

```bash
docker build -t geo-userconsole .
docker run --rm -p 3000:3000 \
  -e KRATOS_USER_API_URL=https://api.example.com \
  geo-userconsole
```

No reverse proxy is required. When the standalone server is exposed directly,
the browser calls the same-origin `/api/backend/*` routes and the Next.js server
forwards them to `KRATOS_USER_API_URL`.

For Kubernetes or Docker Compose, configure `KRATOS_USER_API_URL` in the
container environment in the same way. If a reverse proxy is added later,
forward the original `Host` (or `X-Forwarded-Host`) together with
`X-Forwarded-Proto`.

The typed browser client is generated from `../kratos-svr/openapi.yaml`:

```bash
npm run openapi
```

`npm run dev` and `npm run build` regenerate it automatically before starting.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

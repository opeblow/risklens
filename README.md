# RiskLens

<img src="public/risklens-logo.svg" width="88" height="88" alt="RiskLens logo" align="right" />

**The DeFi Risk Copilot for Solana** — paste any mint address (or pick a trending token) and get a live risk score, letter grade, and a plain-English breakdown of exactly what could hurt your bag.

Built for the [NoahAI Hackathon](https://trynoah.ai/hackathon) on the NoahAI design system.

---

## What it does

RiskLens turns the cold, opaque wall of on-chain data into one decision: **how risky is this token?**

- **Instant scoring** — a 0–100 risk score with a letter grade (`A` low risk → `F` critical) for any Solana SPL mint, including native SOL.
- **Factor-by-factor report** — every score is broken into weighted, human-readable factors with the on-chain evidence behind each one.
- **Live data, resilient** — reads real mint/authority/supply state from Solana RPC and live market data (Jupiter, with a CoinGecko fallback), so the demo doesn't break when an API does.
- **Trending picks** — 10 curated, verified mints (SOL, USDC, BONK, JUP, WIF, PYTH, jitoSOL, mSOL, JTO, MNDE).
- **Wallet aware** — connect Phantom to see your SOL balance beside the analysis.

### Scoring model

| Factor | Weight | What it detects |
| --- | ---: | --- |
| Mint authority | 20 | Can someone mint infinite supply? |
| Liquidity / market cap | 15 | Rug-pullable or manipulable market size |
| Supply distribution | 15 | Locked/unlisted supply that can dump later |
| Freeze authority | 10 | Can balances be frozen? |
| Permanent delegate | 10 | Can a delegate move every holder's tokens? |
| 24h turnover | 10 | Wash trading or churn vs. market cap |
| 24h volatility | 10 | Extreme moves consistent with pump & dump |
| Trust signals | 10 | Audits, logo/metadata, established tokens |
| Contract age | 5 | Freshly deployed = unproven |

**Grades:** `A` ≤ 19 · `B` ≤ 34 · `C` ≤ 49 · `D` ≤ 69 · `F` > 69

### Resilience design

- Scores **never crash when a data source does**: if market data is unavailable, affected factors fall back to a neutral 50 so the rest of the report stays honest.
- Prices are cached for 120 s; RPC endpoints are tried in order with failover.
- Native SOL is detected and scored as a first-class asset, and invalid inputs report *"no SPL token mint found"* instead of a false "clean" verdict.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7, Vite 8, Tailwind CSS 4 |
| Design | NoahAI design tokens (`#4EDE88 → #0188FB → #7D7AFF`, dark surfaces) |
| On-chain | `@solana/web3.js` parsed accounts + Metaplex metadata parsing |
| Market data | Jupiter API with CoinGecko fallback |
| Wallet | `@solana/wallet-adapter-react` (Phantom) |
| Checks | TypeScript `tsc`, Oxlint, single-command `pnpm build` |

## Getting started

**Prerequisites:** Node.js ≥ 20, pnpm ≥ 9.

```sh
# install
pnpm install

# run the dev server (http://localhost:5173)
pnpm dev

# production build — runs tsc + vite build
pnpm build

# lint
pnpm lint

# preview the production build
pnpm preview
```

### Test the scoring engine without a browser

The analysis core is framework-free and runs under Node, so it can be tested against live mainnet data headlessly:

```sh
pnpm exec vite build --ssr scripts/engine-entry.ts --outDir .tmp-ssr
node scripts/smoke.mjs   # USDC, SOL, jitoSOL, WIF, PYTH, and an invalid input
```

Expected output is stable across runs (e.g. `USDC → 41/C`, `SOL → 13/A`); genuinely flaky results would indicate a live-data regression.

## Project structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                 # lint + typecheck + build on push/PR
├── public/
│   ├── _redirects                 # Netlify/Cloudflare Pages SPA fallback
│   ├── favicon.svg                # RiskLens mark (browser tab)
│   ├── noah.svg                   # NoahAI platform mark
│   ├── risklens-logo.svg          # Product logo
│   └── icons.svg
├── scripts/                       # Headless testing of the scoring engine
│   ├── engine-entry.ts            # SSR entry that exports analyzeMint
│   ├── smoke.mjs                  # Live mainnet smoke test (6 mints)
│   └── diag.mjs                   # Repeated-pass diagnostics per mint
├── src/
│   ├── assets/hero.png
│   ├── pages/
│   │   ├── Analyze.tsx            # 🔎 analyze/:mint — the core page
│   │   └── Home.tsx               # Landing
│   ├── components/
│   │   ├── app/                   # Product UI
│   │   │   ├── RiskReport.tsx     # Factor breakdown + score gauge
│   │   │   ├── Leaderboard.tsx    # Trending picks
│   │   │   └── WalletButton.tsx   # Phantom connect + SOL balance
│   │   ├── landing/               # Home sections
│   │   │   ├── Hero.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── Integrations.tsx
│   │   │   ├── Pricing.tsx
│   │   │   └── CommunityGrid.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/                    # NoahAI design system
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Logo.tsx
│   │       ├── RiskBadge.tsx
│   │       ├── ScoreGauge.tsx
│   │       └── Spinner.tsx
│   ├── lib/
│   │   ├── solana/
│   │   │   ├── rpc.ts             # RPC failover, SPL mint parsing, native SOL
│   │   │   ├── jupiter.ts         # Price/meta: Jupiter API → CoinGecko fallback
│   │   │   ├── risk.ts            # Scoring engine + report generation
│   │   │   ├── wallet.ts          # Wallet helpers
│   │   │   └── WalletProvider.tsx
│   │   ├── storage.ts             # Local analysis history
│   │   └── types.ts               # Shared types (RiskReport, OnchainMintInfo…)
│   ├── App.tsx                    # Routes
│   ├── index.css                  # NoahAI design tokens
│   └── main.tsx
├── .gitignore
├── .npmrc
├── .oxlintrc.json
├── CONTRIBUTING.md
├── index.html
├── LICENSE
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── SECURITY.md
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vercel.json                    # Vercel SPA rewrites
└── vite.config.ts
```

## Deploying

The app is a static SPA; route `/analyze/:mint` needs a SPA fallback:

- **Netlify** — `public/_redirects` is copied into the build output automatically.
- **Vercel** — `vercel.json` rewrites everything to `index.html`.
- **Cloudflare Pages** — also honors `public/_redirects`.

```sh
pnpm build   # outputs to dist/
```

Environment variables: none required. All analysis happens client-side against public RPC and market APIs.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev workflow, conventions, and how to add a mint or tune a factor.

## Security

Found a bug or a way to make RiskLens misleading or unsafe? See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 RiskLens contributors
# RiskLens

<img src="public/risklens-mark.svg" width="180" height="38" alt="RiskLens logo" align="right" />

**The DeFi Risk Copilot for Solana** — paste any mint address (or pick a trending token) and get a live risk score, letter grade, and a plain-English breakdown of exactly what could hurt your bag.

---

## Built with NoahAI

RiskLens was designed and implemented using NoahAI's Plan and Agent workflows for the **NoahAI Hackathon**. NoahAI helped translate the product concept into a working Solana application — the interface, wallet integration, on-chain data pipeline, and the iterative risk-engine improvements.

RiskLens demonstrates how NoahAI can be used to build a practical Web3 product using a **deterministic, explainable risk engine** over live on-chain and market data — not just a landing-page prototype.

> **Positioning:** RiskLens is an *explainable Solana token-risk copilot built with NoahAI*. It converts live on-chain and market evidence into a transparent, factor-by-factor risk score.

**Architecture:**

```
Solana RPC + Jupiter + CoinGecko
              ↓
Deterministic 100-pt risk engine
              ↓
Evidence-backed risk report
```

---

## What it does

RiskLens turns the cold, opaque wall of on-chain data into one decision: **how risky is this token?**

- **Instant scoring** — a 0–100 risk score with a letter grade (`A` low risk → `F` critical) for any Solana SPL mint, including native SOL.
- **Factor-by-factor report** — every score is broken into weighted, human-readable factors with the on-chain evidence behind each one.
- **Live data, resilient** — reads real mint/authority/supply state from Solana RPC and live market data (Jupiter, with a CoinGecko fallback), so the demo doesn't break when an API does.
- **Trending picks** — 10 curated, verified mints (SOL, USDC, BONK, JUP, WIF, PYTH, jitoSOL, mSOL, JTO, MNDE).
- **Wallet aware** — connect Phantom to see your SOL balance and sign a risk review, saved locally on this device (no backend).

### Scoring model

A fixed **100-point** model (base weights sum to exactly 100; `scripts/test-scoring.mjs` asserts this). Missing evidence is recorded as coverage/confidence, never as a noise factor that silently changes the other weights.

| Factor | Weight | What it detects |
| --- | ---: | --- |
| Mint authority | 20 | Can someone mint infinite supply? |
| Supply distribution / unlock risk | 15 | Locked/unlisted supply that can dump later |
| Market size | 15 | Rug-pullable or manipulable market size |
| Freeze authority | 10 | Can balances be frozen? |
| Permanent delegate | 10 | Can a delegate move every holder's tokens? |
| Holder concentration | 10 | Top-holder and developer-held supply risk |
| 24h turnover | 5 | Unusually high volume vs. cap |
| 24h volatility | 5 | Extreme moves and manipulation risk |
| Trust signals | 5 | Listing/verification evidence (not a security audit) |
| Contract age | 5 | Freshly deployed = unproven |
| **Total** | **100** | |

Token-2022 mints may add transfer-hook and mint-close factors; the score denominator renormalizes dynamically and `coverage` records any factor that could not be verified.

**Grades:** `A` ≤ 19 · `B` ≤ 34 · `C` ≤ 49 · `D` ≤ 69 · `F` > 69

### Resilience design

- Scores **never crash when a data source does**: if market data is unavailable, affected factors fall back to a neutral 50 so the rest of the report stays honest.
- Prices are cached for 120 s; RPC endpoints are tried in order with failover.
- Native SOL is detected and scored as a first-class asset, and invalid inputs report *"no SPL token mint found"* instead of a false "clean" verdict.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7, Vite 8, Tailwind CSS 4 |
| Design | Dark surfaces with a signature gradient (`#4EDE88 → #0188FB → #7D7AFF`) |
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
│   ├── noah.svg                   # Noah platform mark
│   ├── risklens-mark.svg          # Wordmark (N mark + "RiskLens" text, matches UI)
│   └── icons.svg
├── scripts/                       # Headless testing of the scoring engine
│   ├── engine-entry.ts            # SSR entry that exports analyzeMint
│   ├── smoke.mjs                  # Live mainnet smoke test (6 mints)
│   └── diag.mjs                   # Repeated-pass diagnostics per mint
├── src/
│   ├── assets/hero.png
│   ├── pages/
│   │   ├── Analyze.tsx            # analyze/:mint — the core page
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
│   │   │   └── CommunityGrid.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/                    # Reusable UI primitives
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
│   ├── index.css                  # Design tokens
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
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
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
# Contributing to RiskLens

Thanks for helping make RiskLens more useful and more honest. This is a hackathon project, so keep things fast and focused.

## Development workflow

1. **Fork and clone**, then:
   ```sh
   pnpm install
   pnpm dev
   ```
2. Create a branch: `git checkout -b fix/xxx` or `feat/xxx`.
3. Make your change.
4. Run the full check suite — it must pass before you open a PR:
   ```sh
   pnpm lint        # Oxlint
   pnpm exec tsc -b # type check
   pnpm build       # type check + production build
   ```
5. If you touched the scoring/data layer, run the headless live suite:
   ```sh
   pnpm exec vite build --ssr scripts/engine-entry.ts --outDir .tmp-ssr
   node scripts/smoke.mjs
   ```
   Results must be **stable across runs** — if a score flips run-to-run without a real market change, that is a bug, not a feature.
6. Commit with a concise message, push, and open a pull request.

## What we care about

- **Honesty over optimism.** A risk copilot that always says "looks clean" is worthless. If a factor can't be verified, score it neutral (50) and say so — never hide it.
- **Stability over cleverness.** Scores must not swing because an API rate-limited or an RPC node flaked. Caches, failovers, and neutral fallbacks are the norm.
- **Consistency with the UI.** Use the NoahAI design tokens in `src/index.css`. The logo is `public/risklens-logo.svg`, derived from the same `#4EDE88 → #0188FB → #7D7AFF` gradient used in the app.

## Adding or fixing a mint

Mint addresses are verified against the CoinGecko platform registry before they're hardcoded. Wrong addresses are worse than none. When you add a mint to `KNOWN_MINT_NAMES`, `COINGECKO_IDS`, or the `TRENDING` list, prove it with a live check:

```sh
node -e "import('./.tmp-ssr/engine-entry.js').then(async e=>{const r=await e.getMintInfo('MINT_HERE'); console.log(r.existsOnChain, r.metadataName, r.metadataSymbol)})"
```

`existsOnChain` must be `true` and the metadata should match the expected token.

## Tuning a factor

Factor weights and thresholds live in `src/lib/solana/risk.ts`. Every factor carries `weight` plus a score for each outcome bucket — keep the weights summing to 100 and document the rationale in the PR description. Re-run `scripts/smoke.mjs` and confirm the anchor tokens (USDC, SOL) move in the expected direction.

## Report a vulnerability

Do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).

## Code of conduct

Keep it kind and constructive. Be specific in reviews: point at the line, explain the risk, propose the fix.
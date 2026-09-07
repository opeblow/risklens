# Security Policy

RiskLens is a read-only analysis tool: it reads public Solana chain data and public market APIs and makes **no transactions and no server requests beyond public endpoints**. This keeps the attack surface small — and avowedly so.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` | ✅ Active development |
| Any published release | ✅ |

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems. Instead, report privately so we can fix it before it is disclosed.

**Where to report:** open a private advisory by creating an issue and choosing the **Report a security vulnerability** option, or email the maintainers at the address listed on your Notre-Dame contact. If neither is practical, open a draft PR that patches the issue without describing it in the title.

### What to include

- Affected file(s) and function(s) with line references.
- A minimal reproduction (a mint address and the RPC/market calls that trigger it is usually enough).
- Impact assessment: what could an attacker gain or what could a user be misled into?

### What happens next

1. We acknowledge within **48 hours**.
2. We assess and prioritize; critical issues get a fix within **7 days**.
3. We credit you in the release notes (unless you prefer to stay anonymous).

## Scope & known boundaries

| In scope | Out of scope |
| --- | --- |
| Analysis correctness enabling financial harm (mints that report "safe" when dangerous) | Walks/failure of third-party APIs (jup.ag, CoinGecko, Solana RPC nodes) |
| User prompt/XSS injection through mint input or report output | Phishing sites impersonating RiskLens |
| Secret/key leakage (there are none — everything runs client-side) | Lost funds: RiskLens never transacts |

## Security design principles

- **Client-first, no keys.** No API keys, no secrets, no server — nothing to leak. All analysis uses public endpoints.
- **Fail loudly, not falsely.** When data cannot be verified, affected factors score a neutral 50 and the report says the data is unavailable. A misleading "clean" verdict is treated as a vulnerability.
- **Validated input.** Mint strings are validated as canonical base58 public keys before any RPC call.
- **Pinned dependencies.** The lockfile is committed (`pnpm-lock.yaml`); CI installs with a fixed pnpm version.
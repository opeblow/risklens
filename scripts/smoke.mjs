import { analyzeMint } from '../.tmp-ssr/engine-entry.js'

const mints = [
  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC'],
  ['So11111111111111111111111111111111111111112', 'SOL'],
  ['J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', 'jitoSOL'],
  ['EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', 'WIF'],
  ['HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', 'PYTH'],
  ['garbage***', 'BAD'],
]

for (let pass = 1; pass <= 3; pass++) {
  console.log('--- pass', pass)
  for (const [m, l] of mints) {
    try {
      const r = await analyzeMint(m)
      console.log(
        [l, r.name, r.symbol, 'score=' + r.riskScore, r.grade].join(' | '),
      )
    } catch (e) {
      console.log(l, 'THREW', e.message)
    }
  }
}
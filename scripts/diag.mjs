import { analyzeMint } from '../.tmp-ssr/engine-entry.js'

const m = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
for (let pass = 1; pass <= 4; pass++) {
  const r = await analyzeMint(m)
  console.log('=== pass', pass, 'score', r.riskScore, r.grade)
  console.log(
    ' price:',
    r.price
      ? JSON.stringify({
          p: r.price.price,
          mc: r.price.marketCap?.slice(0, 10),
        })
      : 'null',
  )
  console.log(' factors:', r.factors.map((f) => `${f.id}:${f.score}`).join(' '))
}
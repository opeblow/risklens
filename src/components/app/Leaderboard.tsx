import { Link } from 'react-router-dom'
import { getAttestations } from '../../lib/storage'
import { shortAddress } from '../../lib/solana/wallet'

export default function Leaderboard() {
  const attestations = [...getAttestations()].sort(
    (a, b) => a.score - b.score,
  )

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          My signed risk reviews
        </h2>
        <span className="text-xs text-noah-muted">
          Stored locally on this device · {attestations.length} signed review{attestations.length === 1 ? '' : 's'}
        </span>
      </div>

      {attestations.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-noah-border-2 bg-noah-surface/40 p-8 text-center">
          <p className="text-sm text-noah-muted">
            No wallet-signed reviews yet.
          </p>
          <p className="mt-1 text-xs text-noah-muted-2">
            Analyze a token above and press{' '}
            <span className="text-white">Sign & save review</span> — your review
            lands here.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto noah-scroll">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-noah-muted-2">
                <th className="px-3">Token</th>
                <th className="px-3">Assessed by</th>
                <th className="px-3">When</th>
                <th className="px-3 text-right">Score</th>
                <th className="px-3 text-right">Grade</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {attestations.map((a) => (
                <tr key={a.signature} className="bg-noah-surface">
                  <td className="rounded-l-xl px-3 py-3">
                    <Link
                      to={`/analyze/${a.mint}`}
                      className="font-mono text-xs text-noah-blue hover:text-noah-blue-2"
                    >
                      {a.symbol || shortAddress(a.mint)}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-noah-muted">
                    {shortAddress(a.address)}
                  </td>
                  <td className="px-3 py-3 text-xs text-noah-muted">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-noah-amber">
                    {a.score}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        a.grade <= 'B'
                          ? 'border-noah-green/30 bg-noah-green/10 text-noah-green'
                          : a.grade === 'C'
                            ? 'border-noah-amber/30 bg-noah-amber/10 text-noah-amber'
                            : 'border-noah-red/30 bg-noah-red/10 text-noah-red'
                      }`}
                    >
                      {a.grade}
                    </span>
                  </td>
                  <td className="rounded-r-xl px-3 py-3 text-right">
                    <span className="font-mono text-[10px] text-noah-muted-2">
                      sig:{a.signature.slice(0, 8)}…
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
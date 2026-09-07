export default function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-noah-blue/25 border-t-noah-blue"
      style={{ width: size, height: size }}
      aria-label="loading"
    />
  )
}
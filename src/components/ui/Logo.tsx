export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="noahlg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4EDE88" />
            <stop offset="0.55" stopColor="#0188FB" />
            <stop offset="1" stopColor="#7D7AFF" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="#0F1215" />
        <path
          d="M8 22V10l8 10 8-10v12"
          stroke="url(#noahlg)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight text-white">
        Noah
      </span>
    </span>
  )
}
import { useEffect, useMemo, useState } from 'react'
import { logoCandidates } from '../lib/logos'

interface Props {
  ticker?: string
  image?: string | null
  size?: number
  className?: string
}

/** Logo with local download → rewritten CDN → letter fallback */
export default function TokenLogo({ ticker, image, size = 32, className = '' }: Props) {
  const candidates = useMemo(
    () => logoCandidates({ ticker, image }),
    [ticker, image],
  )
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [ticker, image])

  const src = candidates[idx]
  const letter = (ticker || '?').slice(0, 3).toUpperCase()
  const dim = `${size}px`

  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300 ${className}`}
        style={{ width: dim, height: dim, fontSize: Math.max(9, size * 0.28) }}
        aria-hidden
      >
        {letter}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full bg-zinc-800 object-cover ${className}`}
      style={{ width: dim, height: dim }}
      loading="lazy"
      decoding="async"
      onError={() => {
        setIdx((i) => (i + 1 < candidates.length ? i + 1 : candidates.length))
      }}
    />
  )
}

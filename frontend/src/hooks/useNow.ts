// SPDX-License-Identifier: MIT
import { useEffect, useState } from 'react'

/** Current unix timestamp in seconds, refreshed on an interval. */
export function useNow(intervalMs = 30_000): bigint {
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)))

  useEffect(() => {
    const id = setInterval(() => {
      setNow(BigInt(Math.floor(Date.now() / 1000)))
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}

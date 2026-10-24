// SPDX-License-Identifier: MIT

type IconProps = { className?: string }

function base(className?: string) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
}

export function BitcoinIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} fill="currentColor" stroke="none">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 3.1h2.3v1.7c.9.1 1.7.4 2.4.9l-1 1.7c-.5-.4-1.1-.6-1.8-.6-1 0-1.6.4-1.6 1.1 0 .8.7 1 2.3 1.4 2.3.5 3.5 1.3 3.5 3.1 0 1.6-1 2.7-2.8 3v1.7h-2.3v-1.7c-1.1-.1-2.1-.5-2.9-1.2l1.1-1.7c.7.6 1.6.9 2.5.9 1.1 0 1.8-.4 1.8-1.2 0-.8-.7-1.1-2.4-1.5-2.2-.5-3.4-1.3-3.4-3 0-1.5 1-2.6 2.7-2.9V5.1Z" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function ArrowUpRight({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

export function ArrowLeft({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3 5 6v5.5c0 4.4 3 8.2 7 9.5 4-1.3 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8 3.4-3.6" />
    </svg>
  )
}

export function BoltIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  )
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
      <path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      <path d="M21 11h-4a2 2 0 0 0 0 4h4" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 15 4-5 3 3 5-7" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

export function ExternalIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </svg>
  )
}

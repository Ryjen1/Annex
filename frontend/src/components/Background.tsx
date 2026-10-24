// SPDX-License-Identifier: MIT

/** Ambient background: grid, orange glow blooms and a vignette. Fixed, non-interactive. */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#070707]" />

      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black 20%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 60% at 50% 0%, black 20%, transparent 78%)',
        }}
      />

      <div className="animate-float-slow absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.16),transparent_62%)] blur-3xl" />
      <div className="animate-float-slow absolute top-1/3 -left-40 h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.09),transparent_65%)] blur-3xl [animation-delay:-5s]" />
      <div className="animate-float-slow absolute right-[-180px] bottom-0 h-[460px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,180,84,0.07),transparent_66%)] blur-3xl [animation-delay:-9s]" />

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  )
}

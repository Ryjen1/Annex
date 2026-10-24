// SPDX-License-Identifier: MIT

/** Ambient backdrop: soft orange bloom over the deep navy base. Fixed, non-interactive. */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#030412]" />
      <div className="animate-float-slow absolute -top-56 left-1/2 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.12),transparent_62%)] blur-3xl" />
      <div className="animate-float-slower absolute top-1/2 -left-52 h-[560px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(255,180,84,0.07),transparent_66%)] blur-3xl" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 55% at 50% 0%, black 15%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 55% at 50% 0%, black 15%, transparent 72%)',
        }}
      />
    </div>
  )
}

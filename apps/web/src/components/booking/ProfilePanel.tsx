import type { Profile } from '@teamlift/shared';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export function ProfilePanel({ profile, openCount }: { profile?: Profile; openCount?: number }) {
  if (!profile) {
    return (
      <div className="animate-pulse space-y-4" aria-hidden>
        <div className="size-12 bg-cell" />
        <div className="h-6 w-3/4  bg-cell" />
        <div className="h-4 w-1/2  bg-cell" />
      </div>
    );
  }
  return (
    <div>
      <div className="grid size-12 place-items-center bg-brand text-lg font-medium text-white">
        {initials(profile.name)}
      </div>
      <h1 className="mt-5 text-2xl leading-tight font-medium text-ink">{profile.name}</h1>
      <p className="mt-0.5 text-[15px] text-muted">{profile.title}</p>

      <ul className="mt-5 space-y-2 text-sm text-muted">
        <li className="flex items-center gap-2">
          <ClockIcon /> {profile.sessionMinutes}-minute 1:1 sessions
        </li>
        <li className="flex items-center gap-2">
          <VideoIcon /> {profile.location}
        </li>
        <li className="flex items-center gap-2">
          <GlobeIcon /> Times in {profile.timezone}
        </li>
      </ul>

      <p className="mt-5 text-sm leading-relaxed text-ink/85">{profile.bio}</p>

      {openCount !== undefined && (
        <p className="mt-6 flex items-center gap-2 text-sm text-ok">
          <span className="size-2 rounded-full bg-ok" aria-hidden />
          {openCount === 0 ? 'No open slots right now' : `${openCount} open ${openCount === 1 ? 'slot' : 'slots'}`}
        </p>
      )}
    </div>
  );
}

const iconProps = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true } as const;
const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
const VideoIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10 5-3v10l-5-3" strokeLinejoin="round" />
  </svg>
);
const GlobeIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
  </svg>
);

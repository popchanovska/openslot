import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useProfile } from '../api/hooks';
import { AddAvailability } from '../components/instructor/AddAvailability';
import { CalendarBoard } from '../components/instructor/CalendarBoard';
import { GoogleCalendarCard } from '../components/instructor/GoogleCalendarCard';
import { Notice, useSlowFlag, WakingNotice } from '../components/ui';

/** Fills the screen: tools in the left sidebar, the calendar on the right. */
export function InstructorPage() {
  const profile = useProfile();
  const tz = profile.data?.timezone ?? 'Europe/Skopje';
  const waking = useSlowFlag(profile.isPending);
  const googleNotice = useGoogleReturnNotice();

  return (
    <div className="flex flex-col lg:h-full">
      <WakingNotice show={waking} />
      {googleNotice}
      <div className="min-h-0 flex-1">
        <CalendarBoard
          tz={tz}
          sidebar={
            <div className="divide-y divide-line border-b border-line">
              <AddAvailability tz={tz} sessionMinutes={profile.data?.sessionMinutes ?? 30} />
              <GoogleCalendarCard />
            </div>
          }
        />
      </div>
    </div>
  );
}

/** Google's OAuth flow sends the instructor back with ?google=connected|error. */
function useGoogleReturnNotice() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<{ ok: boolean; reason?: string } | null>(null);

  useEffect(() => {
    const google = params.get('google');
    if (!google) return;
    setResult({ ok: google === 'connected', reason: params.get('reason') ?? undefined });
    setParams({}, { replace: true });
  }, [params, setParams]);

  if (!result) return null;
  return (
    <Notice tone={result.ok ? 'ok' : 'error'} onDismiss={() => setResult(null)}>
      {result.ok
        ? 'Google Calendar connected. Your events now show on the calendar.'
        : `Google Calendar wasn't connected: ${result.reason ?? 'unknown error'}. Try again.`}
    </Notice>
  );
}

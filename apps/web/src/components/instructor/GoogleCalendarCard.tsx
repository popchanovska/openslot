import { useGoogleConnect, useGoogleDisconnect, useGoogleStatus } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { Button, Notice } from '../ui';

export function GoogleCalendarCard() {
  const status = useGoogleStatus();
  const connect = useGoogleConnect();
  const disconnect = useGoogleDisconnect();
  const s = status.data;
  const failed = connect.error ?? disconnect.error;

  return (
    <section className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-6 place-items-center border-2 border-gcal text-[10px] font-semibold text-gcal" aria-hidden>
          31
        </span>
        <h2 className="text-[15px] font-medium text-ink">Google Calendar</h2>
      </div>

      {!s ? (
        <div className="mt-4 h-16 animate-pulse  bg-cell" aria-hidden />
      ) : !s.configured ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Not set up yet. Add the Google keys to apps/api/.env and restart.
        </p>
      ) : s.connected ? (
        <>
          <p className={`mt-3 flex items-center gap-2 text-sm ${s.error ? 'text-warn' : 'text-ok'}`}>
            <span className={`size-2 rounded-full ${s.error ? 'bg-warn' : 'bg-ok'}`} aria-hidden />
            {s.error ? 'Needs reconnecting' : 'Connected'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {s.error ??
              (s.showsEvents
                ? 'Your events show on the calendar. Clashing slots are hidden from clients.'
                : 'Reconnect to also show your event names on the calendar.')}
          </p>
          <div className="mt-4 flex gap-2">
            {(s.error || !s.showsEvents) && (
              <Button onClick={() => connect.mutate()} loading={connect.isPending}>
                Reconnect
              </Button>
            )}
            <Button variant="soft" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <span className="size-2 rounded-full bg-faint" aria-hidden />
            Not connected
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Show your events on the calendar and hide clashing slots from clients. Read-only.
          </p>
          <div className="mt-4">
            <Button onClick={() => connect.mutate()} loading={connect.isPending}>
              Connect Google Calendar
            </Button>
          </div>
        </>
      )}
      {failed && (
        <div className="mt-4">
          <Notice tone="error">{errorMessage(failed)}</Notice>
        </div>
      )}
    </section>
  );
}

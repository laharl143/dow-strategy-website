import { useAuth } from '../lib/auth';
import { setGuestMode } from '../lib/persistence';

/**
 * Shown before the app on first visit (or after signing out) when there's
 * no session and no remembered guest choice yet. "Continue as Guest" just
 * remembers the choice locally and never asks again on this browser.
 */
export function LoginGate({ onContinueAsGuest }: { onContinueAsGuest: () => void }) {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="login-gate">
      <div className="login-gate-backdrop" aria-hidden="true">
        {Array.from({ length: 60 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="login-gate-card">
        <div className="login-gate-rank">Dawn of War</div>
        <h1>Strategy Planner</h1>
        <div className="login-gate-actions">
          <button type="button" className="login-gate-google" onClick={() => void signInWithGoogle()}>
            <span className="login-gate-g-icon">G</span>
            Sign in with Google
          </button>
          <button
            type="button"
            className="login-gate-guest"
            onClick={() => {
              setGuestMode();
              onContinueAsGuest();
            }}
          >
            Continue as Guest
          </button>
        </div>
        <p className="login-gate-fine">
          Guest builds stay on this device only.
          <br />
          Sign in to carry them to another machine.
        </p>
      </div>
    </div>
  );
}

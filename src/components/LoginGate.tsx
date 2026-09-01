import { useAuth } from '../lib/auth';
import { setGuestMode } from '../lib/persistence';
import { heroes } from '../lib/gameData';
import { heroIconUrl } from '../lib/assets';

// A spread of 60 portraits across the whole roster (every other hero, in
// roster order) rather than a random pick, so the backdrop stays stable
// between renders instead of reshuffling.
const BACKDROP_HEROES = heroes.filter((_, i) => i % 2 === 0).slice(0, 60);

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
        {BACKDROP_HEROES.map((hero) => (
          <img key={hero.slug} src={heroIconUrl(hero.code)} alt="" draggable={false} loading="eager" />
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

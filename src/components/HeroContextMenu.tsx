import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

/**
 * Shared right-click "Inspect" menu for hero icons — used by the hero tray
 * and the board's placed hero slots. One instance per page is enough; pass
 * the returned `openMenu` down to each hero icon's onContextMenu.
 */
export function useHeroContextMenu() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState<{ x: number; y: number; heroSlug: string } | null>(null);

  useEffect(() => {
    if (!menu) return;
    function close() {
      setMenu(null);
    }
    window.addEventListener('click', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);

  function openMenu(e: React.MouseEvent, heroSlug: string) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, heroSlug });
  }

  // Rendered via a portal straight to <body> — this menu uses `position:
  // fixed` with viewport coordinates (clientX/clientY), but CSS gives any
  // transformed ancestor (e.g. the sliding hero/shop panels) its own
  // containing block for fixed descendants, which would otherwise throw the
  // menu's position off by that ancestor's offset.
  const menuNode = menu
    ? createPortal(
        <div className="hero-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              navigate(`/heroes/${menu.heroSlug}`);
              setMenu(null);
            }}
          >
            Inspect
          </button>
        </div>,
        document.body,
      )
    : null;

  return { openMenu, menuNode };
}

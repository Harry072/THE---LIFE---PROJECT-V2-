import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { MOBILE_PRIMARY_NAV } from "../data/lifeNavigation";

function isActiveRoute(item, pathname) {
  if (item.path === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (item.path === "/meditation") {
    return pathname === "/meditation" || pathname === "/music";
  }

  return pathname === item.path || pathname.startsWith(item.path);
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <div className="mobile-bottom-nav-spacer" aria-hidden="true" />
      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        {MOBILE_PRIMARY_NAV.map((item) => {
          const active = isActiveRoute(item, location.pathname);

          return (
            <button
              key={item.id}
              type="button"
              className={active ? "is-active" : ""}
              onClick={() => navigate(item.path)}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        .mobile-bottom-nav,
        .mobile-bottom-nav-spacer {
          display: none;
        }

        @media (max-width: 767px) {
          .mobile-bottom-nav-spacer {
            display: block;
            height: calc(76px + env(safe-area-inset-bottom));
            flex: 0 0 auto;
          }

          .mobile-bottom-nav {
            position: fixed;
            left: 10px;
            right: 10px;
            bottom: 10px;
            z-index: 120;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 4px;
            padding: 8px;
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
            border: 1px solid rgba(126, 217, 154, 0.18);
            border-radius: 22px;
            background:
              linear-gradient(145deg, rgba(13, 19, 16, 0.94), rgba(4, 8, 6, 0.94));
            box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42),
              0 0 24px rgba(46, 204, 113, 0.08);
            backdrop-filter: blur(18px);
          }

          .mobile-bottom-nav button {
            min-width: 0;
            min-height: 50px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            border: 0;
            border-radius: 16px;
            background: transparent;
            color: var(--text-faint);
            cursor: pointer;
            font-family: var(--font-body);
            padding: 6px 2px;
          }

          .mobile-bottom-nav button.is-active {
            color: var(--green-bright);
            background: rgba(46, 204, 113, 0.1);
          }

          .mobile-bottom-nav span {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1;
          }
        }
      `}</style>
    </>
  );
}

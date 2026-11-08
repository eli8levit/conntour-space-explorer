import { Link, NavLink, Outlet } from "react-router-dom";
import { ImageModal } from "./ImageModal";
import { SearchBar } from "./SearchBar";

const NAV_ITEMS = [
  { to: "/", label: "Browse", end: true },
  { to: "/history", label: "History", end: false },
  { to: "/scene", label: "Scene", end: false },
];

/** Header (brand, nav, search) around every page, plus the shared image modal. */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        {/* On a phone: brand + nav on the first row, search full width below. */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link to="/" className="rounded-sm font-mono text-sm uppercase tracking-widest">
            Space Explorer
          </Link>
          <nav aria-label="Main" className="flex gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-sm ${isActive ? "text-fg" : "text-muted hover:text-fg"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <SearchBar className="w-full sm:ml-auto sm:w-80 lg:w-96" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <ImageModal />
    </div>
  );
}

import { NavLink, Route, Routes } from 'react-router';
import { BookPage } from './pages/BookPage';
import { InstructorPage } from './pages/InstructorPage';

/** One screen tall on desktop: a thin tab bar, then the page fills the rest. */
export function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-surface">
        <nav className="mx-auto flex max-w-[1400px] gap-6 px-4 sm:px-8" aria-label="Views">
          {[
            { to: '/', label: 'Book a session' },
            { to: '/instructor', label: 'Instructor' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `-mb-px border-b-2 py-3.5 text-[15px] transition-colors ${
                  isActive ? 'border-brand font-medium text-brand' : 'border-transparent text-muted hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<BookPage />} />
          <Route path="/instructor" element={<InstructorPage />} />
          <Route path="*" element={<BookPage />} />
        </Routes>
      </main>
    </div>
  );
}

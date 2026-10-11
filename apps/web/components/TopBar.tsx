import Link from 'next/link';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';
import { SandboxStatus } from './SandboxStatus';
import { SoundToggle } from './SoundEffects';

export interface Crumb {
  label: string;
  href?: string;
}

/** The bar across every page: logo, breadcrumb, an optional progress slot, and status. */
export function TopBar({
  crumbs = [],
  children,
}: {
  crumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-18 shrink-0 items-center gap-4 border-b-2 border-line bg-page/95 px-4 backdrop-blur sm:gap-6 sm:px-6">
      <Logo />
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 text-lg sm:text-xl">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li
                  key={c.label}
                  className={`flex min-w-0 items-center gap-2 ${last ? '' : 'max-md:hidden'}`}
                >
                  {c.href && !last ? (
                    <Link href={c.href} className="truncate text-muted hover:text-ink">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${last ? 'font-semibold text-ink' : 'text-muted'}`}>
                      {c.label}
                    </span>
                  )}
                  {!last && <span className="text-muted">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="max-lg:hidden">{children}</div>
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <SandboxStatus />
        <SoundToggle />
        <Link href="/" className="btn btn-yellow btn-sm max-sm:hidden">
          Courses
        </Link>
        <AccountMenu />
      </div>
    </header>
  );
}

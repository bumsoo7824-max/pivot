import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            IT
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            잇다<span className="text-brand-600">(IT-DA)</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium text-slate-600">
          <Link
            href="/"
            className="rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-900"
          >
            소개
          </Link>
          <Link
            href="/demo"
            className="rounded-md bg-brand-600 px-3.5 py-2 text-white shadow-sm hover:bg-brand-700"
          >
            매칭 데모 시작
          </Link>
        </nav>
      </div>
    </header>
  );
}

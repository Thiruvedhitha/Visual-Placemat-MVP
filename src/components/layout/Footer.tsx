import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-400 sm:flex-row sm:px-6 lg:px-8">
        <span>&copy; {new Date().getFullYear()} Visual Placemat. All rights reserved.</span>
        <div className="flex gap-6">
          <Link href="/" className="hover:text-slate-600">Home</Link>
          <Link href="/dashboard" className="hover:text-slate-600">My Works</Link>
          <span className="cursor-default hover:text-slate-600">Privacy</span>
          <span className="cursor-default hover:text-slate-600">Terms</span>
        </div>
      </div>
    </footer>
  );
}

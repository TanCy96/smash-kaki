import Link from "next/link";
import { Card, PageShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell narrow>
      <Card>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-heading">Session not found</h1>
          <p className="mt-2 text-sm text-muted">
            This link is invalid or the session was removed.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-hi px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:brightness-105 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Create a new session
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}

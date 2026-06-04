import Link from "next/link";
import { Button, Card, PageShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell narrow>
      <Card>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-heading">Session not found</h1>
          <p className="mt-2 text-sm text-muted">
            This link is invalid or the session was removed.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Create a new session</Button>
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}

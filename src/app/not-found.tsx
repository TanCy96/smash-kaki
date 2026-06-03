import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold">Session not found</h1>
      <p className="mt-2 text-gray-600">
        This link is invalid or the session was removed.
      </p>
      <Link href="/" className="mt-4 inline-block text-emerald-700">
        Create a new session
      </Link>
    </main>
  );
}

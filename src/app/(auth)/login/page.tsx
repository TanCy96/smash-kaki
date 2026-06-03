import Link from "next/link";
import { loginAction } from "@/app/actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { reset, error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Log in</h1>
      {reset === "sent" && (
        <p className="mb-3 rounded bg-emerald-100 p-2 text-sm text-emerald-900">
          Password reset email sent.
        </p>
      )}
      {error && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={loginAction} className="flex flex-col gap-2">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border p-2"
        />
        <button className="rounded bg-emerald-600 p-2 text-white">
          Log in
        </button>
      </form>
      <div className="mt-3 flex justify-between gap-3 text-sm">
        <Link href="/register" className="text-emerald-700">
          Create account
        </Link>
        <Link href="/forgot-password" className="text-emerald-700">
          Forgot password?
        </Link>
      </div>
      <Link href="/" className="mt-4 inline-block text-sm text-gray-600">
        Back to sessions
      </Link>
    </main>
  );
}

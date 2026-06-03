import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions";

export default async function Forgot({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Reset password</h1>
      {error && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={forgotPasswordAction} className="flex flex-col gap-2">
        <input
          name="email"
          type="email"
          placeholder="Your account email"
          required
          className="rounded border p-2"
        />
        <button className="rounded bg-emerald-600 p-2 text-white">
          Send reset link
        </button>
      </form>
      <Link href="/login" className="mt-3 inline-block text-sm text-emerald-700">
        Back to login
      </Link>
    </main>
  );
}

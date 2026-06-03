import { forgotPasswordAction } from "@/app/actions";

export default function Forgot() {
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Reset password</h1>
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
    </main>
  );
}

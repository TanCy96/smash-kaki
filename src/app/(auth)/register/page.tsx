import { registerAction } from "@/app/actions";

export default function Register() {
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Create account</h1>
      <form action={registerAction} className="flex flex-col gap-2">
        <input
          name="display_name"
          placeholder="Name"
          required
          className="rounded border p-2"
        />
        <input
          name="email"
          type="email"
          placeholder="Email (for password reset)"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 6)"
          minLength={6}
          required
          className="rounded border p-2"
        />
        <button className="rounded bg-emerald-600 p-2 text-white">
          Register
        </button>
      </form>
    </main>
  );
}

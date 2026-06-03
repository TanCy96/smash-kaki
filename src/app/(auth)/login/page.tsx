import { loginAction } from "@/app/actions";

export default function Login() {
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Log in</h1>
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
      <a
        href="/forgot-password"
        className="mt-2 inline-block text-sm text-emerald-700"
      >
        Forgot password?
      </a>
    </main>
  );
}

import { useState, type FormEvent } from "react";
import { login } from "../shared/api/authApi";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
        slug: slug.trim(),
      });
      setSuccess(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No fue posible iniciar sesion.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <form className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesion</h1>
          <p className="mt-1 text-sm text-slate-600">Conecta contra el backend configurado en VITE_API_URL.</p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Slug</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            autoComplete="organization"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Correo</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Contraseña</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Sesion iniciada correctamente.</p> : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

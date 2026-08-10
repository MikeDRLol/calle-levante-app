import { LoginForm } from "@/app/login/login-form";
import { appConfig } from "@/config/navigation";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {appConfig.name}
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          {appConfig.tagline}
        </p>
        <LoginForm />
      </div>
    </div>
  );
}

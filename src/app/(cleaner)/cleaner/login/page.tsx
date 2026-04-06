import { LoginForm } from "@/components/cleaner/login-form";

export default function CleanerLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Cleaner Portal</h1>
          <p className="text-sm text-muted-foreground">
            Enter your name and password to view your schedule
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={{ layout: { showOptionalFields: false } }}
      />
    </div>
  );
}

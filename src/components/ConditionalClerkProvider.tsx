import { ClerkProvider } from "@clerk/nextjs";

/**
 * Wraps children in ClerkProvider only when a valid publishable key is available.
 *
 * During Docker builds, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY may be empty or
 * unavailable. The Clerk SDK validates the key eagerly and throws if it's
 * invalid, which breaks Next.js static page prerendering (e.g. /_not-found).
 *
 * This component checks for a key that looks valid (starts with "pk_")
 * before mounting ClerkProvider. When the key is missing or empty, children
 * render without Clerk — auth features simply won't be available.
 */

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkEnabled = clerkPubKey.startsWith("pk_");

export default function ConditionalClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isClerkEnabled) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}

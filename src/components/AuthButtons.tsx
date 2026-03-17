"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkEnabled = clerkPubKey.startsWith("pk_");

export default function AuthButtons() {
  // When Clerk is not configured, render nothing
  if (!isClerkEnabled) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="text-label-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
              userButtonPopoverCard: "bg-background border border-border shadow-lg",
              userButtonPopoverActions: "text-foreground",
              userButtonPopoverActionButton: "text-muted-foreground hover:text-foreground",
              userButtonPopoverFooter: "hidden",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}

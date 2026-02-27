"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

interface AuthButtonsProps {
  onWaitlistClick?: () => void;
}

export default function AuthButtons({ onWaitlistClick }: AuthButtonsProps) {
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
        {onWaitlistClick && (
          <button
            type="button"
            onClick={onWaitlistClick}
            className="px-4 py-2 text-label-lg text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            Join Waitlist
          </button>
        )}
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

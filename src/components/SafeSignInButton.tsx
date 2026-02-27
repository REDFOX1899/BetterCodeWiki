"use client";

import React from "react";

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkEnabled = clerkPubKey.startsWith("pk_");

/**
 * A wrapper around Clerk's SignInButton that gracefully degrades when
 * Clerk is not configured. When Clerk is unavailable, it renders
 * nothing (the children button is hidden since sign-in would not work).
 */
export default function SafeSignInButton({
  mode,
  children,
}: {
  mode?: "modal" | "redirect";
  children: React.ReactNode;
}) {
  if (!isClerkEnabled) {
    // Without Clerk, sign-in is not available — render nothing
    return null;
  }

  // Lazily require to avoid context errors when ClerkProvider is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SignInButton } = require("@clerk/nextjs");

  return <SignInButton mode={mode}>{children}</SignInButton>;
}

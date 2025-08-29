// app/_layout.tsx
import { Slot, SplashScreen, Redirect, usePathname } from "expo-router";
import React from "react";
import { useAuth } from "../src/hooks/useAuth";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useAuth();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  // Allow auth routes without session
  const isAuthRoute = pathname?.startsWith("/sign-in");

  if (!session && !isAuthRoute) {
    return <Redirect href="/sign-in" />;
  }

  if (session && isAuthRoute) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}

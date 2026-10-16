"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };
  return <Button onClick={logout}>Logout</Button>;
}

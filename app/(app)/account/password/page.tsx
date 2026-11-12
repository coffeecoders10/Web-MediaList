import type { Metadata } from "next";
import { PasswordForm } from "@/components/auth/PasswordForm";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return <PasswordForm mode="change" />;
}

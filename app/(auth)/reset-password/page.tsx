import type { Metadata } from "next";
import { AuthCovers } from "@/components/auth/AuthCovers";
import { PasswordForm } from "@/components/auth/PasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return <PasswordForm mode="reset" covers={<AuthCovers />} />;
}

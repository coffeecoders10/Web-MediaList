import type { Metadata } from "next";
import { AuthCovers } from "@/components/auth/AuthCovers";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <AuthForm mode="login" covers={<AuthCovers />} />;
}

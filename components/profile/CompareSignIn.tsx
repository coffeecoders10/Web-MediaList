import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import styles from "./ProfilePage.module.css";

/** A visitor with just the link can look around, but comparing needs a collection of their own. */
export function CompareSignIn() {
  return (
    <div className={`shell ${styles.missing}`}>
      <h1>Sign in to compare</h1>
      <p>Comparing sets your collection beside theirs, so it needs an account of your own. It takes a minute to make one.</p>
      <div className={styles.actions}>
        <Link href="/login" className={buttonClass({ variant: "solid" })}>
          Sign in
        </Link>
        <Link href="/signup" className={buttonClass({ variant: "outline" })}>
          Create account
        </Link>
      </div>
    </div>
  );
}

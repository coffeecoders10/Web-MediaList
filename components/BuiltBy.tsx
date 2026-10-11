import Image from "next/image";
import styles from "./BuiltBy.module.css";

/** A small credit line: the app is built by CoffeeCoders. */
export function BuiltBy({ className }: { className?: string }) {
  return (
    <p className={`${styles.credit} ${className ?? ""}`}>
      <Image src="/coffeecoders_logo.png" alt="" width={20} height={20} className={styles.logo} />
      <span>Built by CoffeeCoders</span>
    </p>
  );
}

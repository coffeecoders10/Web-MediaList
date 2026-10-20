import Image from "next/image";
import styles from "./BuiltBy.module.css";

/** A small credit line: the app is built by CoffeeCoders. */
export function BuiltBy({ className }: { className?: string }) {
  return (
    <p className={`${styles.credit} ${className ?? ""}`}>
      <a href="https://coffeecoders.cc" className={styles.link}>
        <Image
          src="https://coffeecoders.cc/coffeecoders_logo.png"
          alt=""
          width={20}
          height={20}
          unoptimized
          className={styles.logo}
        />
        <span>Built by CoffeeCoders</span>
      </a>
    </p>
  );
}

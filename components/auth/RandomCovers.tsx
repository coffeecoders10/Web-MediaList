import { connection } from "next/server";
import { Cover } from "@/components/Cover";
import { randomCatalogItems } from "@/lib/server/catalog";
import styles from "./AuthForm.module.css";

/** Three titles from the shared catalog, different on every visit. Renders nothing if the catalog can't be read. */
export async function RandomCovers() {
  await connection();
  const items = await randomCatalogItems(3).catch(() => []);
  if (items.length === 0) return null;

  return (
    <div className={styles.covers}>
      {items.map((item, i) => (
        <div key={item.id} className={styles.coverSlot} data-slot={i}>
          <Cover item={item} />
        </div>
      ))}
    </div>
  );
}

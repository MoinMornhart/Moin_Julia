/** Wird bei jedem Seitenwechsel neu eingehängt → jede Seite gleitet sanft herein. */
export default function GuildTemplate({ children }: { children: React.ReactNode }) {
  return <div className="enter">{children}</div>;
}

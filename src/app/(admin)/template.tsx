// A template re-mounts on every navigation (unlike a layout), so this is where
// the per-page entrance animation lives: content fades up into place each time
// the admin route changes. Pure CSS (tw-animate-css), and disabled for users
// who prefer reduced motion.
export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none">
      {children}
    </div>
  );
}

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-(family-name:--font-plus-jakarta)">
      {children}
    </div>
  );
}

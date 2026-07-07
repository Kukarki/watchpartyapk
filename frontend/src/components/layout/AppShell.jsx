export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-void text-base font-body antialiased flex flex-col">
      {children}
    </div>
  );
}
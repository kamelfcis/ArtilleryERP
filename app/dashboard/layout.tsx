// Dashboard layout is now handled by AppLayoutWrapper in root layout
// This file is kept for backward compatibility but is no longer needed
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}


import { GuideSidebar } from "@/components/guide/guide-sidebar"

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GuideSidebar />
      <div className="lg:pl-64">
        <main className="p-4 lg:p-6 pt-16 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  )
}

import AppLayout from '@/components/layout/AppLayout'
import { appMode } from '@/lib/app-mode'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout mode={appMode}>{children}</AppLayout>
}

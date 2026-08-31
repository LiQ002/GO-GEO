import { redirect } from 'next/navigation'
import ClientPlatformAuth from '@/components/pages/client/PlatformAuth'
import { isClientMode } from '@/lib/app-mode'

export default function PlatformsPage() {
  if (!isClientMode()) redirect('/dashboard')
  return <ClientPlatformAuth />
}

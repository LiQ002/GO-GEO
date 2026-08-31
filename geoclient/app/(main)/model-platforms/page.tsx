import { redirect } from 'next/navigation'
import ClientModelPlatformAuth from '@/components/pages/client/ModelPlatformAuth'
import { isClientMode } from '@/lib/app-mode'

export default function ModelPlatformsPage() {
  if (!isClientMode()) redirect('/dashboard')
  return <ClientModelPlatformAuth />
}

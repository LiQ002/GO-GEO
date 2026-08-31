import { redirect } from 'next/navigation'
import OperatorPublishing from '@/components/pages/operator/Publishing'
import { isOperatorMode } from '@/lib/app-mode'

export default function PublishingPage() {
  if (!isOperatorMode()) redirect('/dashboard')
  return <OperatorPublishing />
}

import { redirect } from 'next/navigation'
import { isClientMode, isOperatorMode } from '@/lib/app-mode'

export default function HomePage() {
  if (isOperatorMode()) {
    redirect('/dashboard')
  }
  if (isClientMode()) {
    redirect('/login')
  }
  redirect('/dashboard')
}

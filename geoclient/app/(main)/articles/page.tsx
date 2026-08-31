import { redirect } from 'next/navigation'
import OperatorArticles from '@/components/pages/operator/Articles'
import { isOperatorMode } from '@/lib/app-mode'

export default function ArticlesPage() {
  if (!isOperatorMode()) redirect('/dashboard')
  return <OperatorArticles />
}

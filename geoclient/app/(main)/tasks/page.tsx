import { redirect } from 'next/navigation'
import ClientTasks from '@/components/pages/client/Tasks'
import { isClientMode } from '@/lib/app-mode'

export default function TasksPage() {
  if (!isClientMode()) redirect('/dashboard')
  return <ClientTasks />
}

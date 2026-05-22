import { redirect } from 'next/navigation'

// Root redirects to the voice agent UI
export default function Home() {
  redirect('/voice?tenant=outlet-reviews&shop=shop1')
}

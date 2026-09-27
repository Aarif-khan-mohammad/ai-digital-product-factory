import SiteNav from '@/components/site/SiteNav'
import SiteFooter from '@/components/site/SiteFooter'
import CookieConsent from '@/components/site/CookieConsent'
import HomePage from './(site)/page'

export { metadata } from './(site)/page'

export default function Root() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <SiteNav />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <HomePage />
      </main>
      <SiteFooter />
      <CookieConsent />
    </div>
  )
}

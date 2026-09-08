import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Hero from '../components/landing/Hero'
import CommunityGrid from '../components/landing/CommunityGrid'
import HowItWorks from '../components/landing/HowItWorks'
import Features from '../components/landing/Features'
import Integrations from '../components/landing/Integrations'

export default function Home() {
  return (
    <div className="min-h-screen bg-noah-bg">
      <Navbar />
      <Hero />
      <CommunityGrid />
      <HowItWorks />
      <Features />
      <Integrations />
      <Footer />
    </div>
  )
}
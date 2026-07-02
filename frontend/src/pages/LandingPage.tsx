import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ModulesShowcase } from '@/components/landing/ModulesShowcase';
import { PixSection } from '@/components/landing/PixSection';
import { Pricing } from '@/components/landing/Pricing';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ModulesShowcase />
        <PixSection />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

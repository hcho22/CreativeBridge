import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import AppStoreLinks from '@/components/AppStoreLinks';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <AppStoreLinks />
      </main>
      <Footer />
    </>
  );
}

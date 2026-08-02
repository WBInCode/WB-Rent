import { SitePage } from '@/components/SitePage';
import { HowItWorks } from '@/sections/HowItWorks';
import { FAQContact } from '@/sections/FAQContact';

export default function HowItWorksPage() {
  return (
    <SitePage
      title="Jak działa wynajem — krok po kroku | WB-Rent"
      path="/jak-to-dziala"
      breadcrumb="Jak to działa"
      description="Wynajem sprzętu krok po kroku: rezerwacja online, umowa z podpisem elektronicznym, odbiór lub dostawa i zwrot. Odpowiedzi na najczęstsze pytania."
    >
      <HowItWorks />
      <FAQContact />
    </SitePage>
  );
}

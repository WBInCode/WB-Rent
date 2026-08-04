import { SitePage } from '@/components/SitePage';
import { Products } from '@/sections/Products';
import { Categories } from '@/sections/Categories';

export default function EquipmentPage() {
  return (
    <SitePage
      title="Sprzęt i cennik — wynajem Rzeszów | WB-Rent"
      path="/sprzet"
      breadcrumb="Sprzęt i cennik"
      description="Pełna oferta wynajmu: odkurzacze piorące Kärcher, odkurzacze przemysłowe, ozonatory i parownice. Ceny za dobę i pakiety weekendowe."
    >
      <Products />
      <Categories />
    </SitePage>
  );
}

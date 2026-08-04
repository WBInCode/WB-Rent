import { Suspense, lazy, useEffect } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

const Footer = lazy(() => import('@/sections/Footer').then((m) => ({ default: m.Footer })));

interface SitePageProps {
  /** Browser tab title for this subpage. */
  title: string;
  /** Canonical path, e.g. "/sprzet". */
  path: string;
  /** Breadcrumb label shown after "Start". */
  breadcrumb: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Shared frame for the public subpages: navbar, canonical URL, breadcrumbs and
 * footer. Keeps every subpage consistent without duplicating layout code.
 */
export function SitePage({ title, path, breadcrumb, description, children }: SitePageProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousCanonical = canonical?.href;
    if (canonical) canonical.href = `https://wb-rent.pl${path}`;

    const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = metaDescription?.content;
    if (metaDescription && description) metaDescription.content = description;

    const breadcrumbLd = document.createElement('script');
    breadcrumbLd.type = 'application/ld+json';
    breadcrumbLd.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: 'https://wb-rent.pl/' },
        { '@type': 'ListItem', position: 2, name: breadcrumb, item: `https://wb-rent.pl${path}` },
      ],
    });
    document.head.appendChild(breadcrumbLd);

    window.scrollTo(0, 0);

    return () => {
      document.title = previousTitle;
      if (canonical && previousCanonical) canonical.href = previousCanonical;
      if (metaDescription && previousDescription) metaDescription.content = previousDescription;
      breadcrumbLd.remove();
    };
  }, [title, path, breadcrumb, description]);

  return (
    <div className="min-h-screen bg-transparent relative">
      <div className="relative" style={{ zIndex: 1 }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-gold focus:text-bg-primary focus:rounded-lg focus:font-medium"
        >
          Przejdź do treści głównej
        </a>

        <Navbar />

        <main id="main-content" role="main" className="pt-24 md:pt-28">
          <nav aria-label="Ścieżka nawigacji" className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <ol className="flex items-center gap-1.5 text-xs text-text-muted">
              <li>
                <Link to="/" className="inline-flex min-h-[24px] items-center hover:text-gold transition-colors">Start</Link>
              </li>
              <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
              <li className="text-text-secondary font-medium">{breadcrumb}</li>
            </ol>
          </nav>

          {children}
        </main>

        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import DemoForm from '../components/landing/DemoForm';
import { LandingFooter, LandingNavbar } from '../components/landing/LandingShell';
import {
    FaqSection,
    GalleryAndExtrasSection,
    HeroSection,
    ModulesSection,
    PlatformSection,
    ProblemsSection,
    RolesAndComparisonSection,
    TrustBar,
    WorkflowSection,
} from '../components/landing/LandingSections';
import { landingContent } from '../data/landingContent';

function SeoManager() {
    useEffect(() => {
        const title = 'Clarity | Sistema de gestion para opticas y centros optometricos';
        const description = 'Clarity centraliza pacientes, consultas, recetas, ventas, inventario, laboratorio, caja, CRM, sucursales y reportes para opticas.';
        document.title = title;

        const upsert = (selector, attrs) => {
            let node = document.head.querySelector(selector);
            if (!node) {
                node = document.createElement(attrs.tag || 'meta');
                document.head.appendChild(node);
            }
            Object.entries(attrs).forEach(([key, value]) => {
                if (key !== 'tag') node.setAttribute(key, value);
            });
        };

        upsert('meta[name="description"]', { name: 'description', content: description });
        upsert('link[rel="canonical"]', { tag: 'link', rel: 'canonical', href: `${window.location.origin}/` });
        upsert('meta[property="og:title"]', { property: 'og:title', content: title });
        upsert('meta[property="og:description"]', { property: 'og:description', content: description });
        upsert('meta[property="og:type"]', { property: 'og:type', content: 'website' });
        upsert('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });

        const jsonLd = {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'SoftwareApplication',
                    name: landingContent.product.name,
                    applicationCategory: 'BusinessApplication',
                    operatingSystem: 'Web',
                    description,
                },
                {
                    '@type': 'Organization',
                    name: landingContent.product.name,
                    email: landingContent.product.demoEmail,
                },
                {
                    '@type': 'FAQPage',
                    mainEntity: landingContent.faq.map((item) => ({
                        '@type': 'Question',
                        name: item.question,
                        acceptedAnswer: { '@type': 'Answer', text: item.answer },
                    })),
                },
            ],
        };

        let script = document.head.querySelector('#clarity-landing-schema');
        if (!script) {
            script = document.createElement('script');
            script.id = 'clarity-landing-schema';
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(jsonLd);
    }, []);

    return null;
}

export default function LandingPage() {
    return (
        <main className="landing-page min-h-screen bg-white text-[var(--landing-ink)]">
            <SeoManager />
            <LandingNavbar />
            <HeroSection />
            <TrustBar />
            <ProblemsSection />
            <PlatformSection />
            <ModulesSection />
            <WorkflowSection />
            <RolesAndComparisonSection />
            <GalleryAndExtrasSection />
            <FaqSection />
            <DemoForm />
            <LandingFooter />
        </main>
    );
}

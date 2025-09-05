'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Link } from 'react-router-dom'

export default function FAQs() {
    const faqItems = [
        {
            id: 'item-1',
            question: "What's a farmer and a pooler?",
            answer: 'Farmers contribute work and stake to earn rewards. Poolers operate the coordination service that discovers blocks, assigns work, and handles payouts.',
        },
        {
            id: 'item-2',
            question: 'How are rewards distributed?',
            answer: 'Rewards are calculated from validated work and stake and paid out automatically. Every step is recorded in our event-sourced database for audits.',
        },
        {
            id: 'item-3',
            question: 'Can I run this on my own infrastructure?',
            answer: 'Yes. We support hosted and self-hosted deployments. Pooler and Backend services are designed for reliability and observability.',
        },
        {
            id: 'item-4',
            question: 'What networks are supported?',
            answer: 'KALE on Stellar/Soroban. We integrate with the Stellar SDK and expose production-ready health/info endpoints.',
        },
        {
            id: 'item-5',
            question: 'Is the system auditable?',
            answer: 'Yes. The platform is auditable by design with immutable logs and an event-sourced database for full traceability.',
        },
    ]

    return (
        <section className="py-16 md:py-24">
            <div className="mx-auto max-w-5xl px-4 md:px-6">
                <div className="mx-auto max-w-xl text-center">
                    <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl text-white">Frequently Asked Questions</h2>
                    <p className="text-white/70 mt-4 text-balance">Discover quick and comprehensive answers to common questions about KALE Pool, our services, and features.</p>
                </div>

                <div className="mx-auto mt-12 max-w-xl">
                    <Accordion
                        type="single"
                        collapsible
                        className="bg-white/5 ring-white/10 w-full rounded-2xl border border-white/10 px-8 py-3 shadow-sm ring-4">
                        {faqItems.map((item) => (
                            <AccordionItem
                                key={item.id}
                                value={item.id}
                                className="border-white/10">
                                <AccordionTrigger className="cursor-pointer text-base hover:no-underline text-white hover:text-[#95c697] transition-colors">
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-base text-white/70">{item.answer}</p>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    <p className="text-white/70 mt-6 px-8">
                        Can't find what you're looking for? Contact our{' '}
                        <Link
                            to="/dashboard"
                            className="text-[#95c697] font-medium hover:underline">
                            support team
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    )
}

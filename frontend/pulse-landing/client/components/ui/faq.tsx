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
            question: 'What is a custodial wallet and why do I need one?',
            answer: 'A custodial wallet is a secure Stellar wallet we create for you that automatically signs transactions on your behalf. You need it because KALE mining requires frequent transactions (planting, harvesting) that would be impossible to do manually. Instead of you signing each transaction, our system handles everything automatically using your custodial wallet.',
        },
        {
            id: 'item-4',
            question: 'How does the custodial wallet work?',
            answer: 'We create a secure Stellar wallet with public/private keypair, encrypt and store the private key in our database, and automatically sign all your KALE transactions (planting, harvesting, staking). You never need to manage keys or sign transactions manually - everything happens automatically in the background.',
        },
        {
            id: 'item-5',
            question: 'Is my custodial wallet secure?',
            answer: 'Yes. Your private keys are encrypted and stored securely in our database. We never share your private keys, and you can withdraw your funds anytime. The custodial wallet is like having a trusted assistant that handles all your KALE transactions while you focus on earning rewards.',
        },
        {
            id: 'item-6',
            question: 'How much XLM should I put in my custodial wallet?',
            answer: '⚠️ IMPORTANT: Only deposit the minimum XLM required for transaction fees (typically 0.5-1 XLM). Do NOT deposit large amounts of XLM into your custodial wallet. XLM is only used for paying Stellar network transaction fees, not for earning rewards. Your KALE tokens are what generate rewards, and they should be kept in your main wallet until you\'re ready to stake them.',
        },
        {
            id: 'item-7',
            question: 'What networks are supported?',
            answer: 'KALE Pool currently supports KALE tokens on the Stellar blockchain using Soroban smart contracts. This means you can mine KALE tokens directly on Stellar\'s fast, low-cost network. We\'re built on Stellar\'s proven infrastructure, so you get reliable performance and minimal transaction fees.',
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
                        type="multiple"
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

                </div>
            </div>
        </section>
    )
}

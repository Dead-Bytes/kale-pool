import Globe3D from "@/components/ui/hero";
import DisplayCards from "@/components/ui/display-cards";
import { ContainerScroll, CardSticky } from "@/components/ui/cards-stack";
import FAQs from "@/components/ui/faq";
import { Search, Leaf, Cog, Coins } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #121212 0%, #171717 100%)" }}>
      <Globe3D />
      
      {/* Trust / Social Proof - now with DisplayCards */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold mb-3 text-white">Trusted Technology</h2>
          <p className="text-white/70">Built on proven infrastructure and best practices</p>
        </div>
        <div className="flex min-h-[400px] w-full items-center justify-center">
          <div className="w-full max-w-3xl">
            <DisplayCards />
          </div>
        </div>
      </section>

      {/* Role value cards - back to simple cards */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold mb-3 text-white">Who Can Use KALE Pool?</h2>
          <p className="text-white/70">Three distinct roles, one powerful platform</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-white/10 bg-white/5">
            <h3 className="text-xl font-semibold mb-2 text-white">Farmers</h3>
            <p className="text-white/70 mb-4">Join a pool and earn steady KALE rewards—no infrastructure needed.</p>
            <a href="/auth/signup" className="text-[#95c697] hover:underline">Join as Farmer →</a>
          </div>
          <div className="p-6 rounded-xl border border-white/10 bg-white/5">
            <h3 className="text-xl font-semibold mb-2 text-white">Pool Operators</h3>
            <p className="text-white/70 mb-4">Turnkey pool orchestration, health checks, automated payouts.</p>
            <a href="/pool-operator" className="text-[#95c697] hover:underline">Run a Pool →</a>
          </div>
          <div className="p-6 rounded-xl border border-white/10 bg-white/5">
            <h3 className="text-xl font-semibold mb-2 text-white">Admins / Enterprises</h3>
            <p className="text-white/70 mb-4">Audit trail, observability, and role-based controls for compliance.</p>
            <a href="/analytics/performance" className="text-[#95c697] hover:underline">Talk to Sales →</a>
          </div>
        </div>
      </section>

      {/* How it works - with cards stack */}
      <section id="how-it-works" className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 md:gap-8 xl:gap-12">
          <div className="left-0 top-0 md:sticky md:h-svh md:py-12">
            <h5 className="text-xs uppercase tracking-wide text-[#95c697]">our process</h5>
            <h2 className="mb-6 mt-4 text-4xl font-bold tracking-tight text-white">
              How KALE Pool{" "}
              <span className="text-[#95c697]">works</span>
            </h2>
            <p className="max-w-prose text-sm text-white/70">
              Our journey begins with real-time block detection. The Pooler monitors the KALE chain,
              coordinates Plant → Work → Harvest across farmers, and distributes rewards fairly.
              Every step is logged and auditable for complete transparency.
            </p>
          </div>
          <ContainerScroll className="min-h-[400vh] space-y-8 py-12">
            {[
              {
                id: "process-1",
                title: "Block Discovery",
                description: "Pooler monitors KALE chain in real-time and detects new blocks as they appear on the network. This is the foundation of our coordination system.",
                icon: <Search className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-2", 
                title: "Plant",
                description: "Stake and initialize across eligible farmers. The system automatically distributes work and ensures proper resource allocation for optimal mining efficiency.",
                icon: <Leaf className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-3",
                title: "Work",
                description: "Validate nonce submissions and coordinate work across all farmers. Our system ensures fair distribution and prevents duplicate work.",
                icon: <Cog className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-4",
                title: "Harvest", 
                description: "Calculate and distribute rewards automatically based on validated work. All transactions are recorded in our event-sourced database for complete transparency.",
                icon: <Coins className="w-6 h-6 text-[#95c697]" />,
              },
            ].map((phase, index) => (
              <CardSticky
                key={phase.id}
                index={index + 2}
                className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-md backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#95c697]/10 border border-[#95c697]/20">
                      {phase.icon}
                    </div>
                    <h2 className="text-2xl font-bold tracking-tighter text-white">
                      {phase.title}
                    </h2>
                  </div>
                  <h3 className="text-2xl font-bold text-[#95c697]">
                    {String(index + 1).padStart(2, "0")}
                  </h3>
                </div>
                <p className="text-white/70 mt-4">{phase.description}</p>
              </CardSticky>
            ))}
          </ContainerScroll>
        </div>
      </section>



      {/* Security & Compliance */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-semibold mb-3 text-white">Security & Compliance</h2>
          <p className="text-white/70 mb-4">Custodial wallet handling, immutable logs, rate limiting, retries, and backups. Built for transparency and audits.</p>
          <a href="/network" className="text-[#95c697] hover:underline">Read Security Overview →</a>
        </div>
      </section>

      {/* FAQ - with accordion */}
      <FAQs />
    </div>
  );
}
import Globe3D from "@/components/ui/hero";
import DisplayCards from "@/components/ui/display-cards";
import { ContainerScroll, CardSticky } from "@/components/ui/cards-stack";
import FAQs from "@/components/ui/faq";
import { UserPlus, Search, Leaf, Zap, Coins } from "lucide-react";

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
          <p className="text-white/70">Two distinct roles, one powerful platform</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
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
        </div>
      </section>

      {/* How it works - with scroll effect and centered title */}
      <section id="how-it-works" className="container mx-auto px-4 py-12 md:py-16">
        {/* Title Section - Centered Above Cards */}
        <div className="text-center mb-12">
          <h5 className="text-xs uppercase tracking-wide text-[#95c697] mb-4">how it works</h5>
          <h2 className="mb-6 text-4xl font-bold tracking-tight text-white">
            How KALE Pool{" "}
            <span className="text-[#95c697]">works</span>
          </h2>
          <p className="max-w-3xl mx-auto text-white/70">
            Earn KALE tokens automatically without expensive hardware or technical knowledge. 
            Simply join a pool, set your preferences, and watch your rewards grow. 
            Our system handles all the complex mining work and auto-harvesting for you.
          </p>
        </div>

        {/* Cards with Scroll Effect - Centered */}
        <div className="max-w-4xl mx-auto">
          <ContainerScroll className="min-h-[120vh] space-y-8 py-12">
            {[
              {
                id: "process-1",
                title: "Join & Setup",
                description: "Sign up with just your email, browse available mining pools, and choose the one that fits your needs. We create a secure custodial wallet for you that signs transactions automatically.",
                icon: <UserPlus className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-2",
                title: "Pool Discovery & Contract",
                description: "Browse pools by success rate, farmer count, and performance. Join a pool by creating a farmer-pooler contract that defines your mining relationship and reward sharing.",
                icon: <Search className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-3", 
                title: "Auto-Plant",
                description: "Your KALE tokens are automatically planted when new blocks are detected. We handle all planting transactions on your behalf using your custodial wallet.",
                icon: <Leaf className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-4",
                title: "Mining Work",
                description: "Poolers do the heavy mining work for you using their powerful computers. No need for expensive hardware or high electricity bills - we coordinate everything automatically.",
                icon: <Zap className="w-6 h-6 text-[#95c697]" />,
              },
              {
                id: "process-5",
                title: "Auto-Harvest", 
                description: "Rewards are automatically harvested and added to your balance based on your settings. We handle everything automatically with complete transparency.",
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



      {/* FAQ - with accordion */}
      <FAQs />
    </div>
  );
}
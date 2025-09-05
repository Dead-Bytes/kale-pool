import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Construction, 
  Clock,
  CheckCircle,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PoolOperatorDev() {

  const timeline = [
    {
      phase: "Phase 1",
      title: "Core Pool Infrastructure",
      description: "Basic pool creation, farmer onboarding, and reward distribution",
      status: "completed",
      date: "Q1 2024"
    },
    {
      phase: "Phase 2", 
      title: "Advanced Analytics",
      description: "Comprehensive monitoring, reporting, and performance optimization tools",
      status: "in_development",
      date: "Q2 2024"
    },
    {
      phase: "Phase 3",
      title: "Enterprise Features",
      description: "Multi-pool management, advanced security, and custom integrations",
      status: "planned",
      date: "Q3 2024"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Construction className="w-12 h-12 text-[#95c697]" />
            <h1 className="text-4xl font-bold text-foreground">Pool Operator Portal</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced pool management tools are currently under development. 
            We're building powerful features to help you run efficient and profitable mining pools.
          </p>
          <Badge variant="outline" className="text-[#95c697] border-[#95c697]/30 bg-[#95c697]/10">
            <Clock className="w-4 h-4 mr-2" />
            Under Development
          </Badge>
        </div>

        {/* Status Alert */}
        <Alert>
          <Construction className="h-4 w-4 text-[#95c697]" />
          <AlertDescription>
            The Pool Operator Portal is currently under active development. 
            We're working hard to bring you powerful pool management tools. 
            Stay tuned for updates!
          </AlertDescription>
        </Alert>


              {/* Development Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#95c697]" />
              Development Timeline
            </CardTitle>
            <CardDescription>
              Our roadmap for building the complete Pool Operator Portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {timeline.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {item.status === 'completed' ? (
                      <div className="w-8 h-8 bg-[#95c697]/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-[#95c697]" />
                      </div>
                    ) : item.status === 'in_development' ? (
                      <div className="w-8 h-8 bg-[#95c697]/20 rounded-full flex items-center justify-center">
                        <Construction className="w-5 h-5 text-[#95c697]" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Clock className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-[#95c697]/30 text-[#95c697]">{item.phase}</Badge>
                      <span className="text-sm text-muted-foreground">{item.date}</span>
                    </div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

              {/* Current Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#95c697]" />
              What's Available Now
            </CardTitle>
            <CardDescription>
              Current features you can use while we build the full portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Pool Discovery</h4>
                <p className="text-sm text-muted-foreground">
                  Browse and join existing mining pools as a farmer
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Farmer Dashboard</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor your farming performance and rewards
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Work History</h4>
                <p className="text-sm text-muted-foreground">
                  Track your work submissions and harvest history
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Pool Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  View pool performance and statistics
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="outline" className="border-[#95c697] text-[#95c697] hover:bg-[#95c697] hover:text-white">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <Button asChild className="bg-[#95c697] hover:bg-[#95c697]/90 text-white">
            <Link to="/pools">
              <ExternalLink className="w-4 h-4 mr-2" />
              Browse Pools
            </Link>
          </Button>
        </div>

        {/* Contact Info */}
        <Card className="bg-[#95c697]/5 border-[#95c697]/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Stay Updated</h3>
              <p className="text-sm text-muted-foreground">
                Want to be notified when the Pool Operator Portal is ready? 
                Contact us for early access and updates.
              </p>
              <Button variant="outline" size="sm" className="border-[#95c697] text-[#95c697] hover:bg-[#95c697] hover:text-white">
                Get Notified
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

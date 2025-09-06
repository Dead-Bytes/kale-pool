/**
 * Placeholder Page Component
 * Used for pages that are not yet implemented
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  suggestions?: string[];
}

export function PlaceholderPage({ 
  title, 
  description, 
  icon: Icon = Construction,
  suggestions = []
}: PlaceholderPageProps) {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex flex-col items-center text-center space-y-6">
        {/* Back Button */}
        <div className="w-full flex justify-start">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Icon className="w-8 h-8 text-muted-foreground" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-lg text-muted-foreground max-w-md">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Info Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="w-5 h-5" />
              Page Under Development
            </CardTitle>
            <CardDescription>
              This page is part of the KALE Pool system and will be implemented soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">What you can do next:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Continue prompting to have this page implemented with full functionality.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/">Go to Landing</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/auth/signup">Start with Registration</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

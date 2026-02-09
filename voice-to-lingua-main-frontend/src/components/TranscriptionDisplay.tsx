import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner'; // Optional: if you have a toast library, otherwise use alert or remove

interface TranscriptionDisplayProps {
  originalText: string;
  hinglishText: string;
  targetText: string;
  targetLanguage: string;
  debugMode?: boolean;
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  originalText,
  hinglishText,
  targetText,
  targetLanguage,
  debugMode = false
}) => {
  if (!originalText) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // If you don't have 'sonner' or 'toast', just console.log or ignore
    console.log(`${label} copied to clipboard`); 
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Original Text */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Original Input
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(originalText, "Original")}>
            <Copy className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-medium text-foreground leading-relaxed">{originalText}</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* 2. Target Translation (Main Result) */}
        {targetText && (
          <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary hover:bg-primary/90">{targetLanguage}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(targetText, targetLanguage)}>
                <Copy className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-foreground leading-relaxed font-hindi">
                {targetText}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 3. Hinglish (Phonetic) */}
        {hinglishText && (
          <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/10 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Badge variant="secondary" className="text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/50">
                Phonetic (Hinglish)
              </Badge>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(hinglishText, "Hinglish")}>
                <Copy className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-mono text-purple-900 dark:text-purple-100 leading-relaxed">
                {hinglishText}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4. Debug Info (Only shows if debugMode is true) */}
      {debugMode && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-dashed text-xs font-mono text-muted-foreground">
          <p className="font-bold mb-2">RAW DEBUG DATA:</p>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify({ originalText, targetLanguage, hasHinglish: !!hinglishText }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
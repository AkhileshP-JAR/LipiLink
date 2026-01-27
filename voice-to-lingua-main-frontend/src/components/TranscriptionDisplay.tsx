import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Original Text</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed">{originalText}</p>
        </CardContent>
      </Card>

      {hinglishText && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Hinglish</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed">{hinglishText}</p>
          </CardContent>
        </Card>
      )}

      {targetText && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">{targetLanguage}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed">{targetText}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
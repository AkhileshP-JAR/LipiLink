import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

// 1. Import the LLM Service
import { generateAudioFriendlyTranslation } from '@/utils/llmService';

// 2. Import your existing TextToSpeech component
import { TextToSpeech } from './TextToSpeech'; 

interface TestResults {
  original: string;
  translatedScript: string;
  phoneticHinglish: string;
  timestamp: Date;
  targetLang: string;
}

export const TranslationTestComponent: React.FC = () => {
  const [testInput, setTestInput] = useState('');
  const [targetLang, setTargetLang] = useState('Hindi');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResults[]>([]);

  const testExamples = [
    'Hello, how are you?',
    'India is my country.',
    'Where is the nearest hospital?',
    'I am hungry.',
    'What is your name?',
  ];

  const runTest = async (text: string) => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Call LLM
      const data = await generateAudioFriendlyTranslation(text, targetLang);
      
      const newResult: TestResults = {
        original: text,
        translatedScript: data.translatedScript,
        phoneticHinglish: data.phoneticHinglish,
        timestamp: new Date(),
        targetLang: targetLang
      };
      
      setResults(prev => [newResult, ...prev.slice(0, 9)]); 
    } catch (error) {
      console.error("Test Failed:", error);
      alert("Translation failed. Check console/API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    for (const example of testExamples) {
      await runTest(example);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          🤖 LLM Translation & TTS Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Input Section */}
        <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-1">
              <Label>Target Language</Label>
              <Select value={targetLang} onValueChange={setTargetLang}>
                <SelectTrigger>
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="Marathi">Marathi</SelectItem>
                  <SelectItem value="Tamil">Tamil</SelectItem>
                  <SelectItem value="Gujarati">Gujarati</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="test-input">Enter Text</Label>
              <Input
                id="test-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type something..."
              />
            </div>

            <div className="flex items-end col-span-1">
              <Button 
                onClick={() => runTest(testInput)}
                disabled={isLoading || !testInput.trim()}
                className="w-full"
              >
                {isLoading ? 'Processing...' : 'Translate'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Try:</Label>
            <div className="flex flex-wrap gap-2">
              {testExamples.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => runTest(example)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Display */}
        {results.length > 0 && (
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Live Results</Label>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {results.map((result, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500 overflow-hidden">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm mb-4">
                      
                      <div className="space-y-1">
                        <Badge variant="outline">Input</Badge>
                        <p className="font-medium text-lg">{result.original}</p>
                      </div>

                      <div className="space-y-1">
                        <Badge variant="default" className="bg-green-600">
                          {result.targetLang} Script
                        </Badge>
                        <p className="font-medium text-xl leading-relaxed">
                          {result.translatedScript}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                          TTS Phonetic
                        </Badge>
                        <p className="font-mono text-lg text-purple-700 font-semibold break-words">
                          {result.phoneticHinglish}
                        </p>
                      </div>
                    </div>

                    {/* 3. Audio Player Integration */}
                    <div className="pt-4 border-t bg-muted/10 -mx-4 -mb-4 p-4">
                      <div className="flex items-center justify-between mb-2">
                         <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audio Preview</Label>
                      </div>
                      <TextToSpeech 
                        hinglishText={result.phoneticHinglish}
                        targetText={result.translatedScript}
                        targetLanguage={result.targetLang}
                      />
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
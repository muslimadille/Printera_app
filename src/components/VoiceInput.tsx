import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseVoiceInput } from '@/lib/userApi';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type VoiceCalcType = 'employee' | 'box' | 'magazine' | 'manual';

interface VoiceInputProps {
  calcType: VoiceCalcType;
  onFieldsParsed: (fields: Record<string, any>) => void;
  paperTypeNames?: string[];
  className?: string;
}

const VoiceInput = ({ calcType, onFieldsParsed, paperTypeNames = [], className }: VoiceInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('متصفحك لا يدعم التعرف على الصوت، جرب Chrome');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('يرجى السماح بالوصول للميكروفون');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        parseTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    toast.info('🎤 تحدث الآن... اذكر البيانات بأي ترتيب');
  }, [calcType, paperTypeNames]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const parseTranscript = async (text: string) => {
    setIsParsing(true);
    try {
      // Goes through the authed API client now: /voice/parse requires a session, where
      // the old Supabase function was callable by anyone with the public anon key.
      // Failures throw (including a 401, which force-logs-out via printCalc:sessionExpired)
      // and land in the catch below, same as the old `error` branch did.
      const data = await parseVoiceInput(text, calcType, paperTypeNames);

      if (data?.fields && Object.keys(data.fields).length > 0) {
        onFieldsParsed(data.fields);
        const count = Object.keys(data.fields).length;
        toast.success(`تم تعبئة ${count} حقل/حقول من الصوت`);
      } else {
        toast.warning('لم يتم التعرف على بيانات واضحة، حاول مرة أخرى');
      }
    } catch (err) {
      console.error('Voice parse error:', err);
      toast.error('حدث خطأ في تحليل الصوت');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 ${className || ''}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size="sm"
              onClick={isListening ? stopListening : startListening}
              disabled={isParsing}
              className="gap-2"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري التحليل...
                </>
              ) : isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  إيقاف
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  إدخال صوتي
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>تحدث بالبيانات بأي ترتيب وسيتم تعبئة الحقول تلقائياً</p>
          </TooltipContent>
        </Tooltip>

        {(isListening || transcript) && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate" dir="rtl">
              {isListening && <span className="inline-block w-2 h-2 bg-destructive rounded-full animate-pulse ml-1" />}
              {transcript || 'في انتظار الصوت...'}
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VoiceInput;

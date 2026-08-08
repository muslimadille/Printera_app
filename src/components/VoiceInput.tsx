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

/** Calculators that have a matching AI field schema on /voice/parse. */
export type VoiceCalcType = 'employee' | 'box' | 'magazine' | 'manual';

interface VoiceInputProps {
  calcType: VoiceCalcType;
  onFieldsParsed: (fields: Record<string, unknown>) => void;
  paperTypeNames?: string[];
  className?: string;
  /** Speech recognition BCP-47 tag. Default ar-SA; Egyptian users can pass ar-EG. */
  lang?: 'ar-SA' | 'ar-EG';
}

function isBraveBrowser(): boolean {
  try {
    const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
    return !!(nav.brave || /Brave/i.test(navigator.userAgent));
  } catch {
    return false;
  }
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return isBraveBrowser()
        ? 'فعّل Google services في إعدادات Brave (أو استخدم Chrome) للسماح بالتعرف على الصوت'
        : 'يرجى السماح بالوصول للميكروفون';
    case 'network':
      return isBraveBrowser()
        ? 'Brave يحظر خدمة التعرف على الصوت افتراضياً — فعّل Google services أو استخدم Chrome'
        : 'تعذر الاتصال بخدمة التعرف على الصوت. تحقق من الإنترنت أو جرّب Chrome';
    case 'audio-capture':
      return 'لا يمكن الوصول للميكروفون. تأكد أنه متصل وغير مستخدم من تطبيق آخر';
    case 'no-speech':
      return 'لم يُلتقط كلام. حاول مرة أخرى وتحدث بوضوح';
    case 'aborted':
      return 'تم إيقاف التسجيل';
    case 'bad-grammar':
    case 'language-not-supported':
      return 'اللغة غير مدعومة في هذا المتصفح. جرّب Chrome';
    default:
      return `خطأ في التعرف على الصوت (${code || 'unknown'})`;
  }
}

const VoiceInput = ({
  calcType,
  onFieldsParsed,
  paperTypeNames = [],
  className,
  lang = 'ar-SA',
}: VoiceInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);

  const resetListening = useCallback(() => {
    setIsListening(false);
    recognitionRef.current = null;
  }, []);

  const parseTranscript = useCallback(async (text: string) => {
    setIsParsing(true);
    try {
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
      const msg = err instanceof Error && err.message
        ? err.message
        : 'حدث خطأ في تحليل الصوت';
      toast.error(msg);
    } finally {
      setIsParsing(false);
    }
  }, [calcType, onFieldsParsed, paperTypeNames]);

  const startListening = useCallback(() => {
    type SpeechRecCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
      onerror: ((ev: { error?: string }) => void) | null;
      onend: (() => void) | null;
    };
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error(
        isBraveBrowser()
          ? 'متصفح Brave لا يدعم التعرف على الصوت هنا — استخدم Chrome أو فعّل Google services'
          : 'متصفحك لا يدعم التعرف على الصوت. استخدم Chrome على سطح المكتب',
      );
      return;
    }

    if (isBraveBrowser()) {
      // Soft warning once per session — Brave often exposes the API then fails with network.
      try {
        if (!sessionStorage.getItem('printCalc_braveVoiceHint')) {
          sessionStorage.setItem('printCalc_braveVoiceHint', '1');
          toast.message('ملاحظة: Brave قد يحظر التعرف على الصوت — إن فشل التسجيل استخدم Chrome');
        }
      } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i];
        if (row.isFinal) {
          finalTranscript += row[0].transcript + ' ';
        } else {
          interim += row[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: { error?: string }) => {
      const code = event?.error || 'unknown';
      console.error('Speech recognition error:', code);
      if (code !== 'aborted') {
        toast.error(speechErrorMessage(code));
      }
      try { recognition.stop(); } catch { /* ignore */ }
      resetListening();
    };

    recognition.onend = () => {
      resetListening();
      if (finalTranscript.trim()) {
        void parseTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setTranscript('');
      toast.info('🎤 تحدث الآن... اذكر البيانات بأي ترتيب');
    } catch (err) {
      console.error('Speech start failed:', err);
      toast.error(isBraveBrowser()
        ? 'تعذر بدء التسجيل في Brave — استخدم Chrome'
        : 'تعذر بدء التسجيل الصوتي');
      resetListening();
    }
  }, [lang, parseTranscript, resetListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    // onend will clear isListening; force-clear as a safety net
    setIsListening(false);
  }, []);

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-2 min-w-0 ${className || ''}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size="sm"
              onClick={isListening ? stopListening : startListening}
              disabled={isParsing}
              className="gap-2 min-h-11 sm:min-h-9"
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
          <TooltipContent side="top" className="max-w-xs">
            <p>تحدث بالبيانات بأي ترتيب وسيتم تعبئة الحقول تلقائياً</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              يعمل بشكل موثوق على Chrome. Brave/Firefox/iOS غالباً محدودون.
            </p>
          </TooltipContent>
        </Tooltip>

        {(isListening || transcript) && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate" dir="rtl">
              {isListening && <span className="inline-block w-2 h-2 bg-destructive rounded-full animate-pulse ms-1" />}
              {transcript || 'في انتظار الصوت...'}
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VoiceInput;

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const VOICES_BY_GENDER = {
  female: ["Ava", "Jenny", "Emma", "Sara", "Aria", "Ashley", "Sonia", "Libby", "Olivia", "Hollie", "Natasha", "Freya", "Clara"],
  male: ["Andrew", "Brian", "Guy", "Jason", "Tony", "Ryan", "Alfie", "Oliver", "William", "Neil", "Liam"],
};

export class BrowserVoiceService {
  isRecognitionActive = false;
  accumulatedTranscript = "";

  private voices: SpeechSynthesisVoice[] = [];
  private recognition: SpeechRecognition | null = null;
  private readonly synthesis = window.speechSynthesis;
  private readonly Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  private voiceRate = 1;
  private voicePitch = 1;
  private updateVoiceDropdownCallback: ((selectedVoice: string) => void) | null = null;

  constructor(
    private readonly sttResultCallback: (text: string) => void,
    private readonly sttErrorCallback: (error: string) => void,
    private readonly sttListeningStateCallback: (isListening: boolean) => void
  ) {
    this.setupSpeechSynthesis();
    if (this.isRecognitionSupported()) this.setupSpeechRecognition();
  }

  isSynthesisSupported() {
    return "speechSynthesis" in window;
  }

  isRecognitionSupported() {
    return Boolean(this.Recognition);
  }

  setVoiceRate(rate: number | string) {
    this.voiceRate = Math.max(0.1, Math.min(2, Number(rate) || 1));
  }

  setVoicePitch(pitch: number | string) {
    this.voicePitch = Math.max(0.5, Math.min(2, Number(pitch) || 1));
  }

  setVoiceDropdownCallback(callback: (selectedVoice: string) => void) {
    this.updateVoiceDropdownCallback = callback;
  }

  async speak(text: string, preferredVoiceKeyword = "AUTO") {
    if (!this.isSynthesisSupported()) return;

    await new Promise<void>((resolve, reject) => {
      if (this.synthesis.speaking || this.synthesis.pending) this.synthesis.cancel();
      if (!this.voices.length) this.populateVoiceList();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this.findVoice(preferredVoiceKeyword);
      if (voice) utterance.voice = voice;
      utterance.pitch = this.voicePitch;
      utterance.rate = this.voiceRate;
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(event.error);
      this.synthesis.speak(utterance);
    });
  }

  stopSpeaking() {
    if (this.isSynthesisSupported() && (this.synthesis.speaking || this.synthesis.pending)) {
      this.synthesis.cancel();
    }
  }

  toggleSTT() {
    if (this.isRecognitionActive) this.stopSTT();
    else this.startSTT();
    return this.isRecognitionActive;
  }

  stopSTT() {
    if (!this.isRecognitionActive) return this.accumulatedTranscript;
    try {
      this.recognition?.stop();
    } catch (error) {
      console.warn("Speech recognition stop failed:", error);
    }
    this.isRecognitionActive = false;
    this.sttListeningStateCallback(false);
    return this.accumulatedTranscript.trim();
  }

  updateUserVoiceSetting(characterProfile: string) {
    const gender = this.detectGenderFromProfile(characterProfile);
    const selectedVoice = this.selectRandomVoiceByGender(gender);
    if (!selectedVoice) return null;
    localStorage.setItem("ttsVoice", selectedVoice);
    this.updateVoiceDropdownCallback?.(selectedVoice);
    return selectedVoice;
  }

  private setupSpeechSynthesis() {
    if (!this.isSynthesisSupported()) return;
    this.populateVoiceList();
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => this.populateVoiceList();
    } else {
      window.setTimeout(() => this.populateVoiceList(), 500);
    }
  }

  private populateVoiceList() {
    if (!this.isSynthesisSupported()) return;
    this.voices = this.synthesis.getVoices();
  }

  private setupSpeechRecognition() {
    if (!this.Recognition) return;
    this.recognition = new this.Recognition();
    this.recognition.continuous = true;
    this.recognition.lang = "en-US";
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.onstart = () => {
      this.isRecognitionActive = true;
      this.sttListeningStateCallback(true);
    };
    this.recognition.onresult = (event) => this.handleRecognitionResult(event);
    this.recognition.onend = () => {
      this.isRecognitionActive = false;
      this.sttListeningStateCallback(false);
    };
    this.recognition.onerror = (event) => {
      this.isRecognitionActive = false;
      this.sttListeningStateCallback(false);
      this.sttErrorCallback(event.error || event.message || "Speech recognition error");
    };
  }

  private startSTT() {
    if (!this.recognition || this.isRecognitionActive) return false;
    const userInput = document.getElementById("user-input") as HTMLTextAreaElement | null;
    if (!this.accumulatedTranscript) this.accumulatedTranscript = userInput?.value ?? "";
    try {
      this.recognition.start();
      this.isRecognitionActive = true;
      this.sttListeningStateCallback(true);
      return true;
    } catch (error) {
      this.sttErrorCallback(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent) {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index++) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) finalTranscript += transcript;
      else interimTranscript += transcript;
    }

    const sessionText = finalTranscript || interimTranscript;
    if (!sessionText.trim()) return;

    if (finalTranscript) {
      const cleanFinal = finalTranscript.trim();
      if (!this.accumulatedTranscript.endsWith(cleanFinal)) {
        this.accumulatedTranscript = this.accumulatedTranscript ? `${this.accumulatedTranscript} ${cleanFinal}` : cleanFinal;
      }
      this.sttResultCallback(this.accumulatedTranscript);
    } else {
      this.sttResultCallback(this.accumulatedTranscript ? `${this.accumulatedTranscript} ${sessionText}` : sessionText);
    }
  }

  private findVoice(preferredVoiceKeyword: string) {
    if (!this.voices.length) return null;
    if (!preferredVoiceKeyword || preferredVoiceKeyword === "AUTO") {
      return this.voices.find((voice) => voice.lang.startsWith("en") && voice.name.toLowerCase().includes("sonia")) ?? this.voices.find((voice) => voice.lang.startsWith("en")) ?? null;
    }

    const keyword = preferredVoiceKeyword.toLowerCase();
    return (
      this.voices.find((voice) => voice.name.toLowerCase().includes(keyword) && voice.name.toLowerCase().includes("microsoft") && voice.lang.startsWith("en")) ??
      this.voices.find((voice) => voice.name.toLowerCase().includes(keyword) && voice.lang.startsWith("en")) ??
      this.voices.find((voice) => voice.lang.startsWith("en")) ??
      null
    );
  }

  private detectGenderFromProfile(characterProfile: string) {
    const profile = characterProfile.toLowerCase();
    if (profile.includes("gender: woman") || profile.includes("**gender:** woman") || profile.includes("gender: female")) return "female";
    if (profile.includes("gender: man") || profile.includes("**gender:** man") || profile.includes("gender: male")) return "male";
    const femaleScore = ["female", "woman", "lady", "she", "her"].reduce((score, word) => score + (profile.match(new RegExp(`\\b${word}\\b`, "g"))?.length ?? 0), 0);
    const maleScore = ["male", "man", "guy", "he", "him"].reduce((score, word) => score + (profile.match(new RegExp(`\\b${word}\\b`, "g"))?.length ?? 0), 0);
    if (femaleScore > maleScore) return "female";
    if (maleScore > femaleScore) return "male";
    return "unknown";
  }

  private selectRandomVoiceByGender(gender: string) {
    const voices = gender === "male" ? VOICES_BY_GENDER.male : VOICES_BY_GENDER.female;
    return voices[Math.floor(Math.random() * voices.length)] ?? null;
  }
}

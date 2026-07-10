import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";

const TOUR_KEY_PREFIX = "lexikon.tour.completed.";

const steps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Welcome to Lexikon 👋",
    content:
      "Your personal English vocabulary companion. Take a quick 60-second tour to see how everything works.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="add-word"]',
    title: "1. Add words you meet",
    content:
      "Every time you discover a new word, save it here with its meaning, pronunciation and the sentence you found it in.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="capture-word"]',
    title: "2. Or capture with your camera",
    content:
      "Snap a photo of any word in a book, article or screen — Lexi will read it and fill the details for you.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dictionary"]',
    title: "3. Your personal dictionary",
    content:
      "Every word you save lives here. Search, filter, revise and revisit your growing collection.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="quiz"]',
    title: "4. Daily quiz to remember",
    content:
      "Once you've saved 10 words, a personalized 7-question quiz unlocks every day to help words stick.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="memory-palace"]',
    title: "5. Build a Memory Palace",
    content:
      "Place words inside rooms of an imaginary palace — a proven technique to boost long-term recall.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="community"]',
    title: "6. Learn with others",
    content:
      "Share progress, climb the leaderboard and see what fellow word-lovers are learning.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="lexi-chat"]',
    title: "Meet Lexi, your AI tutor",
    content:
      "Stuck on a word? Ask Lexi anytime — it explains meanings, gives examples and quizzes you on demand.",
    disableBeacon: true,
    placement: "left",
  },
  {
    target: "body",
    placement: "center",
    title: "You're all set ✨",
    content:
      "Start by adding your first word. Small daily habits build a lifelong vocabulary.",
    disableBeacon: true,
  },
];

const WelcomeTour = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const key = TOUR_KEY_PREFIX + user.id;
    if (localStorage.getItem(key)) return;
    // Only auto-start on home so anchor elements exist
    if (location.pathname !== "/") return;
    const t = setTimeout(() => setRun(true), 600);
    return () => clearTimeout(t);
  }, [user, loading, location.pathname]);

  useEffect(() => {
    const handler = () => {
      if (location.pathname !== "/") {
        navigate("/");
      }
      setTimeout(() => setRun(true), 400);
    };
    window.addEventListener("lexikon:start-tour", handler);
    return () => window.removeEventListener("lexikon:start-tour", handler);
  }, [location.pathname, navigate]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (user) localStorage.setItem(TOUR_KEY_PREFIX + user.id, "1");
    }
  };

  if (!user) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: "Back",
        close: "Close",
        last: "Get started",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        options: {
          primaryColor: "hsl(18 70% 38%)",
          textColor: "hsl(25 30% 15%)",
          backgroundColor: "hsl(38 50% 99%)",
          arrowColor: "hsl(38 50% 99%)",
          overlayColor: "rgba(20, 14, 8, 0.55)",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          fontFamily: "Inter, sans-serif",
        },
        tooltipTitle: {
          fontFamily: "Fraunces, serif",
          fontSize: 18,
        },
        buttonNext: {
          borderRadius: 8,
          padding: "8px 14px",
        },
        buttonBack: {
          color: "hsl(25 15% 45%)",
        },
      }}
    />
  );
};

export default WelcomeTour;

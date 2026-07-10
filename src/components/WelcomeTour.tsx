import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Joyride, EVENTS, type EventData, type Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";

const TOUR_KEY_PREFIX = "lexikon.tour.completed.";

const steps: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Welcome to Lexikon 👋",
    content:
      "Your personal English vocabulary companion. Take a quick 30-second tour to see how it works.",
  },
  {
    target: '[data-tour="add-word"]',
    title: "1. Add words you meet",
    content:
      "Every time you discover a new word, save it here with its meaning, pronunciation and the sentence you found it in. You can also snap a photo to auto-capture words from books or screens.",
  },
  {
    target: '[data-tour="dictionary"]',
    title: "2. Your personal dictionary",
    content:
      "Every word you save lives here. Search, filter and revisit your growing collection anytime.",
  },
  {
    target: '[data-tour="quiz"]',
    title: "3. Daily quiz to remember",
    content:
      "Once you've saved 10 words, a personalized 7-question quiz unlocks daily to help words stick. You'll also find a Memory Palace and Community in the sidebar.",
    placement: "top",
  },
  {
    target: '[data-tour="lexi-chat"]',
    title: "4. Meet Lexi, your AI tutor",
    content:
      "Stuck on a word? Ask Lexi anytime — it explains meanings, gives examples and quizzes you on demand.",
    placement: "left",
  },
  {
    target: "body",
    placement: "center",
    title: "You're all set ✨",
    content:
      "Start by adding your first word. Small daily habits build a lifelong vocabulary. You can replay this tour anytime from your Profile.",
  },
];

const WelcomeTour = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (localStorage.getItem(TOUR_KEY_PREFIX + user.id)) return;
    if (location.pathname !== "/") return;
    const t = setTimeout(() => setRun(true), 700);
    return () => clearTimeout(t);
  }, [user, loading, location.pathname]);

  useEffect(() => {
    const handler = () => {
      if (location.pathname !== "/") navigate("/");
      setTimeout(() => setRun(true), 400);
    };
    window.addEventListener("lexikon:start-tour", handler);
    return () => window.removeEventListener("lexikon:start-tour", handler);
  }, [location.pathname, navigate]);

  const onEvent = (data: EventData) => {
    if (data.type === EVENTS.TOUR_END) {
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
      scrollToFirstStep
      onEvent={onEvent}
      options={{
        showProgress: true,
        skipBeacon: true,
        buttons: ["back", "skip", "primary"],
        overlayClickAction: false,
        primaryColor: "hsl(18 70% 38%)",
        textColor: "hsl(25 30% 15%)",
        backgroundColor: "hsl(38 50% 99%)",
        arrowColor: "hsl(38 50% 99%)",
        overlayColor: "rgba(20, 14, 8, 0.55)",
        zIndex: 10000,
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Get started",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        tooltip: { borderRadius: 12, fontFamily: "Inter, sans-serif" },
        tooltipTitle: { fontFamily: "Fraunces, serif", fontSize: 18 },
        buttonPrimary: { borderRadius: 8, padding: "8px 14px" },
      }}
    />
  );
};

export default WelcomeTour;

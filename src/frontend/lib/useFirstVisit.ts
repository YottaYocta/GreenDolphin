import { useCallback, useState } from "react";

export const FIRST_VISIT_KEY = "tutorial_shown";

export function useFirstVisit() {
  const [isFirstVisit, setIsFirstVisit] = useState(
    localStorage.getItem(FIRST_VISIT_KEY) !== "true",
  );

  const markVisited = useCallback(() => {
    localStorage.setItem(FIRST_VISIT_KEY, "true");
    setIsFirstVisit(false);
  }, []);

  const resetVisit = useCallback(() => {
    localStorage.removeItem(FIRST_VISIT_KEY);
    setIsFirstVisit(true);
  }, []);

  return { isFirstVisit, markVisited, resetVisit };
}

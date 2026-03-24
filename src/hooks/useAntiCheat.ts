import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Anti-cheat hook: enters fullscreen on mount, auto-submits quiz
 * if user switches tabs or exits fullscreen.
 */
export function useAntiCheat(
  onAutoSubmit: () => void,
  enabled: boolean
) {
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    submittedRef.current = false;

    const autoSubmit = (reason: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      toast.error(`Test auto-submitted: ${reason}`);
      onAutoSubmit();
    };

    // Request fullscreen
    const requestFS = async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        console.warn("Fullscreen request denied");
      }
    };
    requestFS();

    // Detect tab switch
    const handleVisibility = () => {
      if (document.hidden) {
        autoSubmit("You switched tabs");
      }
    };

    // Detect fullscreen exit (only if fullscreen was successfully entered)
    const handleFSChange = () => {
      if (!document.fullscreenElement && !submittedRef.current) {
        // Small delay to avoid false positives during fullscreen transition
        setTimeout(() => {
          if (!document.fullscreenElement && !submittedRef.current) {
            autoSubmit("You exited fullscreen");
          }
        }, 300);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFSChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFSChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [enabled, onAutoSubmit]);
}

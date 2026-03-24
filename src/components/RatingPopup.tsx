import { useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface RatingPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RatingPopup = ({ open, onOpenChange }: RatingPopupProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("user_ratings")
        .upsert(
          { user_id: user.id, rating, feedback: feedback.trim() || null },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Thank you for your feedback!");
      onOpenChange(false);
    } catch {
      toast.error("Failed to submit rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-display">
            How was your experience?
          </DialogTitle>
          <DialogDescription className="text-center">
            Rate QuizAI to help us improve
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 transition-colors ${
                  star <= (hoveredStar || rating)
                    ? "text-warning fill-warning"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Any feedback? (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          className="resize-none"
        />

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Skip
          </Button>
          <Button
            className="flex-1 gradient-bg text-primary-foreground"
            disabled={rating === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingPopup;

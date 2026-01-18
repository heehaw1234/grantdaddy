import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, X } from 'lucide-react';

interface RegeneratePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRegenerate: (instructions: string) => void;
    previousInstructions: string;
}

export function RegeneratePromptDialog({
    open,
    onOpenChange,
    onRegenerate,
    previousInstructions
}: RegeneratePromptDialogProps) {
    const [instructions, setInstructions] = useState(previousInstructions);

    const handleRegenerate = () => {
        onRegenerate(instructions);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="text-primary" size={20} />
                        Customize Regeneration
                    </DialogTitle>
                    <DialogDescription>
                        Add specific instructions for how you'd like the writeup to be regenerated
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <Textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="E.g., 'Focus more on our youth programs and local community impact'"
                        rows={4}
                        className="resize-none"
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        Leave empty to regenerate with the same settings as before
                    </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        <X size={16} className="mr-2" />
                        Cancel
                    </Button>
                    <Button onClick={handleRegenerate}>
                        <Sparkles size={16} className="mr-2" />
                        Regenerate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

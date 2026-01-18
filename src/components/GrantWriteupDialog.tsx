import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Download, RefreshCw, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import {
    generateGrantWriteup,
    downloadWriteupAsMarkdown,
    WriteupContext
} from '@/services/grantWriteupService';
import { useToast } from '@/hooks/use-toast';
import { RegeneratePromptDialog } from './RegeneratePromptDialog';

interface GrantWriteupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    context: WriteupContext;
}

export function GrantWriteupDialog({ open, onOpenChange, context }: GrantWriteupDialogProps) {
    const { toast } = useToast();
    const [writeup, setWriteup] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customInstructions, setCustomInstructions] = useState<string>('');
    const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

    const handleGenerate = async (additionalInstructions?: string) => {
        setIsGenerating(true);
        setError(null);

        // Save instructions for next time
        if (additionalInstructions !== undefined) {
            setCustomInstructions(additionalInstructions);
        }

        try {
            const contextWithInstructions = {
                ...context,
                customInstructions: additionalInstructions || customInstructions
            };
            const result = await generateGrantWriteup(contextWithInstructions);
            setWriteup(result);
            toast({
                title: 'Writeup generated!',
                description: 'Analysis of your fit for this grant has been created.',
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate writeup';
            setError(errorMessage);
            toast({
                title: 'Generation failed',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (writeup) {
            downloadWriteupAsMarkdown(writeup, context.grant.title || 'grant_fit_analysis');
            toast({
                title: 'Downloaded!',
                description: 'Writeup saved as markdown file.',
            });
        }
    };

    const handleRegenerateClick = () => {
        setShowRegenerateDialog(true);
    };

    const handleRegenerateWithInstructions = (instructions: string) => {
        handleGenerate(instructions);
    };

    // Auto-generate on open
    useEffect(() => {
        if (open && !writeup && !isGenerating) {
            handleGenerate();
        }
    }, [open]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setWriteup('');
            setError(null);
            // Keep customInstructions for next time
        }
    }, [open]);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="text-primary" size={20} />
                            Why You're a Good Fit
                        </DialogTitle>
                        <DialogDescription>
                            AI-generated analysis for <span className="font-semibold">{context.grant.title}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto px-6">
                        {isGenerating ? (
                            <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
                                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                                <div className="text-center space-y-2">
                                    <p className="text-lg font-medium">Generating your writeup...</p>
                                    <p className="text-sm text-muted-foreground">
                                        Analyzing why you're a good fit for this grant
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Sparkles size={14} className="text-primary" />
                                    <span>This may take 10-20 seconds</span>
                                </div>
                            </div>
                        ) : error ? (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {error}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleGenerate()}
                                        className="mt-2"
                                    >
                                        Try Again
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : writeup ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                    {writeup}
                                </pre>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full py-12">
                                <p className="text-muted-foreground">Click Generate to create your writeup</p>
                            </div>
                        )}
                    </div>

                    {/* Fixed footer */}
                    <DialogFooter className="px-6 pb-6 pt-4 border-t gap-2">
                        {writeup && !isGenerating && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleRegenerateClick}
                                >
                                    <RefreshCw size={16} className="mr-2" />
                                    Regenerate
                                </Button>
                                <Button onClick={handleDownload}>
                                    <Download size={16} className="mr-2" />
                                    Export as Text File
                                </Button>
                            </>
                        )}
                        {!writeup && !isGenerating && !error && (
                            <Button onClick={() => handleGenerate()}>
                                <Sparkles size={16} className="mr-2" />
                                Generate Writeup
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Regenerate Prompt Dialog */}
            <RegeneratePromptDialog
                open={showRegenerateDialog}
                onOpenChange={setShowRegenerateDialog}
                onRegenerate={handleRegenerateWithInstructions}
                previousInstructions={customInstructions}
            />
        </>
    );
}

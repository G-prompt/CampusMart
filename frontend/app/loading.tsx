export default function LoadingPage() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <div className="flex items-center gap-2" role="status" aria-label="Loading">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-900 [animation-delay:0ms]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-700 [animation-delay:120ms]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-accent-500 [animation-delay:240ms]" />
            </div>
        </div>
    );
}

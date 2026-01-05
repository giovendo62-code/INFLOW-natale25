import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[MOBILE-BLACKSCREEN] React component error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[100] bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                    <div className="max-w-md w-full bg-gray-800 border border-red-500/50 rounded-2xl p-8 shadow-2xl">
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-red-500/20 rounded-full text-red-500">
                                <AlertTriangle size={48} />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold mb-2">Si è verificato un errore</h1>
                        <p className="text-gray-400 mb-6">L'applicazione ha riscontrato un problema imprevisto.</p>

                        <div className="bg-black/50 p-4 rounded-lg text-left overflow-auto max-h-48 mb-6 border border-white/10">
                            <p className="text-red-400 font-mono text-sm break-words mb-2">
                                {this.state.error?.toString()}
                            </p>
                            {this.state.errorInfo && (
                                <pre className="text-xs text-gray-500 whitespace-pre-wrap">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-transform active:scale-95"
                            >
                                <RefreshCw size={20} />
                                Ricarica Applicazione
                            </button>

                            <div className="text-xs text-gray-500 pt-4 border-t border-white/10">
                                <p>Route: {window.location.pathname}</p>
                                <p className="truncate">UA: {navigator.userAgent}</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

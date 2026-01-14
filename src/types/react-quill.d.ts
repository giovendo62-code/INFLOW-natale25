declare module 'react-quill-new' {
    import React from 'react';
    export interface ReactQuillProps {
        theme?: string;
        modules?: any;
        formats?: string[];
        value?: string;
        defaultValue?: string;
        placeholder?: string;
        readOnly?: boolean;
        onChange?: (content: string, delta: any, source: string, editor: any) => void;
        onChangeSelection?: (selection: any, source: string, editor: any) => void;
        className?: string;
        children?: React.ReactNode;
        preserveWhitespace?: boolean;
    }
    const ReactQuill: React.ComponentClass<ReactQuillProps>;
    export default ReactQuill;
}

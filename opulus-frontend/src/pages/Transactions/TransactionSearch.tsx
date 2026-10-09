import { Search, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Input } from '@/components/ui';

interface TransactionSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** A search field that updates the URL once typing pauses. */
export const TransactionSearch: React.FC<TransactionSearchProps> = ({
  value,
  onChange,
}) => {
  const [text, setText] = useState(value);

  // Follow the URL when it changes elsewhere (back button, clearing the search).
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search by merchant or name"
        aria-label="Search transactions"
        className="px-9"
      />
      {text && (
        <button
          type="button"
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1"
          onClick={() => {
            setText('');
            onChange('');
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
};

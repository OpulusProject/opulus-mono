import { ChevronDown, type LucideIcon } from 'lucide-react';
import React from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export interface MenuOption {
  value: string;
  label: string;
  /** An icon shown before the label. */
  icon?: LucideIcon;
  /**
   * A logo shown before the label. `null` means there is none, so the label's
   * first letter is shown instead; leave it undefined for no logo at all.
   */
  logoUrl?: string | null;
}

interface MultiSelectMenuProps {
  /** The menu's name: "Category". */
  label: string;
  options: MenuOption[];
  selected: string[];
  /**
   * Called with a function that turns the current picks into the new ones, so
   * quick changes build on each other.
   */
  onChange: (change: (selected: string[]) => string[]) => void;
}

/**
 * A borderless button for a list's header that opens a list of checkboxes to
 * pick several from. When something is picked the button shows the first pick
 * in bold (and a count of the rest); on a narrow screen it shows a dot instead.
 */
export const MultiSelectMenu: React.FC<MultiSelectMenuProps> = ({
  label,
  options,
  selected,
  onChange,
}) => {
  const first = options.find((option) => option.value === selected[0]);
  const summary = first
    ? `${first.label}${selected.length > 1 ? ` +${selected.length - 1}` : ''}`
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'text-muted-foreground px-1.5 @4xl:px-3',
            summary && 'text-foreground'
          )}
        >
          <span className={cn(summary && 'font-semibold')}>
            {label}
            {summary && <span className="hidden @4xl:inline">: {summary}</span>}
          </span>
          {summary && (
            <span
              aria-hidden
              className="bg-primary size-1.5 shrink-0 rounded-full @4xl:hidden"
            />
          )}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 min-w-56 overflow-y-auto"
      >
        <DropdownMenuLabel>Filter by {label.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            // Keep the list open so several can be picked.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange((current) =>
                checked
                  ? [...current, option.value]
                  : current.filter((value) => value !== option.value)
              )
            }
          >
            <OptionIcon option={option} />
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {options.length === 0 && (
          <div className="text-muted-foreground px-2 py-1.5 text-sm">
            Nothing to choose from
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** The option's icon or logo, if it has one. */
const OptionIcon: React.FC<{ option: MenuOption }> = ({ option }) => {
  if (option.icon) {
    const Icon = option.icon;
    return <Icon className="text-muted-foreground size-4 shrink-0" />;
  }
  if (option.logoUrl !== undefined) {
    return (
      <Avatar className="size-4 shrink-0 rounded-[4px]">
        <AvatarImage src={option.logoUrl ?? undefined} alt="" />
        <AvatarFallback className="rounded-[4px] text-[10px]">
          {option.label.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    );
  }
  return null;
};

import type { ItemDTO } from '@opulus/core/dto';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui';
import type { StatusVariant } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Notice } from '@/types/notice';
import { getInstitutionLogo } from '@/utils/institution';
import { getItemStatus } from '@/utils/itemStatus';

interface ListRowProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'className' | 'title'> {
  /** Show this institution's logo (or its initial) before the text. */
  institution?: Pick<
    ItemDTO,
    'errorCode' | 'institutionLogo' | 'institutionName'
  >;
  /**
   * Show this image before the text, e.g. a merchant's logo. Pair it with
   * `icon`, which is shown when there is no image or it fails to load.
   */
  logoUrl?: string | null;
  /** Show this icon before the text when there is no `logoUrl`. */
  icon?: LucideIcon;
  /** Overlay a dot on the logo showing the connection's health. */
  showInstitutionStatus?: boolean;
  title: string;
  /** Muted line under the title. */
  subtitle?: string;
  /** Short colored statuses shown after the subtitle, e.g. "Overdue". */
  notices?: Notice[];
  /** Right-aligned line, e.g. a balance or a total. */
  trailingTitle?: string;
  /** Muted line under `trailingTitle`, e.g. an available balance. */
  trailingSubtitle?: string;
  /**
   * Buttons or a menu at the far right. Pass them as siblings or a fragment;
   * ListRow spaces them in a row.
   */
  action?: React.ReactNode;
  /**
   * Show an expand chevron: pointing down when true, right when false. Leave
   * undefined for rows that do not expand.
   */
  expanded?: boolean;
  /**
   * Highlight the row on hover. Defaults to true for rows with an `onClick`,
   * which also render as a button.
   */
  interactive?: boolean;
}

const NOTICE_TONE: Record<Notice['tone'], string> = {
  danger: 'font-medium text-destructive',
  muted: 'text-muted-foreground',
  warning: 'font-medium text-amber-600 dark:text-amber-400',
};

/**
 * Standard list row: an optional institution logo, a title over a subtitle,
 * and on the right a value, an action, or an expand chevron. Spacing, text
 * sizes, and status colors live here so every list looks the same.
 *
 * Rows with an `onClick` render as a button; the rest as a div.
 *
 * @example
 * <ListRow
 *   institution={item}
 *   title={item.institutionName}
 *   subtitle="3 accounts"
 *   notices={[{ text: 'Login required', tone: 'danger' }]}
 *   trailingTitle="$1,200.00"
 *   trailingSubtitle="$1,150.00 available"
 * />
 */
export const ListRow = React.forwardRef<HTMLElement, ListRowProps>(
  (
    {
      institution,
      logoUrl,
      icon,
      showInstitutionStatus = false,
      title,
      subtitle,
      notices,
      trailingTitle,
      trailingSubtitle,
      action,
      expanded,
      interactive,
      ...props
    },
    ref
  ) => {
    const clickable = !!props.onClick;
    const Comp = (clickable ? 'button' : 'div') as React.ElementType<
      React.HTMLAttributes<HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
        type?: 'button';
      }
    >;

    return (
      <Comp
        ref={ref}
        {...(clickable && { type: 'button' })}
        {...(expanded !== undefined && { 'aria-expanded': expanded })}
        {...props}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left',
          (interactive ?? clickable) && 'hover:bg-muted/40 transition-colors'
        )}
      >
        {institution && (
          <InstitutionAvatar
            institution={institution}
            showStatus={showInstitutionStatus}
          />
        )}

        {(logoUrl || icon) && (
          <LogoOrIcon logoUrl={logoUrl} icon={icon} alt={title} />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={title}>
            {title}
          </div>
          {(subtitle || notices?.length) && (
            <div className="text-muted-foreground truncate text-xs">
              {subtitle}
              {notices?.map((notice) => (
                <span
                  key={notice.text}
                  className={cn('ml-2', NOTICE_TONE[notice.tone])}
                >
                  {notice.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {(trailingTitle || trailingSubtitle) && (
          <div className="shrink-0 text-right">
            <div className="text-sm font-medium tabular-nums">
              {trailingTitle}
            </div>
            {trailingSubtitle && (
              <div className="text-muted-foreground text-xs tabular-nums">
                {trailingSubtitle}
              </div>
            )}
          </div>
        )}

        {action && (
          <div className="flex shrink-0 items-center gap-3">{action}</div>
        )}

        {expanded !== undefined && (
          <ChevronRight
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
              expanded && 'rotate-90'
            )}
          />
        )}
      </Comp>
    );
  }
);
ListRow.displayName = 'ListRow';

const STATUS_DOT_BG: Record<StatusVariant, string> = {
  online: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
  maintenance: 'bg-blue-500',
  unknown: 'bg-muted-foreground',
};

interface InstitutionAvatarProps {
  institution: NonNullable<ListRowProps['institution']>;
  showStatus: boolean;
}

/** An institution's logo, or its initial when Plaid has no logo. */
const InstitutionAvatar: React.FC<InstitutionAvatarProps> = ({
  institution,
  showStatus,
}) => {
  const name = institution.institutionName || 'Institution';
  const status = showStatus ? getItemStatus(institution.errorCode) : null;

  return (
    <Avatar className="size-9 shrink-0 rounded-[10px]">
      <AvatarImage
        src={getInstitutionLogo(institution) ?? undefined}
        alt={name}
      />
      <AvatarFallback className="rounded-[10px] text-sm">
        {institution.institutionName?.charAt(0).toUpperCase() || '?'}
      </AvatarFallback>
      {status && (
        <AvatarBadge
          aria-label={status.label}
          title={status.label}
          className={STATUS_DOT_BG[status.variant]}
        />
      )}
    </Avatar>
  );
};

interface LogoOrIconProps {
  logoUrl?: string | null;
  icon?: LucideIcon;
  alt: string;
}

/** An image such as a merchant logo, or an icon when there is none. */
const LogoOrIcon: React.FC<LogoOrIconProps> = ({
  logoUrl,
  icon: Icon,
  alt,
}) => (
  <Avatar className="size-9 shrink-0 rounded-[10px]">
    <AvatarImage src={logoUrl ?? undefined} alt={alt} />
    <AvatarFallback className="rounded-[10px]">
      {Icon && <Icon className="text-muted-foreground size-4" />}
    </AvatarFallback>
  </Avatar>
);

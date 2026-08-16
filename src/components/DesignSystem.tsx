import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface SurfaceProps {
  children: ReactNode;
  className?: string;
}

export function Surface({ children, className }: SurfaceProps) {
  return <section className={clsx('ui-surface', className)}>{children}</section>;
}

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionTitle({ eyebrow, title, description, action }: SectionTitleProps) {
  return (
    <div className="ui-section-title">
      <div>
        {eyebrow && <div className="ui-eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface PlayerAvatarProps {
  imageUrl?: string | null;
  gamerTag: string;
  size?: 'small' | 'large';
}

export function PlayerAvatar({ imageUrl, gamerTag, size = 'small' }: PlayerAvatarProps) {
  const initials = gamerTag.trim().slice(0, 2).toUpperCase() || '?';

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={gamerTag}
      className={clsx('ui-avatar', size === 'large' && 'ui-avatar--large')}
    />
  ) : (
    <div
      aria-label={gamerTag}
      className={clsx('ui-avatar ui-avatar--fallback', size === 'large' && 'ui-avatar--large')}
    >
      {initials}
    </div>
  );
}

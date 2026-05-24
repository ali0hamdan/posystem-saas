import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

type PlaceholderPageProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function PlaceholderPage({ title, description, children }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardContent className="p-8 md:p-10">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted md:text-base">
            {description ?? 'This section is available from the menu. Extended functionality can be added when needed.'}
          </p>
          {children ? <div className="mt-8">{children}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

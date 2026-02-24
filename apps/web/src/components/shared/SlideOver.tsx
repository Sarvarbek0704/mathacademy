import { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface SlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  full: 'sm:max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-20rem)]',
};

export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: SlideOverProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={`overflow-y-auto ${sizeMap[size]}`}>
        <SheetHeader className="mb-6 border-b pb-4">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription className="text-sm">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 pb-10">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

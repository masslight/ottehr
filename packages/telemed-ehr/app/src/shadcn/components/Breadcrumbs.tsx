import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

export function BreadcrumbPatient({ currentPage, loading }: { currentPage: string; loading: boolean }) {
  return (
    <Breadcrumb className="px-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/patients">Patients</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {currentPage === 'undefined, undefined' ? (
            <Skeleton className="h-4 w-24 bg-gray-200" />
          ) : (
            <BreadcrumbPage>{currentPage}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

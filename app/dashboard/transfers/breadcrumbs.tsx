"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbsProps {
  currentPage?: string;
}

export function Breadcrumbs({ currentPage }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      <Link href="/dashboard" className="hover:text-gray-900">
        Dashboard
      </Link>
      <ChevronRight className="h-4 w-4" />
      <Link href="/dashboard/transfers" className="hover:text-gray-900">
        Transfers
      </Link>
      {currentPage && (
        <>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">{currentPage}</span>
        </>
      )}
    </nav>
  );
}

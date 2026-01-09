'use client';

import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@gems';
import type { Transaction } from '@opulus/core';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import * as React from 'react';

import { useTransactions } from '@/hooks/transactions/useTransactions';

export function DataTable() {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const { data: transactionsData, isLoading } = useTransactions({
    page: pageIndex + 1, // API uses 1-based pagination
    limit: pageSize,
  });

  const transactions = transactionsData?.transactions || [];
  const pagination = transactionsData?.pagination;

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true, // Use server-side pagination
    pageCount: pagination?.totalPages ?? 0,
  });

  const handlePageChange = (newPageIndex: number) => {
    setPageIndex(newPageIndex);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0); // Reset to first page when changing page size
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-4 py-4">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          {pagination
            ? `Showing ${transactions.length} of ${pagination.total} transaction(s).`
            : 'Loading...'}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                handlePageSizeChange(Number(value));
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            {pagination
              ? `Page ${pagination.page} of ${pagination.totalPages}`
              : 'Loading...'}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => handlePageChange(0)}
              disabled={pageIndex === 0}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={!pagination || pageIndex >= pagination.totalPages - 1}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() =>
                handlePageChange((pagination?.totalPages ?? 1) - 1)
              }
              disabled={!pagination || pageIndex >= pagination.totalPages - 1}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="text-left font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amount = Number(row.original.amount);
      const currencyCode = row.original.isoCurrencyCode;
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
        minimumFractionDigits: 2,
      }).format(amount);

      return (
        <div
          className={`text-right font-medium ${
            amount < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400'
          }`}
        >
          {formattedAmount}
        </div>
      );
    },
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const categories = row.original.category || [];
      if (categories.length === 0) {
        return <Badge variant="outline">Uncategorized</Badge>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {categories.map((cat, index) => (
            <Badge
              key={index}
              variant="outline"
              className="text-muted-foreground px-1.5"
            >
              {cat}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'account',
    header: 'Account',
    cell: ({ row }) => {
      const bankAccount = row.original.bankAccount;
      const accountName = bankAccount.name;
      const accountMask = bankAccount.mask;
      const displayName = accountMask
        ? `${accountName} ••••${accountMask}`
        : accountName;
      return <div>{displayName}</div>;
    },
  },
  {
    accessorKey: 'date',
    header: 'Date & Time',
    cell: ({ row }) => {
      const date = new Date(row.original.date);
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
      return <div>{formattedDate}</div>;
    },
  },
];

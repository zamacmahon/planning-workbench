import { Dispatch } from 'react';
import { Action } from './reducer';

export type TableAPI<T> = {
  tableData: TableDataResponse<T>;
  sorting: Sorting;
  selectedRow: T | null;
  totalPagesCount: number;
  pageIndex: number;
  isLoading: boolean;
  pageSize: number;
  filter: string;
  refreshCount: number;
};
export type BaseCtx<T> = {
  state: TableAPI<T>;
  methods: Record<string, Function> & {
    dispatch: Dispatch<Action<T>>;
  };
};

export type BaseTableProps<T> = {
  fetcher: () => Promise<TableDataResponse<T>>;
  api: BaseCtx<T>;
};

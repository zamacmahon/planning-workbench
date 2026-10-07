import { BaseCtx, TableAPI } from '@/lib/Components/BaseTable';
import { createContext } from 'react';
import { User } from './types';

export type UserTableAPI = TableAPI<User>;
export type UserCtx = BaseCtx<User>;

const initialState: UserTableAPI = {
  tableData: { count: 0, query: [] },
  sorting: { id: 'email', desc: false },
  totalPagesCount: 1,
  pageIndex: 1,
  selectedRow: null,
  isLoading: true,
  filter: '',
  refreshCount: 0,
  pageSize: 15,
};

export const userTableCtxInitial = {
  state: initialState,
  methods: {},
} as UserCtx;

export const UserTableContext = createContext(userTableCtxInitial);

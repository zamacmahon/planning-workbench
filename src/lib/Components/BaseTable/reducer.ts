import type { TableAPI } from './types';

export enum TableStateActions {
  SET_SORTING = 'SET_SORTING',
  REFRESH = 'REFRESH',
  SET_PAGE_INDEX = 'SET_PAGE_INDEX',
  SET_IS_LOADING = 'SET_IS_LOADING',
  UPDATE_AFTER_FETCH = 'UPDATE_AFTER_FETCH',
  SET_PAGE_SIZE = 'SET_PAGE_SIZE',
  SET_SELECTED_ROW = 'SET_SELECTED_ROW',
}

export type Action<T> =
  | { type: TableStateActions.SET_SORTING; payload: Sorting }
  | { type: TableStateActions.SET_PAGE_INDEX; payload: number }
  | { type: TableStateActions.REFRESH }
  | { type: TableStateActions.SET_SELECTED_ROW; payload: T | null }
  | { type: TableStateActions.SET_IS_LOADING; payload: boolean }
  | {
      type: TableStateActions.UPDATE_AFTER_FETCH;
      payload: TableDataResponse<T>;
    }
  | { type: TableStateActions.SET_PAGE_SIZE; payload: number };

export const baseTableReducer = <T>(
  state: TableAPI<T>,
  action: Action<T>
): TableAPI<T> => {
  switch (action.type) {
    case TableStateActions.SET_SORTING:
      return { ...state, sorting: action.payload };
    case TableStateActions.SET_PAGE_INDEX:
      return { ...state, pageIndex: action.payload };
    case TableStateActions.SET_IS_LOADING:
      return { ...state, isLoading: action.payload };
    case TableStateActions.REFRESH:
      return { ...state, refreshCount: state.refreshCount + 1 };
    case TableStateActions.SET_PAGE_SIZE:
      return { ...state, pageSize: action.payload };
    case TableStateActions.SET_SELECTED_ROW:
      return { ...state, selectedRow: action.payload };
    case TableStateActions.UPDATE_AFTER_FETCH:
      return {
        ...state,
        tableData: action.payload,
        totalPagesCount: Math.ceil(action.payload.count / state.pageSize),
        isLoading: false,
      };
    default:
      return state;
  }
};

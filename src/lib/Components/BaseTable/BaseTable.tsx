import { TableStateActions } from './reducer';
import { BaseTableProps } from './types';
import { useEffect } from 'react';

export const BaseTable = <T extends { id: string }>({
  api,
  fetcher,
}: BaseTableProps<T>) => {
  const { state, methods } = api;
  const {
    sorting,
    refreshCount,
    pageIndex,
    isLoading,
    tableData,
    pageSize,
    selectedRow,
  } = state;
  const { dispatch } = methods;

  useEffect(() => {
    fetchTableData();
  }, [refreshCount]);

  const fetchTableData = async () => {
    dispatch({ type: TableStateActions.SET_IS_LOADING, payload: true });
    const result = await fetcher();
    dispatch({
      type: TableStateActions.UPDATE_AFTER_FETCH,
      payload: result,
    });
  };

  useEffect(() => {
    fetchTableData();
  }, [sorting, pageIndex, pageSize]);

  const onRowClick = (row: T) => {
    dispatch({ type: TableStateActions.SET_SELECTED_ROW, payload: row });
  };

  return (
    <div>
      {isLoading && <h1>LOADING...</h1>}
      {!isLoading && (
        <div className="w-full bg-blue-100 divide-y-2 divide-black">
          {tableData.query.map((row) => (
            <div
              onClick={() => {
                onRowClick(row);
              }}
              className="text-xs cursor-pointer p-2 hover:bg-blue-200"
            >
              row id: {row.id}
            </div>
          ))}
        </div>
      )}
      {selectedRow ? (
        <p>selected: {selectedRow.id}</p>
      ) : (
        <p>click to select row</p>
      )}
    </div>
  );
};

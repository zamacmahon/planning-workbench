declare type TableDataResponse<T> = {
  count: number;
  query: Array<T>;
};

declare type Sorting = { id: string; desc: boolean };

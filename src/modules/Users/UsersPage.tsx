import { baseTableReducer, TableStateActions } from '@/lib/Components/BaseTable';
import { UserTableContext, userTableCtxInitial } from './UserTableContext';
import { UsersTable } from './Components/UsersTable';
import { FC, useReducer } from 'react';
import { User } from './types';

export const UsersPage: FC = () => {
  const [state, dispatch] = useReducer(baseTableReducer<User>, userTableCtxInitial.state);

  const methods = {
    dispatch, // Пока что тут только диспатчер для изменения стэйта таблицы. Но в будущем может быть какой-нибудь функционал который что-то триггерт во внешнем мире относительно таблицы
  };

  const onSelectUser = () => {
    if (state.selectedRow) {
      dispatch({ type: TableStateActions.SET_SELECTED_ROW, payload: null });
    } else {
      dispatch({ type: TableStateActions.SET_SELECTED_ROW, payload: state.tableData.query[0] });
    }
  }
  
  const onRefreshClick = () => {
    dispatch({ type: TableStateActions.REFRESH });
  }

  return (
    <div>
      <div className="flex">
        <h1>Users page</h1>
        <button onClick={onSelectUser}>
          {state.selectedRow ? 'unselect' : 'set first as selected'}
        </button>
        <button onClick={onRefreshClick}>refresh</button>
      </div>
      <UserTableContext.Provider
        value={{
          methods,
          state,
        }}
      >
        <UsersTable  />
      </UserTableContext.Provider>
    </div>
  );
};

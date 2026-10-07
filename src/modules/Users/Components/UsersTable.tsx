import { BaseTable } from '@/lib/Components/BaseTable';
import { UserTableContext } from '../UserTableContext';
import { FC, useContext } from 'react';
import type { User } from '../types';
import { getUsers } from '../api';

export const UsersTable: FC = () => {
  const context = useContext(UserTableContext);

  return <BaseTable<User> fetcher={getUsers} api={context} />;
};

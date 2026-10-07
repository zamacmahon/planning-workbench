export type User = {
  id: string;
  firstName?: string;
  lastName?: string;
  userStatus?: 'active' | 'inactive';
  /** Format: date-time */
  createdDateUtc?: string;
  /** Format: date-time */
  lastLoginDateUtc?: string | null;
  email?: string;
  role?: string;
  department?: string;
  jobTitle?: string;
  fullName?: string;
  /** Format: date-time */
  deactivationDateTimeUtc?: string | null;
  /** Format: date-time */
  reactivationDateTimeUtc?: string | null;
};

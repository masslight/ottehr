import { render, screen } from '@testing-library/react';
import { UseFormGetValues, UseFormSetValue } from 'react-hook-form';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Roles are shown to every viewer but only an admin may change them. Without a reason on the page
// that reads as a broken form, so the hint has to appear for exactly the permission case — not for
// a deactivated record, which the activation card already explains.

const mockHasRole = vi.fn<(roles: RoleType[]) => boolean>(() => true);
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'viewer-1', hasRole: mockHasRole }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'viewer-1', hasRole: mockHasRole }) }));

import { RoleSelection } from '../../src/components/EmployeeInformation/RoleSelection';
import { dataTestIds } from '../../src/constants/data-test-ids';

const noErrors = {
  submit: false,
  roles: false,
  qualification: false,
  state: false,
  number: false,
  date: false,
  duplicateLicense: false,
};

const renderRoles = (opts: { isActive?: boolean; isOwnRecord?: boolean } = {}): void => {
  render(
    <RoleSelection
      control={{} as any}
      errors={noErrors}
      isActive={opts.isActive ?? true}
      isOwnRecord={opts.isOwnRecord ?? false}
      getValues={(() => [RoleType.Staff]) as unknown as UseFormGetValues<any>}
      setValue={(() => undefined) as unknown as UseFormSetValue<any>}
    />
  );
};

const hint = (): HTMLElement | null => screen.queryByTestId(dataTestIds.employeesPage.roleEditPermissionHint);

describe('RoleSelection permission hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(true);
  });

  it('is absent for an admin, who can actually use the checkboxes', () => {
    renderRoles();
    expect(hint()).not.toBeInTheDocument();
  });

  it('addresses the viewer directly on their own record', () => {
    mockHasRole.mockReturnValue(false);
    renderRoles({ isOwnRecord: true });
    expect(hint()).toHaveTextContent('Only an administrator can update your role.');
  });

  it("stays impersonal on somebody else's record", () => {
    // A Manager can open another employee's record but still can't assign roles, so "your role"
    // would be addressing the wrong person.
    mockHasRole.mockReturnValue(false);
    renderRoles({ isOwnRecord: false });
    expect(hint()).toHaveTextContent('Only an administrator can update roles.');
  });

  it('defers to the activation card when the record is deactivated', () => {
    mockHasRole.mockReturnValue(false);
    renderRoles({ isActive: false });
    expect(hint()).not.toBeInTheDocument();
  });

  it('disables the checkboxes whenever the viewer cannot edit roles', () => {
    mockHasRole.mockReturnValue(false);
    renderRoles({ isOwnRecord: true });
    expect(
      screen.getByTestId(dataTestIds.employeesPage.roleRow(RoleType.Provider)).querySelector('input')
    ).toBeDisabled();
  });
});

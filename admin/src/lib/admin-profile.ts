export const adminProfileToCurrentUser = (
  profile: API.AdminProfile,
): API.CurrentUser => ({
  userid: profile.id,
  name: profile.displayName || profile.username,
  email: profile.email,
  access: 'admin',
  permissions: profile.permissions ?? [],
  tags: profile.roles?.map((role) => ({ key: role, label: role })),
});

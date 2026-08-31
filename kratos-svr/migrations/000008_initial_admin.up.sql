INSERT INTO adm_roles (code,name,description,data_scope,status,created_at,updated_at)
SELECT 'super_admin','超级管理员','平台初始化超级管理员角色','all','active',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM adm_roles WHERE code = 'super_admin');

INSERT INTO adm_permissions (code,name,resource,action,description,created_at,updated_at)
SELECT 'platform.all','平台全部权限','*','*','平台初始化超级管理员通配权限',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM adm_permissions WHERE code = 'platform.all');

INSERT INTO adm_users (username,display_name,email,password_hash,status,failed_login_count,password_changed_at,created_at,updated_at)
SELECT 'admin','平台管理员','admin@geohelper.local','$2a$10$QJ2fhm64eqbFcKa2ckmz7OiImFlgFKkBq4vaRQpMcavAXsEGU6jQK','active',0,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM adm_users WHERE username = 'admin');

INSERT INTO adm_role_bindings (admin_user_id,role_id,created_at,updated_at)
SELECT u.id,r.id,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
FROM adm_users u
JOIN adm_roles r ON r.code = 'super_admin'
WHERE u.username = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM adm_role_bindings b
    WHERE b.admin_user_id = u.id AND b.role_id = r.id
  );

INSERT INTO adm_role_permissions (role_id,permission_id,created_at,updated_at)
SELECT r.id,p.id,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
FROM adm_roles r
JOIN adm_permissions p ON p.code = 'platform.all'
WHERE r.code = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM adm_role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Add Staff role if not exists
-- هذا الملف يضيف دور "Staff" للموظفين

INSERT INTO roles (name, description)
VALUES ('Staff', 'موظف الموقع - يرى فقط بيانات الموقع الخاص به')
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT * FROM roles WHERE name = 'Staff';


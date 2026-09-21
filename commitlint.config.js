/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['root', 'api', 'web', 'shared', 'db', 'docs', 'ci', 'deps', 'auth', 'rbac'],
    ],
    'body-max-line-length': [0, 'always'],
  },
};

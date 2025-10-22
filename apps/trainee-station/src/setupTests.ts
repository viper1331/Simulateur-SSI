import '@testing-library/jest-dom';

declare global {
  // eslint-disable-next-line no-var
  var __APP_VERSION__: string;
}

globalThis.__APP_VERSION__ = 'test';

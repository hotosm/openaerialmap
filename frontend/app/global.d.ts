export {};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'wa-drawer': any;
      'wa-button': any;
      'wa-button-group': any;
      'wa-divider': any;
      'wa-spinner': any;
      'wa-select': any;
      'wa-option': any;
      'wa-input': any;
      'wa-dialog': any;
      'wa-copy-button': any;
      'wa-icon': any;
      'hotosm-auth': {
        'hanko-url'?: string;
        'base-path'?: string;
        'show-profile'?: string | boolean;
        'redirect-after-login'?: string;
        'redirect-after-logout'?: string;
        'osm-required'?: string | boolean;
        'auto-connect'?: string | boolean;
        'verify-session'?: string | boolean;
      };
    }
  }
}

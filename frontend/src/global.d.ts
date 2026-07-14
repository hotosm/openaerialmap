import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "virtual:uno.css";

type HotHeaderAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  title?: string;
  logo?: string;
  size?: string;
  "tabs-center-align"?: boolean | string;
};

type WaButtonAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  variant?: string;
  appearance?: string;
  size?: string;
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  // Pill-shaped border-radius. Kept as a WA-native attribute rather
  // than a class override so the pill radius travels through WA's own
  // token layer (--wa-border-radius-pill).
  pill?: boolean | string;
  // Renders a chevron caret inside the button's shadow DOM at
  // ::part(caret). Used for dropdown triggers - WA spaces the caret
  // via its own tokens so we don't get the 1.25em host-box slack that
  // a standalone <wa-icon> would introduce.
  "with-caret"?: boolean | string;
  loading?: boolean | string;
  class?: string;
};

type WaCardAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  class?: string;
};

type WaIconAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  name?: string;
  variant?: string;
  library?: string;
  // Sizes the icon to its actual glyph width instead of the default
  // 1.25em host box. Set on every icon that sits inline next to text
  // so the surrounding button/link doesn't pick up ~0.25em of dead
  // space on the icon side.
  "auto-width"?: boolean | string;
  class?: string;
};

type WaDropdownAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  open?: boolean;
  placement?: string;
  distance?: number | string;
  skidding?: number | string;
  class?: string;
};

type WaDropdownItemAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  value?: string;
  type?: string;
  checked?: boolean;
  disabled?: boolean;
  class?: string;
};

type WaInputAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  type?: string;
  value?: string;
  placeholder?: string;
  size?: string;
  appearance?: string;
  autofocus?: boolean;
  class?: string;
};

type WaSpinnerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  class?: string;
};

type WaTagAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  variant?: string;
  appearance?: string;
  size?: string;
  pill?: boolean;
  class?: string;
};

type WaCalloutAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  variant?: string;
  appearance?: string;
  size?: string;
  class?: string;
};

interface CustomElements {
  "hot-header": HotHeaderAttributes;
  "wa-button": WaButtonAttributes;
  "wa-card": WaCardAttributes;
  "wa-callout": WaCalloutAttributes;
  "wa-dropdown": WaDropdownAttributes;
  "wa-dropdown-item": WaDropdownItemAttributes;
  "wa-icon": WaIconAttributes;
  "wa-input": WaInputAttributes;
  "wa-spinner": WaSpinnerAttributes;
  "wa-tag": WaTagAttributes;
}

// Declaration merging into React's JSX namespace requires an interface
// with a matching name - a `type` alias would shadow the built-in
// IntrinsicElements and strip out every standard HTML tag. The empty
// body is intentional; @typescript-eslint's no-empty-object-type rule
// doesn't understand that context.

declare module "react/jsx-runtime" {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends CustomElements {}
  }
}

declare module "react/jsx-dev-runtime" {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends CustomElements {}
  }
}

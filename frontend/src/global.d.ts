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
  disabled?: boolean;
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
  class?: string;
};

interface CustomElements {
  "hot-header": HotHeaderAttributes;
  "wa-button": WaButtonAttributes;
  "wa-card": WaCardAttributes;
  "wa-icon": WaIconAttributes;
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

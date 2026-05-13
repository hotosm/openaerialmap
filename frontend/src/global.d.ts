import type { DetailedHTMLProps, HTMLAttributes } from "react";

type HotHeaderAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  title?: string;
  logo?: string;
  size?: string;
  "tabs-center-align"?: boolean | string;
};

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "hot-header": HotHeaderAttributes;
    }
  }
}

declare module "react/jsx-dev-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "hot-header": HotHeaderAttributes;
    }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    "hot-header": React.HTMLAttributes<HTMLElement> & {
      title?: string;
      logo?: string;
      size?: string;
      "tabs-center-align"?: boolean | string;
    };
  }
}

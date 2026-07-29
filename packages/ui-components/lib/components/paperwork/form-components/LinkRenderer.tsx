import { ReactElement } from 'react';

export function LinkRenderer(props: any): ReactElement {
  return (
    <a href={props.href} target="_blank">
      {props.children}
    </a>
  );
}

import { Link } from '@mui/material';
import { FC, Fragment } from 'react';
import { splitLinks } from './employee-chat.utils';

export const LinkifiedText: FC<{ text: string }> = ({ text }) => (
  <>
    {splitLinks(text).map((segment, index) =>
      segment.href ? (
        <Link key={index} href={segment.href} target="_blank" rel="noopener noreferrer" sx={{ wordBreak: 'break-all' }}>
          {segment.text}
        </Link>
      ) : (
        <Fragment key={index}>{segment.text}</Fragment>
      )
    )}
  </>
);

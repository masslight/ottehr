import { Node } from '@tiptap/pm/model';

export const rosToMarkdown = (node: Node): string => {
  let markdown = '';

  node.forEach((child) => {
    if (child.type.name === 'rosList') {
      child.forEach((item) => {
        if (item.type.name === 'rosItem') {
          const state = item.attrs.state;
          let marker = '[ ]';

          if (state === 'reports') {
            marker = '[R]';
          } else if (state === 'denies') {
            marker = '[D]';
          }

          const text = item.textContent.trim();
          markdown += `- ${marker} ${text}\n`;
        }
      });
    } else if (child.type.name === 'heading') {
      const level = child.attrs.level;
      markdown += `${'#'.repeat(level)} ${child.textContent}\n`;
    } else if (child.type.name === 'paragraph') {
      markdown += `${child.textContent}\n`;
    }
  });

  return markdown.trim();
};

export const markdownToRos = (markdown: string): any => {
  const lines = markdown.split('\n');
  const content: any[] = [];
  let currentListItems: any[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();

    const rosMatch = trimmed.match(/^-\s*\[([ RD])\]\s*(.+)$/);
    if (rosMatch) {
      const [, marker, text] = rosMatch;
      let state = null;

      if (marker === 'R') {
        state = 'reports';
      } else if (marker === 'D') {
        state = 'denies';
      }

      currentListItems.push({
        type: 'rosItem',
        attrs: { state },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text }],
          },
        ],
      });
      return;
    }

    if (currentListItems.length > 0) {
      content.push({
        type: 'rosList',
        content: currentListItems,
      });
      currentListItems = [];
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const [, hashes, text] = headingMatch;
      content.push({
        type: 'heading',
        attrs: { level: hashes.length },
        content: [{ type: 'text', text }],
      });
      return;
    }

    if (trimmed) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: trimmed }],
      });
    }
  });

  if (currentListItems.length > 0) {
    content.push({
      type: 'rosList',
      content: currentListItems,
    });
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
};

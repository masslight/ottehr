import { InputRule, mergeAttributes, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
export interface RosItemOptions {
  nested: boolean;
  HTMLAttributes: Record<string, any>;
}

export const RosItem = Node.create<RosItemOptions>({
  name: 'rosItem',
  content: 'paragraph block*',
  defining: true,

  addOptions() {
    return {
      nested: false,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      state: {
        default: null,
        parseHTML: (element) => {
          const state = element.getAttribute('data-state');
          return state === 'null' || !state ? null : state;
        },
        renderHTML: (attributes) => {
          return {
            'data-state': attributes.state || 'null',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'li[data-type="ros-item"]',
        priority: 51,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const state = node.attrs.state;
    const itemId = `ros-item-${Math.random().toString(36).substr(2, 9)}`;

    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'ros-item',
        'data-state': state || 'null',
        'data-item-id': itemId,
      }),
      [
        'div',
        { class: 'ros-item-container' },
        ['div', { class: 'ros-item-content' }, 0],
        [
          'div',
          { class: 'ros-radio-group', contenteditable: 'false' },
          [
            'label',
            { class: 'ros-radio-option', title: 'Reports' },
            [
              'input',
              {
                type: 'checkbox',
                name: itemId,
                value: 'reports',
                checked: state === 'reports' ? 'checked' : null,
                'data-action': 'ros-radio',
                'data-option': 'reports',
              },
            ],
            ['span', { class: 'ros-radio-label' }, 'Reports'],
          ],
          [
            'label',
            { class: 'ros-radio-option', title: 'Denies' },
            [
              'input',
              {
                type: 'checkbox',
                name: itemId,
                value: 'denies',
                checked: state === 'denies' ? 'checked' : null,
                'data-action': 'ros-radio',
                'data-option': 'denies',
              },
            ],
            ['span', { class: 'ros-radio-label' }, 'Denies'],
          ],
        ],
      ],
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^-\s*\[(\+|-| )\]\s$/,
        handler: ({ range, match, chain }) => {
          const raw = match[1];

          const state = raw === '+' ? 'reports' : raw === '-' ? 'denies' : null;
          chain()
            .deleteRange(range)
            .insertContent({
              type: 'rosItem',
              attrs: { state },
              content: [{ type: 'paragraph' }],
            });
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('rosItemInteraction'),
        props: {
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;

              let input = target as HTMLInputElement;
              if (input.tagName !== 'INPUT') {
                input = target.querySelector('input[data-action="ros-radio"]') as HTMLInputElement;
              }
              if (!input || input.tagName !== 'INPUT') {
                input = target.closest('label')?.querySelector('input[data-action="ros-radio"]') as HTMLInputElement;
              }

              if (!input || !input.hasAttribute('data-action')) {
                return false;
              }

              const li = input.closest('li[data-type="ros-item"]');
              if (!li) {
                return false;
              }

              let pos = -1;
              let foundNode = null;

              if (pos === -1 || !foundNode) {
                try {
                  pos = view.posAtDOM(li, 0);
                  if (pos > 0) {
                    const $pos = view.state.doc.resolve(pos);

                    for (let d = $pos.depth; d >= 0; d--) {
                      const node = $pos.node(d);
                      if (node.type.name === 'rosItem') {
                        pos = $pos.before(d);
                        foundNode = node;
                        break;
                      }
                    }
                  }
                } catch (e) {
                  console.error('Error finding position:', e);
                  return false;
                }
              }

              if (!foundNode || foundNode.type.name !== 'rosItem') {
                return false;
              }

              const currentState = foundNode.attrs.state;
              const newValue = input.value;
              const newState = currentState === newValue ? null : newValue;

              const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                ...foundNode.attrs,
                state: newState,
              });

              view.dispatch(tr);

              event.preventDefault();
              event.stopPropagation();
              return true;
            },
          },
        },
      }),
    ];
  },
});

export const RosList = Node.create({
  name: 'rosList',
  group: 'block list',
  content: 'rosItem+',

  parseHTML() {
    return [
      {
        tag: 'ul[data-type="ros-list"]',
        priority: 51,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-type': 'ros-list' }), 0];
  },
});

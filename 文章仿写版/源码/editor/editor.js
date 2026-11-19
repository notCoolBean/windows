import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

export function createArticleEditor(element, toolbar, onEdit) {
  const block = toolbar.querySelector('select');
  const buttons = [...toolbar.querySelectorAll('[data-command]')];
  function sync(editor) {
    block.disabled = !editor.isEditable;
    block.value = editor.isActive('heading', {level: 1}) ? '1' : editor.isActive('heading', {level: 2}) ? '2' : 'p';
    const can = editor.can();
    for (const button of buttons) {
      const command = button.dataset.command;
      button.disabled = !editor.isEditable || !can[command]();
      if (button.dataset.format) button.setAttribute('aria-pressed', editor.isActive(button.dataset.format));
    }
  }
  const editor = new Editor({
    element, injectCSS: false,
    extensions: [StarterKit.configure({
      heading: {levels: [1, 2]}, link: false, code: false, codeBlock: false,
      horizontalRule: false, dropcursor: false, trailingNode: false,
    })],
    editorProps: {attributes: {role: 'textbox', 'aria-multiline': 'true', 'aria-label': '新稿正文', spellcheck: 'false'}},
    onTransaction: ({editor}) => sync(editor),
    onUpdate: () => onEdit(),
  });
  sync(editor);
  for (const button of buttons) {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => editor.chain().focus()[button.dataset.command]().run());
  }
  block.onchange = () => {
    const chain = editor.chain().focus();
    if (block.value === 'p') chain.setParagraph().run();
    else chain.setHeading({level: Number(block.value)}).run();
  };
  return editor;
}

// Generated text is data, including literal angle brackets, never HTML.
export function fromGeneratedText(text) {
  const lines = text.replace(/\r\n?/g, '\n').trim().split(/\n+/);
  const content = lines.filter(line => line.trim()).map((line, index) => {
    const node = index === 0 && lines.length > 1 && line.length <= 80
      ? {type: 'heading', attrs: {level: 1}} : {type: 'paragraph'};
    return {...node, content: [{type: 'text', text: line}]};
  });
  return {type: 'doc', content: content.length ? content : [{type: 'paragraph'}]};
}

export {wordDocument} from './word.js';

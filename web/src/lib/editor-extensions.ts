import { EditorView, keymap } from "@codemirror/view";

// On Enter: preserve the current line's leading whitespace exactly.
// Overrides the Python language mode's "smart" dedent which drops 2 spaces.
export const preserveIndentOnEnter = keymap.of([{
  key: "Enter",
  run(view) {
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    const indent = line.text.match(/^\s*/)?.[0] ?? "";
    const insert = "\n" + indent;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + insert.length },
      scrollIntoView: true,
    });
    return true;
  },
}]);

// Breathing room so code/comments don't butt against the editor's right edge.
export const editorPadding = EditorView.theme({
  ".cm-content": { paddingRight: "1.25rem" },
});

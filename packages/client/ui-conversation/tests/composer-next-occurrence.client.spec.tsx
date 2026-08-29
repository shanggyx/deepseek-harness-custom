// @vitest-environment jsdom
/**
 * The composer's next-occurrence selection (Ctrl/Cmd+D and Ctrl/Cmd+K core):
 * headless editors drive the flat-text search, wrapping, collapsed-caret word
 * pick, and the no-other-match no-op. The Lexical command registration rides
 * the same exported function.
 */
import { describe, expect, it } from 'vitest'
import { createHeadlessEditor } from '@lexical/headless'
import type { LexicalEditor } from 'lexical'
import {
  $createParagraphNode, $createRangeSelection, $createTextNode, $getRoot, $getSelection,
  $isElementNode, $isRangeSelection, $isTextNode, $setSelection,
} from 'lexical'
import { selectComposerNextOccurrence } from '../src/client/input/editor/keymap.ts'

function makeEditor(): LexicalEditor {
  return createHeadlessEditor({
    namespace: 'next-occurrence-spec',
    nodes: [],
    onError: (error) => { throw error },
  })
}

function setContent(editor: LexicalEditor, paragraphs: readonly string[]): void {
  editor.update(() => {
    const root = $getRoot()
    root.clear()
    for (const paragraph of paragraphs) {
      const node = $createParagraphNode()
      node.append($createTextNode(paragraph))
      root.append(node)
    }
  })
}

/** Select [anchor, focus) inside the first paragraph's single text node. */
function selectFirstParagraph(editor: LexicalEditor, anchor: number, focus: number): void {
  editor.update(() => {
    const paragraph = $getRoot().getFirstChild()
    if (!$isElementNode(paragraph)) throw new Error('expected a paragraph first')
    const text = paragraph.getFirstChild()
    if (!$isTextNode(text)) throw new Error('expected a text node in the first paragraph')
    const selection = $createRangeSelection()
    selection.anchor.set(text.getKey(), anchor, 'text')
    selection.focus.set(text.getKey(), focus, 'text')
    $setSelection(selection)
  })
}

function selectionText(editor: LexicalEditor): string {
  return editor.read(() => {
    const selection = $getSelection()
    return $isRangeSelection(selection) ? selection.getTextContent() : ''
  })
}

function selectionOffsets(editor: LexicalEditor): { anchor: number; focus: number } {
  return editor.read(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return { anchor: -1, focus: -1 }
    return { anchor: selection.anchor.offset, focus: selection.focus.offset }
  })
}

describe('selectComposerNextOccurrence', () => {
  it('selects the next occurrence after the selection', () => {
    const editor = makeEditor()
    setContent(editor, ['abc foo abc bar abc'])
    selectFirstParagraph(editor, 0, 3)
    expect(selectComposerNextOccurrence(editor)).toBe(true)
    expect(selectionText(editor)).toBe('abc')
    expect(selectionOffsets(editor).focus).toBe(11)
  })

  it('wraps around when no occurrence follows', () => {
    const editor = makeEditor()
    setContent(editor, ['abc foo abc bar abc'])
    selectFirstParagraph(editor, 16, 19)
    expect(selectComposerNextOccurrence(editor)).toBe(true)
    expect(selectionText(editor)).toBe('abc')
    expect(selectionOffsets(editor).anchor).toBe(0)
  })

  it('picks the word under a collapsed caret', () => {
    const editor = makeEditor()
    setContent(editor, ['feed the cat, then feed the dog'])
    selectFirstParagraph(editor, 9, 9)
    expect(selectComposerNextOccurrence(editor)).toBe(true)
    expect(selectionText(editor)).toBe('cat')
  })

  it('is a no-op when the needle occurs exactly once', () => {
    const editor = makeEditor()
    setContent(editor, ['abc foo abc bar abc'])
    selectFirstParagraph(editor, 4, 7)
    expect(selectComposerNextOccurrence(editor)).toBe(false)
    expect(selectionText(editor)).toBe('foo')
  })

  it('keeps the selection when the needle text is empty at a space boundary', () => {
    const editor = makeEditor()
    setContent(editor, ['   '])
    selectFirstParagraph(editor, 1, 1)
    expect(selectComposerNextOccurrence(editor)).toBe(false)
  })
})

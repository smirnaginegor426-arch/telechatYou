import { useEffect } from "react";
import { CUSTOM_LANGUAGE_EVENT, loadCustomLanguageMap } from "@/lib/custom-language";

/** Translates exact UI phrases, but never chat contents or text being edited. */
export function CustomLanguageBridge() {
  useEffect(() => {
    let dictionary = loadCustomLanguageMap();
    const originalText = new WeakMap<Text, string>();
    const renderedText = new WeakMap<Text, string>();
    const originalAttributes = new WeakMap<Element, Map<string, string>>();
    const renderedAttributes = new WeakMap<Element, Map<string, string>>();
    const excludedSelector = ".tcy-no-select, [data-no-translate='true'], [contenteditable='true'], script, style";
    const isExcluded = (element: Element | null) => !!element?.closest(excludedSelector);

    const translate = (source: string) => {
      const replacement = dictionary.get(source.trim());
      if (!replacement) return source;
      const leading = source.match(/^\s*/)?.[0] ?? "";
      const trailing = source.match(/\s*$/)?.[0] ?? "";
      return leading + replacement + trailing;
    };

    const translateText = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || isExcluded(parent)) return;
      const current = node.nodeValue ?? "";
      let source = originalText.get(node);
      if (source === undefined) {
        source = current;
        originalText.set(node, source);
      } else if (current !== source && current !== renderedText.get(node)) {
        source = current;
        originalText.set(node, source);
      }
      const next = translate(source);
      renderedText.set(node, next);
      if (current !== next) node.nodeValue = next;
    };

    const attrs = ["placeholder", "title", "aria-label"];
    const translateAttributes = (element: Element) => {
      if (isExcluded(element)) return;
      let sources = originalAttributes.get(element);
      if (!sources) {
        sources = new Map<string, string>();
        originalAttributes.set(element, sources);
      }
      let rendered = renderedAttributes.get(element);
      if (!rendered) {
        rendered = new Map<string, string>();
        renderedAttributes.set(element, rendered);
      }
      for (const attr of attrs) {
        if (!element.hasAttribute(attr)) continue;
        const current = element.getAttribute(attr) ?? "";
        let source = sources.get(attr);
        if (source === undefined) {
          source = current;
          sources.set(attr, source);
        } else if (current !== source && current !== rendered.get(attr)) {
          source = current;
          sources.set(attr, source);
        }
        const next = translate(source);
        rendered.set(attr, next);
        if (current !== next) element.setAttribute(attr, next);
      }
    };

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        translateText(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
      if (node instanceof Element) translateAttributes(node);
      const root = node as ParentNode;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current: Node | null;
      while ((current = walker.nextNode())) translateText(current as Text);
      if (root.querySelectorAll) {
        root.querySelectorAll("[placeholder], [title], [aria-label]").forEach(translateAttributes);
      }
    };

    processNode(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target instanceof Text) {
          translateText(mutation.target);
        } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateAttributes(mutation.target);
        } else {
          mutation.addedNodes.forEach(processNode);
          if (mutation.target instanceof Element) translateAttributes(mutation.target);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attrs,
    });
    const refresh = () => {
      dictionary = loadCustomLanguageMap();
      processNode(document.body);
    };
    window.addEventListener(CUSTOM_LANGUAGE_EVENT, refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener(CUSTOM_LANGUAGE_EVENT, refresh);
    };
  }, []);
  return null;
}

import type { FootnoteDefinition, FootnoteReference } from "mdast";

interface InlineCommentReference extends Omit<FootnoteReference, "type"> {
  type: "inlineCommentRef";
}

interface InlineCommentDefinition extends Omit<FootnoteDefinition, "type"> {
  type: "inlineCommentDef";
}

declare module "mdast" {
  interface DefinitionContentMap {
    inlineCommentDef: InlineCommentDefinition;
  }

  interface PhrasingContentMap {
    inlineCommentRef: InlineCommentReference;
  }

  interface RootContentMap {
    inlineCommentDef: InlineCommentDefinition;
    inlineCommentRef: InlineCommentReference;
  }
}

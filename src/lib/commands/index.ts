/**
 * Diagram command system.
 *
 * Commands are plain JSON objects that describe a mutation to the diagram.
 * The LLM produces an array of these; the executor applies them to the
 * in-memory capability tree and/or the canvas node-style map.
 */

export type DiagramCommand =
  /** Change background fill and/or border colour of a node */
  | {
      type: "SET_STYLE";
      /** Capability ID (uuid) */
      nodeId: string;
      fill?: string;   // CSS hex e.g. "#ff0000"
      border?: string; // CSS hex e.g. "#333333"
    }
  /** Attach or replace a text note on a node */
  | {
      type: "SET_NOTE";
      nodeId: string;
      note: string;
    }
  /** Rename a capability */
  | {
      type: "RENAME_NODE";
      nodeId: string;
      newName: string;
    }
  /** Move a node to a different parent (must obey level hierarchy) */
  | {
      type: "REPARENT_NODE";
      nodeId: string;
      /** ID of the new parent capability */
      newParentId: string;
    }
  /**
   * Permanently delete a node and all its descendants.
   * Use with caution — irreversible without an undo stack.
   */
  | {
      type: "DELETE_NODE";
      nodeId: string;
      /**
       * When true, children of the deleted node are re-parented to its parent
       * instead of being deleted with it. Defaults to false (cascade delete).
       */
      reparentChildren?: boolean;
    };

/** Keyed by nodeId; merged into ReactFlow node.data on the canvas */
export type NodeStylePatch = {
  fill?: string;
  border?: string;
  note?: string;
};

export interface TransformRequest {
  prompt: string;
  capabilities: import("@/types/capability").Capability[];
  /** Current per-node visual overrides already on the canvas */
  nodeStyles?: Record<string, NodeStylePatch>;
}

export interface TransformResponse {
  commands: DiagramCommand[];
  /** Human-readable summary from the LLM */
  summary: string;
}

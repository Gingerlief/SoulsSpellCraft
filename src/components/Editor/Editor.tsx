
import { useEffect, useRef } from 'react';
import { EditorBanners } from './EditorBanners';
import { EditorCanvas } from './EditorCanvas';
import { EditorFooter } from './EditorFooter';
import { EditorHeader } from './EditorHeader';
import { EditorPanels } from './EditorPanels';
import { EmptyState } from './EmptyState';
import { ConnectMenu } from '../Craft/ConnectMenu';
import { CraftNodeMenu } from '../Craft/CraftNodeMenu';
import { EdgeMenu } from '../Craft/EdgeMenu';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { useCraft } from '../../hooks/useCraft';
import { useDirectorySource } from '../../hooks/useDirectorySource';
import { useSpellDocument } from '../../hooks/useSpellDocument';
import { useSpellEdits } from '../../hooks/useSpellEdits';
import { useSpellEngine } from '../../hooks/useSpellEngine';

export function Editor() {
  const document = useSpellDocument();
  const { show, setError, setSelected } = document;

  const engine = useSpellEngine({ onLoad: show, onError: setError });
  const edits = useSpellEdits(document.doc, engine.apply);
  const source = useDirectorySource({ onLoad: show, onError: setError });
  const canvas = useCanvasInteraction(document.doc);
  const craft = useCraft({ doc: document.doc, show, setSelected, closeMenus: canvas.closeMenu });

  const fileInput = useRef<HTMLInputElement>(null);

  const { craft: crafting, undo: undoCraft, redo: redoCraft } = craft;
  useEffect(() => {
    if (!crafting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoCraft();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redoCraft();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [crafting, undoCraft, redoCraft]);

  const nodeMenu = canvas.target?.kind === 'node' ? canvas.target : null;
  const edgeMenu = canvas.target?.kind === 'edge' ? canvas.target : null;

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void document.loadFiles(e.dataTransfer.files);
      }}
    >
      <EditorHeader
        doc={document.doc}
        spells={engine.spells}
        onPickSpell={(entry) => void engine.pickSpell(entry)}
        patch={{
          count: edits.edits.size,
          rows: edits.dirtyNodes.size,
          applying: engine.applying,
          canApply: engine.ready,
          onSave: () => void edits.save(),
          onDownload: edits.download,
          onDiscard: edits.clear,
        }}
        source={{
          canPick: source.canPick,
          hasSource: source.source !== null,
          showPicker: source.showPicker,
          onOpen: () => void source.open(),
          onTogglePicker: () => source.setShowPicker(!source.showPicker),
        }}
        onOpenDocument={() => fileInput.current?.click()}
        onLoadExample={() => void document.loadExample()}
      />

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void document.loadFiles(e.target.files)}
      />

      <EditorBanners
        error={document.error}
        applying={engine.applying}
        applied={engine.applied}
        appliedTo={engine.appliedTo}
        onDismissApplied={engine.dismissApplied}
      />

      <main className="workspace">
        <EditorCanvas
          hasDocument={document.doc !== null}
          nodes={document.nodes}
          edges={document.edges}
          onNodesChange={document.onNodesChange}
          onEdgesChange={document.onEdgesChange}
          dirtyNodes={edits.dirtyNodes}
          roleOf={craft.roleOf}
          acceptDrops={craft.craft !== null}
          onDropNode={craft.dropNode}
          onConnectNodes={craft.connect}
          onSelect={setSelected}
          onContextMenu={canvas.openNodeMenu}
          onEdgeContextMenu={canvas.openEdgeMenu}
          empty={
            <EmptyState
              canPickDirectory={source.canPick}
              needsReconnect={source.needsReconnect}
              onOpenFolder={() => void source.open()}
              onReconnect={() => void source.reconnect()}
              onPick={() => fileInput.current?.click()}
              onExample={() => void document.loadExample()}
            />
          }
        />

        <EditorPanels
          document={document}
          edits={edits}
          craft={craft}
          engine={engine}
          source={source}
        />
      </main>

      {document.doc && craft.pending && (
        <ConnectMenu
          doc={document.doc}
          pending={craft.pending}
          onPick={craft.resolveConnection}
          onCancel={craft.cancelConnection}
        />
      )}

      {nodeMenu && (
        <CraftNodeMenu
          target={nodeMenu}
          craft={craft}
          onInspect={setSelected}
          onClose={canvas.closeMenu}
        />
      )}

      {edgeMenu && document.doc && (
        <EdgeMenu
          doc={document.doc}
          library={craft.library ?? document.doc}
          from={edgeMenu.from}
          to={edgeMenu.to}
          x={edgeMenu.x}
          y={edgeMenu.y}
          onCut={(field) => {
            canvas.closeMenu();
            craft.cutLink(edgeMenu.from, field);
          }}
          onRepoint={(field, id) => {
            canvas.closeMenu();
            craft.repoint(edgeMenu.from, field, id);
          }}
          onClose={canvas.closeMenu}
        />
      )}

      {document.doc && (
        <EditorFooter
          doc={document.doc}
          nodeCount={document.nodes.length}
          edgeCount={document.edges.length}
        />
      )}
    </div>
  );
}

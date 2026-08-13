
import { CraftPanel } from '../Craft/CraftPanel';
import { DonorPanel } from '../Craft/DonorPanel';
import { FieldInspector } from '../FieldInspector';
import { SpellPicker } from '../Spell/SpellPicker';
import type { Craft } from '../../hooks/useCraft';
import type { DirectorySource } from '../../hooks/useDirectorySource';
import type { SpellDocumentState } from '../../hooks/useSpellDocument';
import type { SpellEdits } from '../../hooks/useSpellEdits';
import type { SpellEngine } from '../../hooks/useSpellEngine';

export function EditorPanels({
  document,
  edits,
  craft,
  engine,
  source,
}: {
  document: SpellDocumentState;
  edits: SpellEdits;
  craft: Craft;
  engine: SpellEngine;
  source: DirectorySource;
}) {
  const { doc, selectedNode, setSelected } = document;

  return (
    <>
      {!engine.ready && source.source && source.showPicker && (
        <SpellPicker
          source={source.source}
          selected={doc?.spell.magicId ?? null}
          onPick={(e) => void source.pickSpell(e)}
          onClose={() => source.setShowPicker(false)}
        />
      )}

      {doc && selectedNode && (
        <FieldInspector
          doc={doc}
          node={selectedNode}
          edits={edits.edits}
          onEdit={(field, original, value) =>
            craft.craft
              ? craft.edit(selectedNode.key, original, field, value)
              : edits.edit(selectedNode.key, field, original, value)
          }
          onRevert={(field) => edits.revert(selectedNode.key, field)}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
          craft={craft.craft}
          onFxrCopied={craft.noteFxrCopy}
        />
      )}

      {craft.craft && engine.spells && (
        <DonorPanel
          donor={craft.donor}
          spells={engine.spells}
          onPick={(id) => void craft.pickDonor(id)}
          onClear={() => craft.setDonor(null)}
        />
      )}

      {engine.ready && (
        <CraftPanel
          doc={doc}
          craft={craft.craft}
          slotDoc={craft.slotDoc}
          text={craft.text}
          onStart={craft.start}
          onStop={craft.stop}
          onSlotDoc={craft.setSlotDoc}
          onText={craft.setText}
          onGenerate={() => void craft.generate()}
          onResume={(saved) => void craft.resume(saved)}
          onUndo={craft.undo}
          onRedo={craft.redo}
          canUndo={craft.canUndo}
          canRedo={craft.canRedo}
          stage={craft.stage}
          generating={craft.generating}
          result={craft.result}
          dropError={craft.dropError}
        />
      )}
    </>
  );
}


import { NodeMenu } from './NodeMenu';
import type { Craft } from '../../hooks/useCraft';
import type { NodeTarget } from '../../hooks/useCanvasInteraction';

export function CraftNodeMenu({
  target,
  craft,
  onInspect,
  onClose,
}: {
  target: NodeTarget;
  craft: Craft;
  onInspect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <NodeMenu
      node={target.node}
      x={target.x}
      y={target.y}
      {...craft.statusOf(target.node.key)}
      crafting={craft.craft !== null}
      onClose={onClose}
      onAction={(action) => {
        onClose();
        if (action === 'inspect') onInspect(target.node.key);
        else craft.nodeAction(target.node, action);
      }}
    />
  );
}

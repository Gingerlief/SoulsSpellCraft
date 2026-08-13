
import { useDismiss } from '../../hooks/useDismiss';
import { kindStyle } from '../../lib/node-kinds';
import type { DocNode } from '../../spell-document';

export type NodeAction = 'inspect' | 'detach' | 'duplicate' | 'remove';

export function NodeMenu({
  node,
  x,
  y,
  owned,
  detachable,
  floating,
  crafting,
  onAction,
  onClose,
}: {
  node: DocNode;
  x: number;
  y: number;
  owned: boolean;
  detachable: boolean;
  floating: boolean;
  crafting: boolean;
  onAction: (action: NodeAction) => void;
  onClose: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(onClose);
  const style = kindStyle(node.kind);
  const items: { action: NodeAction; label: string; enabled: boolean; hint?: string }[] = [
    { action: 'inspect', label: 'Inspect fields', enabled: true },
    {
      action: 'detach',
      label: 'Detach from craft',
      enabled: crafting && detachable,
      hint: !crafting
        ? 'start a craft first'
        : !detachable
          ? 'nothing on the canvas points at this'
          : undefined,
    },
    {
      action: 'remove',
      label: 'Remove from canvas',
      enabled: crafting && floating,
      hint: !crafting
        ? 'start a craft first'
        : !floating
          ? 'only an unconnected node can be taken off — detach it first'
          : undefined,
    },
    {
      action: 'duplicate',
      label: 'Duplicate into craft',
      enabled: crafting && !owned && node.table !== null,
      hint: !crafting
        ? 'start a craft first'
        : owned
          ? 'the craft already owns this row'
          : node.table === null
            ? 'a file rather than a param row — nothing to copy'
            : undefined,
    },
  ];

  return (
    <div ref={ref} className="nodemenu" style={{ left: x, top: y }} role="menu">
      <header className="nodemenu__head" style={{ color: style.color }}>
        {node.key}
      </header>
      <ul>
        {items.map((i) => (
          <li key={i.action}>
            <button
              type="button"
              role="menuitem"
              disabled={!i.enabled}
              title={i.hint}
              onClick={() => onAction(i.action)}
            >
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

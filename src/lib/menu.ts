
const MENU_WIDTH = 300;
const MENU_HEIGHT = 320;

export function menuPosition({ x, y }: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(window.innerWidth - MENU_WIDTH, Math.max(10, x)),
    y: Math.min(window.innerHeight - MENU_HEIGHT, Math.max(10, y)),
  };
}

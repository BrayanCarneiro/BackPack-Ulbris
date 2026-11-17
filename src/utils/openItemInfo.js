import { openModal } from './openModal.js';

export function openItemInfo(scene, item, board = scene.board ?? scene.session?.board) {
  openModal(scene, 'ItemInfoScene', { item: { ...item }, ...(board ? { board } : {}) });
}

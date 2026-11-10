import { openModal } from './openModal.js';

export function openItemInfo(scene, item) {
  openModal(scene, 'ItemInfoScene', { item: { ...item } });
}

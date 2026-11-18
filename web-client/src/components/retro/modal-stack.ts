const openModalStack: symbol[] = [];

export function pushModalToStack(id: symbol): void {
  const index = openModalStack.indexOf(id);
  if (index !== -1) {
    openModalStack.splice(index, 1);
  }
  openModalStack.push(id);
}

export function removeModalFromStack(id: symbol): void {
  const index = openModalStack.indexOf(id);
  if (index !== -1) {
    openModalStack.splice(index, 1);
  }
}

export function isTopmostModal(id: symbol): boolean {
  return openModalStack[openModalStack.length - 1] === id;
}

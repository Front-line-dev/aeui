function resolveFragmentComponent(fragmentLike) {
  if (typeof fragmentLike === 'function') return fragmentLike;
  if (fragmentLike && typeof fragmentLike === 'object') return fragmentLike.Fragment;
  return null;
}

export function getVNodeKey(vnode) {
  if (vnode == null || typeof vnode !== 'object' || Array.isArray(vnode)) return null;
  const key = vnode.props ? vnode.props.key : undefined;
  return key == null ? null : key;
}

export function isFragmentVNode(FragmentComponent, vnode) {
  const resolvedFragmentComponent = resolveFragmentComponent(FragmentComponent);
  return Array.isArray(vnode) || (
    vnode &&
    typeof vnode === 'object' &&
    vnode.tag === resolvedFragmentComponent
  );
}

export function getFragmentChildren(FragmentComponent, vnode) {
  if (Array.isArray(vnode)) return vnode;
  if (isFragmentVNode(FragmentComponent, vnode)) return vnode.children || [];
  return [];
}

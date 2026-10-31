import { useId } from 'react';

/** A unique prefix for SVG gradient ids, so two drawings never share (and break) each other's gradients */
export const useSvgId = () => useId().replace(/[^a-zA-Z0-9]/g, '');
